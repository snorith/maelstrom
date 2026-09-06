import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { woundRequestId } from "../../module/wound-ids.mjs";
import { readWoundJournal } from "../../module/wound-journal.mjs";
// Simulate plain-HTTP browser capability for the entire real adapter.
const randomValues = crypto.getRandomValues.bind(crypto);
Object.defineProperty(globalThis, "crypto", { value: { getRandomValues: randomValues }, configurable: true });
const require = createRequire(resolve(workerData.app, "package.json"));
const { io } = require("socket.io-client");
let socket;
if (workerData.network) {
	socket = io(workerData.url, { auth: { userId: workerData.userId }, transports: ["websocket"] });
	await new Promise((done) => socket.on("connect", done));
} else {
	socket = new EventEmitter();
	socket.connected = true;
	const incoming = socket.emit.bind(socket);
	const acknowledgements = new Map();
	let nextAck = 0;
	socket.emit = (event, ...args) => {
		let ackId;
		if (typeof args.at(-1) === "function") {
			ackId = ++nextAck;
			acknowledgements.set(ackId, args.pop());
		}
		parentPort.postMessage({ socketSend: event, args, ackId });
	};
	socket.disconnect = () => { socket.connected = false; socket.emit("disconnect"); incoming("disconnect"); };
	socket.connect = () => { socket.connected = true; socket.emit("fixtureReconnect"); incoming("connect"); };
	parentPort.on("message", (message) => {
		if (message.socketEvent) incoming(message.socketEvent, ...message.args);
		if (message.ackId) { acknowledgements.get(message.ackId)?.(...message.args); acknowledgements.delete(message.ackId); }
	});
}
const actors = new Map();
const storage = new Map(workerData.storage ?? []);
globalThis.sessionStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) };
globalThis.Hooks = { callAll() {}, on() {} };
globalThis.foundry = { applications: { api: { DialogV2: { confirm: async () => true } } } };
const users = new Map(workerData.users.map((user) => [user.id, user]));
users.activeGM = users.get("gm");
globalThis.game = {
	user: users.get(workerData.userId), users, socket, world: { id: "test" },
	i18n: { localize: (key) => key }
};
const write = (event, data) => new Promise((done, reject) => socket.emit(event, data,
	(response) => response.error ? reject(new Error(response.error)) : done(response.result)));
const itemClass = { database: { get: (_cls, { parent }) => write("fixtureRead", { uuid: parent.uuid }) } };
globalThis.CONFIG = { Item: { documentClass: itemClass } };
function sync(state) {
	for (const [uuid, record] of Object.entries(state)) {
		let actor = actors.get(uuid);
		if (!actor) {
			actor = {
				uuid, documentName: "Actor", type: "character",
				testUserPermission: (user) => user.isGM || user.id === "player",
				getFlag: (scope, key) => actor.flags?.[scope]?.[key],
				update: async (data) => { await write("fixtureUpdate", { uuid, data }); return actor; },
				createEmbeddedDocuments: async (_type, data) => {
					await write("fixtureCreate", { uuid, data });
					return data.map((item) => actor.items.get(item._id));
				}
			};
			actors.set(uuid, actor);
		}
		actor.system = structuredClone(record.system);
		actor.flags = structuredClone(record.flags);
		const head = readWoundJournal(record.items, uuid, actor.system.wounds);
		actor.system.wounds = structuredClone(head.state);
		actor.items = new Map(record.items.map((data) => [data._id, {
			id: data._id,
			getFlag: (scope, key) => data.flags?.[scope]?.[key],
			delete: () => write("fixtureDelete", { uuid, id: data._id })
		}]));
	}
}
sync(workerData.state);
socket.on("fixtureState", sync);
globalThis.fromUuid = async (uuid) => actors.get(uuid);
globalThis.fromUuidSync = (uuid) => actors.get(uuid);
const service = await import("../../module/wound-service.mjs");
service.registerWoundService();
parentPort.on("message", async ({ id, action, uuid = "Actor.base", operation }) => {
	if (!action) return;
	try {
		const actor = actors.get(uuid);
		let result;
		if (action === "submit") result = await service.submitWoundOperation(actor, operation ?? { type: "applyBleeding" });
		if (action === "retry") result = await service.retryWoundOperation(actor);
		if (action === "storage") result = [...storage];
		if (action === "status") result = service.woundStatus(actor);
		if (action === "spoof") {
			result = await new Promise((done) => socket.emit("system.maelstrom", {
				protocol: "wound-journal-v1", kind: "operation", callId: woundRequestId(), actorUuid: actor.uuid,
				senderId: "gm", request: { id: woundRequestId(), actorUuid: actor.uuid,
					issuedAt: Date.now(), operation: { type: "applyBleeding" } }
			}, { recipients: ["gm"] }, done));
		}
		if (action === "disconnect") socket.disconnect();
		if (action === "reconnect") {
			if (!socket.connected) await new Promise((done) => { socket.once("connect", done); socket.connect(); });
		}
		parentPort.postMessage({ id, result });
	} catch (error) { parentPort.postMessage({ id, error: error.code ?? error.message }); }
});
parentPort.postMessage({ ready: true });
