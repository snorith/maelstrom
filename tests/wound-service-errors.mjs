import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";

const socket = new EventEmitter();
socket.connected = true;
const dispatch = socket.emit.bind(socket);
socket.emit = (channel, message) => {
	queueMicrotask(() => dispatch(channel, message, "gm"));
};
const gm = { id: "gm", isGM: true, active: true };
const users = new Map([[gm.id, gm]]);
users.activeGM = gm;
globalThis.game = { socket, users, user: gm, world: { id: "errors" }, i18n: { localize: (key) => key } };
const hooks = new EventEmitter();
globalThis.Hooks = { on: hooks.on.bind(hooks), callAll: hooks.emit.bind(hooks) };
const warnings = [];
globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };
let failSave = false;
globalThis.sessionStorage = { getItem: () => null, setItem() { if (failSave) throw new Error("storage denied"); } };
const actors = new Map();
globalThis.fromUuid = async (uuid) => actors.get(uuid);
globalThis.CONFIG = { Item: { documentClass: { database: { get: async (_cls, { parent }) => structuredClone(parent.records) } } } };
CONFIG.Actor = {
	documentClass: { database: { get: async (_cls, { query }) => [...actors.values()]
		.filter((actor) => actor.id === query._id).map((actor) => ({ _id: actor.id, type: actor.type, system: actor.serverSystem ?? actor.system })) } },
	dataModels: { character: class { constructor(data) { this._source = data; } } }
};
globalThis.foundry = { helpers: { SocketInterface: class { static dispatch() {} } }, utils: { mergeObject: (base) => structuredClone(base) } };
const service = await import("../module/wound-service.mjs");
service.registerWoundService();
let sequence = 0;
function actor() {
	const value = { id: `errors${++sequence}`, uuid: `Actor.errors${sequence}`, documentName: "Actor", type: "character", records: [],
		system: { wounds: { wounds: Array(11).fill(0), bloodloss: 2 } }, testUserPermission: () => true,
		async createEmbeddedDocuments(_type, data) {
			await new Promise(setImmediate);
			if (data.some((entry) => this.records.some((old) => old._id === entry._id))) throw new Error("duplicate ID");
			this.records.push(...data);
			return data.map((entry) => ({ id: entry._id }));
		} };
	actors.set(value.uuid, value);
	return value;
}

test("one GM serializes requests per actor, without serializing unrelated actors", async () => {
	const a = actor(), b = actor();
	let active = 0, max = 0, release;
	const gate = new Promise((resolve) => { release = resolve; });
	const create = a.createEmbeddedDocuments;
	a.createEmbeddedDocuments = async function (...args) {
		max = Math.max(max, ++active);
		await gate;
		try { return await create.apply(this, args); } finally { active--; }
	};
	const responses = [];
	const listener = (message) => { if (message.kind === "reply") responses.push(message); };
	socket.on("system.maelstrom", listener);
	for (let i = 0; i < 2; i++) dispatch("system.maelstrom", {
		protocol: "wound-journal-v1", kind: "operation", actorUuid: a.uuid, callId: `call${i}`,
		request: { id: `serialized-request-${i}`, operation: { type: "applyBleeding" } }
	}, "gm");
	await service.submitWoundOperation(b, { type: "applyBleeding" });
	assert.equal(active, 1, "second same-actor request must wait before reading/creating");
	release();
	while (responses.filter((message) => message.callId.startsWith("call")).length < 2) await new Promise(setImmediate);
	assert.equal(max, 1);
	assert.equal(a.records.length, 2);
	socket.off("system.maelstrom", listener);
});

test("invalid actor replies immediately and retained requests show blocked, not automatic retry", async () => {
	const a = actor();
	actors.delete(a.uuid);
	await assert.rejects(service.submitWoundOperation(a, { type: "healAll" }), { code: "invalidActor" });
	assert.equal(service.woundStatus(a), "blocked");
	assert.equal(service.woundCoordinatorControls(a).woundBlockReason, "MAELSTROM.wounds.coordinator.invalidActor");
	actors.set(a.uuid, a);
	await service.retryWoundOperation(a);
	assert.equal(service.woundStatus(a), "ready");
});

test("permission denial is blocked and retry retains the original operation", async () => {
	const a = actor();
	a.testUserPermission = () => false;
	const operation = { type: "applyBleeding" };
	await assert.rejects(service.submitWoundOperation(a, operation), { code: "permissionDenied" });
	assert.equal(service.woundStatus(a), "blocked");
	assert.equal(service.pendingWoundOperation(a), operation);
	a.testUserPermission = () => true;
	await service.retryWoundOperation(a);
	assert.equal(a.records.length, 1);
});

test("storage cleanup failure cannot turn a committed result into failure or skip hooks", async () => {
	const a = actor();
	const create = a.createEmbeddedDocuments;
	a.createEmbeddedDocuments = async function (...args) {
		const result = await create.apply(this, args);
		failSave = true;
		return result;
	};
	let completed = false;
	hooks.on("maelstromWoundResult", (target) => { if (target === a) completed = true; });
	try {
		assert.equal((await service.submitWoundOperation(a, { type: "healAll" })).status, "committed");
		assert.equal(completed, true);
		assert.equal(service.woundStatus(a), "ready");
		assert.ok(warnings.some((message) => message.endsWith("storageCleanup")));
	} finally { failSave = false; }
});

test("service initializes from stored values before their client broadcast and then freezes the baseline", async () => {
	const a = actor();
	a.serverSystem = { wounds: { wounds: Array(11).fill(0), bloodloss: 5 } };
	await service.submitWoundOperation(a, { type: "applyBleeding" });
	assert.equal(a.records[0].flags.maelstrom.woundJournal.baseline.bloodloss, 5);
	assert.equal(a.records[0].flags.maelstrom.woundJournal.state.wounds[10], 5);
	a.serverSystem.wounds.bloodloss = "invalid legacy value";
	await service.submitWoundOperation(a, { type: "applyBleeding" });
	assert.equal(a.records[1].flags.maelstrom.woundJournal.state.wounds[10], 10, "existing journal ignores mutable legacy numerics");
});
