import assert from "node:assert/strict";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createServer } from "node:http";
import { EventEmitter } from "node:events";
import { readWoundJournal } from "../module/wound-journal.mjs";

const app = process.env.FOUNDRY_APP_PATH;
if (!app) throw new Error("Set FOUNDRY_APP_PATH to an installed Foundry v13/v14 app directory.");
const require = createRequire(resolve(app, "package.json"));
const { Server } = require("socket.io");

test("installed core forwarding with independent GM windows and player clients", async (t) => {
	const network = process.env.WOUND_TEST_NETWORK === "1";
	const http = createServer();
	const endpoints = [];
	const io = network ? new Server(http, { serveClient: false }) : new EventEmitter();
	if (!network) {
		const dispatch = io.emit.bind(io);
		io.emit = (event, ...args) => event === "connection" ? dispatch(event, ...args) : endpoints.forEach((endpoint) => endpoint.emit(event, ...args));
		io.close = () => {};
	}
	const users = [{ id: "gm", isGM: true, active: true, sockets: [] },
		{ id: "player", isGM: false, active: true, sockets: [] },
		{ id: "observer", isGM: false, active: true, sockets: [] }];
	// Execute the installed core handler verbatim; preserve host Array/Function
	// identities for v13's instanceof checks across the VM context.
	const source = await readFile(resolve(app, "dist/server/sockets.mjs"), "utf8");
	const start = source.indexOf("export function handleCustomSocket");
	const end = source.indexOf("export ", start + 7);
	const handler = vm.runInNewContext(`(${source.slice(start + 7, end)})`, { game: { users }, Array, Function });
	const state = Object.fromEntries(["Actor.base", "Scene.scene.Token.token.Actor.base"].map((uuid) => [uuid, {
		system: { wounds: { wounds: Array(11).fill(0), bloodloss: 2 } }, flags: {}, items: []
	}]));
	let writes = 0;
	let dropReplies = false;
	const wounds = (uuid = "Actor.base") => readWoundJournal(state[uuid].items, uuid, state[uuid].system.wounds).state.wounds;
	io.on("connection", (socket) => {
		const user = users.find((entry) => entry.id === socket.handshake.auth.userId);
		socket.user = user;
		user.sockets.push(socket);
		socket.server = io;
		socket.on("system.maelstrom", (message, options, ack) => {
			if (dropReplies && message.kind === "reply" && message.result?.status === "committed") return;
			handler.call(socket, "system.maelstrom", message, options, ack);
		});
		// Database transport is a fixture. Preserve the verified core invariant:
		// serialized embedded creation rejects duplicate IDs before writing.
		socket.on("fixtureCreate", ({ uuid, data }, ack) => {
			if (!user.isGM) return ack({ error: "permissionDenied" });
			if (data.some((item) => state[uuid].items.some((existing) => existing._id === item._id))) return ack({ error: "duplicate ID" });
			state[uuid].items.push(...data);
			writes++;
			io.emit("fixtureState", state);
			ack({ result: true });
		});
		socket.on("fixtureRead", ({ uuid }, ack) => ack({ result: state[uuid].items }));
		socket.on("fixtureReadActor", (_data, ack) => ack({ result: [{ _id: "base", type: "character", ...state["Actor.base"] }] }));
		socket.on("fixtureReadTokens", (_data, ack) => ack({ result: [{ _id: "token", actorId: "base", actorLink: false,
			delta: { system: state["Scene.scene.Token.token.Actor.base"].system } }] }));
		socket.on("fixtureUpdate", (_data, ack) => ack({ error: "Mutable wound writes are forbidden" }));
		socket.on("fixtureDelete", ({ uuid, id }, ack) => {
			state[uuid].items = state[uuid].items.filter((item) => item._id !== id);
			io.emit("fixtureState", state);
			ack({ result: true });
		});
		socket.on("disconnect", () => { user.sockets = user.sockets.filter((entry) => entry !== socket); });
		socket.on("fixtureReconnect", () => { if (!user.sockets.includes(socket)) user.sockets.push(socket); });
	});
	if (network) await new Promise((done) => http.listen(0, "127.0.0.1", done));
	t.after(() => io.close());
	const url = network ? `http://127.0.0.1:${http.address().port}` : null;
	const clients = [];
	let id = 0;
	async function client(userId, storage = []) {
		const worker = new Worker(new URL("./helpers/wound-service-client.mjs", import.meta.url), {
			workerData: { app, url, userId, network, state, storage, users: users.map(({ sockets, ...user }) => user) }
		});
		if (!network) {
			const handlers = new Map();
			const endpoint = {
				handshake: { auth: { userId } },
				on: (event, handler) => handlers.set(event, handler),
				emit: (event, ...args) => worker.postMessage({ socketEvent: event, args }),
				broadcast: { emit: (event, ...args) => endpoints.filter((other) => other !== endpoint).forEach((other) => other.emit(event, ...args)) }
			};
			endpoints.push(endpoint);
			io.emit("connection", endpoint);
			worker.on("message", (message) => {
				if (!message.socketSend) return;
				const args = message.args;
				if (message.ackId) args.push((...args) => worker.postMessage({ ackId: message.ackId, args }));
				handlers.get(message.socketSend)?.(...args);
			});
		}
		t.after(() => worker.terminate());
		await new Promise((done, reject) => { worker.once("message", done); worker.once("error", reject); });
		const pending = new Map();
		worker.on("message", (message) => {
			const call = pending.get(message.id);
			if (!call) return;
			pending.delete(message.id);
			message.error ? call.reject(new Error(message.error)) : call.resolve(message.result);
		});
		const call = (action, extra = {}) => new Promise((done, reject) => {
			const key = ++id;
			pending.set(key, { resolve: done, reject });
			worker.postMessage({ id: key, action, ...extra });
		});
		clients.push(call);
		return call;
	}
	const gm1 = await client("gm");
	const gm2 = await client("gm");
	const player1 = await client("player");
	const player2 = await client("player");
	const observer = await client("observer");
	await Promise.all([player1("submit"), player2("submit")]);
	assert.equal(wounds()[10], 4);
	assert.equal(state["Actor.base"].items.length, 2, "one immutable revision per operation despite competing GM windows");
	assert.equal(writes, 2);
	await observer("spoof");
	await gm1("submit");
	assert.equal(writes, 3, "GM self-delivery uses the server-authenticated route");
	await player1("submit", { uuid: "Scene.scene.Token.token.Actor.base" });
	assert.equal(wounds("Scene.scene.Token.token.Actor.base")[10], 2);
	assert.equal(wounds()[10], 6);
	const edits = await Promise.allSettled([player1("submit", { operation: { type: "setWound", slot: 0, expectedValue: 0, value: 3 } }),
		player2("submit", { operation: { type: "setWound", slot: 0, expectedValue: 0, value: 5 } })]);
	assert.equal(edits.filter((result) => result.status === "fulfilled").length, 1);
	assert.match(edits.find((result) => result.status === "rejected").reason.message, /conflict/);
	dropReplies = true;
	await assert.rejects(player1("submit"), /retryableWrite/);
	const afterLostReply = writes;
	dropReplies = false;
	await player1("retry");
	assert.equal(writes, afterLostReply, "lost acknowledgement does not repeat damage");
	assert.equal(await player1("status"), "ready");
	await player1("disconnect");
	assert.equal(await player1("status"), "unavailable");
	await player1("reconnect");
	assert.equal(await player1("status"), "ready");
	await player1("submit");
	assert.equal(writes, afterLostReply + 1, "player requests resume after reconnect without reload");
	await gm1("disconnect");
	const beforeDisconnect = writes;
	await player1("submit");
	assert.equal(writes, beforeDisconnect + 1, "remaining GM window continues without recovery");
	await gm2("disconnect");
	await client("gm");
	await player1("submit");
	assert.equal(writes, beforeDisconnect + 2, "fresh GM resumes after unprepared reload");
	dropReplies = true;
	await assert.rejects(player1("submit"), /retryableWrite/);
	const afterReloadPending = writes;
	const saved = await player1("storage");
	await player1("disconnect");
	dropReplies = false;
	const reloadedPlayer = await client("player", saved);
	await new Promise((done) => setTimeout(done, 2500));
	assert.equal(await reloadedPlayer("status"), "ready", "restored pending request retries automatically");
	assert.equal(writes, afterReloadPending, "automatic reload retry cannot duplicate damage");
});
