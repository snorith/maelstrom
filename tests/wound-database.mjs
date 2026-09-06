import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { createWoundRevision, installWoundDatabaseTransport, readWoundBaseline } from "../module/wound-database.mjs";
import { commitWoundRequest } from "../module/wound-journal.mjs";

const app = process.env.FOUNDRY_APP_PATH;
if (!app) throw new Error("Set FOUNDRY_APP_PATH to an installed Foundry v13/v14 app directory.");
const core = (file) => import(pathToFileURL(resolve(app, file)));
const { default: SocketInterface } = await core("client/helpers/socket-interface.mjs");
const utils = await core("common/utils/_module.mjs");
Object.defineProperty(Array.prototype, "filterJoin", { value(separator) { return this.filter(Boolean).join(separator); } });
globalThis.foundry = { helpers: { SocketInterface }, utils,
	data: { fields: await core("common/data/fields.mjs") },
	abstract: { TypeDataModel: (await core("common/abstract/type-data.mjs")).default,
		DataModel: (await core("common/abstract/data.mjs")).default } };
globalThis.game = { i18n: { localize: (s) => s } };
globalThis.CONFIG = {};
const { CharacterData } = await import("../module/data/character-data.mjs");
const errors = [];
globalThis.ui = { notifications: { error: (message) => errors.push(message) } };

async function coreCollision(parent, id) {
	const { default: ServerBackend } = await core("dist/database/backend/server-backend.mjs");
	const collection = new Map([[id, {}]]);
	collection.documentClass = {};
	const serverParent = { ...parent, getSublevel: () => ({}), getEmbeddedCollection: () => collection };
	try {
		await new ServerBackend()._createDocuments({ documentName: "Item", collectionName: "items" },
			{ parent: serverParent, data: [{ _id: id }], keepId: true }, {});
		assert.fail("installed core must reject an existing embedded ID");
	} catch (error) {
		assert.match(error.message, /already exists/);
		return error.message;
	}
}

test("expected revision collisions reject quietly through installed core dispatch; other errors remain visible", async () => {
	const actor = { id: "base", uuid: "Actor.base", documentName: "Actor" };
	const record = { _id: "1234567890abcdef", flags: { maelstrom: { woundJournal: { request: { id: "request-123456789" } } } } };
	const duplicate = await coreCollision(actor, record._id);
	let responseError = duplicate, emitted = 0;
	game.socket = { emit(_event, _request, ack) { emitted++; ack({ error: { message: responseError } }); } };
	actor.createEmbeddedDocuments = async (_type, data, options) => SocketInterface.dispatch("modifyDocument", {
		type: "Item", action: "create", operation: Object.assign(options, { data, parentUuid: actor.uuid })
	});
	installWoundDatabaseTransport(SocketInterface);
	const installed = SocketInterface.dispatch;
	installWoundDatabaseTransport(SocketInterface);
	assert.equal(SocketInterface.dispatch, installed, "idempotent installation");
	errors.length = 0;
	await assert.rejects(createWoundRevision(actor, record), { message: duplicate });
	assert.deepEqual(errors, [], "expected arbitration is not a user error");
	responseError = "Permission denied";
	await assert.rejects(createWoundRevision(actor, record), /Permission denied/);
	assert.deepEqual(errors, [responseError]);
	errors.length = 0;
	responseError = duplicate;
	await assert.rejects(SocketInterface.dispatch("modifyDocument", {
		type: "Item", action: "create", operation: { data: [record], keepId: true, parentUuid: actor.uuid }
	}), { message: duplicate });
	assert.deepEqual(errors, [duplicate], "unregistered requests retain original core behavior");
	assert.equal(emitted, 3, "never resend an error just to display it");
});

test("quiet collision still reaches journal re-read and preserves both competing operations", async () => {
	const actor = { id: "base", uuid: "Actor.base", documentName: "Actor" };
	const items = [], baseline = { wounds: Array(11).fill(0), bloodloss: 2 };
	const { readWoundJournal, nextWoundRevision } = await import("../module/wound-journal.mjs");
	let contend = true;
	game.socket = { emit(_event, request, ack) {
		const record = request.operation.data[0];
		if (contend) {
			contend = false;
			items.push(nextWoundRevision(readWoundJournal(items, actor.uuid, baseline), {
				id: "competing-request", senderId: "gm", operation: { type: "applyBleeding" }
			}));
			ack({ error: { message: `The _id [${record._id}] already exists within the parent collection: Actor [base] items` } });
		} else { items.push(record); ack({ result: [{ id: record._id }] }); }
	} };
	actor.createEmbeddedDocuments = async (_type, data, options) => (await SocketInterface.dispatch("modifyDocument", {
		type: "Item", action: "create", operation: Object.assign(options, { data, parentUuid: actor.uuid })
	})).result;
	errors.length = 0;
	await commitWoundRequest({ read: async () => ({ items, baseline }), canWrite: () => true,
		create: (record) => createWoundRevision(actor, record) }, actor.uuid,
	{ id: "request-after-race", senderId: "gm", operation: { type: "applyBleeding" } });
	assert.equal(readWoundJournal(items, actor.uuid, baseline).state.wounds[10], 4);
	assert.deepEqual(errors, []);
});

test("synthetic revision errors are scoped to their ActorDelta while unrelated requests run concurrently", async () => {
	const parent = { id: "token", uuid: "Scene.scene.Token.token.ActorDelta.token", documentName: "ActorDelta" };
	const actor = { id: "base", uuid: "Scene.scene.Token.token.Actor.base", parent: { delta: parent } };
	const record = { _id: "1234567890abcdef", flags: { maelstrom: { woundJournal: { request: { id: "token-request-id" } } } } };
	const duplicate = await coreCollision(parent, record._id);
	let acknowledge;
	game.socket = { emit(_event, request, ack) {
		if (request.operation.data) acknowledge = ack;
		else ack({ error: { message: duplicate } });
	} };
	actor.createEmbeddedDocuments = async (_type, data, options) => SocketInterface.dispatch("modifyDocument", {
		type: "Item", action: "create", operation: Object.assign(options, { data, parentUuid: parent.uuid })
	});
	errors.length = 0;
	const pending = assert.rejects(createWoundRevision(actor, record), { message: duplicate });
	await assert.rejects(SocketInterface.dispatch("modifyDocument", { type: "Item", action: "create", operation: {} }), { message: duplicate });
	assert.deepEqual(errors, [duplicate], "no global notification suppression during an in-flight revision");
	acknowledge({ error: { message: duplicate } });
	await pending;
	assert.deepEqual(errors, [duplicate]);
});

test("core document and backend creation preserve private operation identity without wire metadata", async () => {
	const { default: Document } = await core("common/abstract/document.mjs");
	const { default: Backend } = await core("common/abstract/backend.mjs");
	const actor = { id: "base", uuid: "Actor.base", documentName: "Actor", getEmbeddedCollection() {} };
	const record = { _id: "1234567890abcdef", flags: { maelstrom: { woundJournal: { request: { id: "private-attempt-id" } } } } };
	const duplicate = await coreCollision(actor, record._id);
	let supplied, wire;
	class CaptureBackend extends Backend {
		async _getParent(operation) { return operation.parent; }
		async _createDocuments(_cls, operation) {
			assert.equal(operation, supplied, "actual core create/configure must retain identity");
			operation.parentUuid = operation.parent.uuid;
			delete operation.parent;
			return SocketInterface.dispatch("modifyDocument", { type: "Item", action: "create", operation });
		}
	}
	const backend = new CaptureBackend();
	class ItemDocument extends Document {
		static get implementation() { return this; }
		static get database() { return backend; }
		static get documentName() { return "Item"; }
	}
	globalThis.getDocumentClass = () => ItemDocument;
	actor.createEmbeddedDocuments = function (...args) {
		supplied = args[2];
		assert.deepEqual(Object.keys(supplied).sort(), ["keepId", "renderSheet"]);
		return Document.prototype.createEmbeddedDocuments.apply(this, args);
	};
	game.socket = { emit(_event, request, ack) {
		wire = JSON.stringify(request);
		queueMicrotask(() => ack({ error: { message: duplicate } }));
	} };
	errors.length = 0;
	await assert.rejects(createWoundRevision(actor, record), { message: duplicate });
	assert.deepEqual(errors, [], "WeakMap registration survives actual core methods");
	assert.doesNotMatch(wire, /maelstromWoundAttempt/);
});

test("unexpected asynchronous error rejects even when notifications are unavailable", async () => {
	const actor = { id: "base", uuid: "Actor.base", documentName: "Actor" };
	const record = { _id: "1234567890abcdef", flags: { maelstrom: { woundJournal: { request: { id: "no-notifications" } } } } };
	actor.createEmbeddedDocuments = async (_type, data, operation) => SocketInterface.dispatch("modifyDocument", {
		type: "Item", action: "create", operation: Object.assign(operation, { data, parentUuid: actor.uuid })
	});
	game.socket = { emit(_event, _request, ack) { queueMicrotask(() => ack({ error: { message: "Storage error" } })); } };
	const notifications = ui.notifications;
	try {
		delete ui.notifications;
		await assert.rejects(createWoundRevision(actor, record), /Storage error/);
	} finally { ui.notifications = notifications; }
});

test("first baseline reads fresh server numerics and token overrides using real character cleaning", async () => {
	const source = { _id: "base", type: "character", system: { wounds: { wounds: ["9", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bloodloss: "3" } },
		items: [{ _id: "inherited", flags: { maelstrom: { woundJournal: { scope: "Actor.original" } } } }] };
	const actor = { id: "base", uuid: "Actor.base", _source: { system: { wounds: { wounds: Array(11).fill(0), bloodloss: 0 } } } };
	const requests = [];
	const { default: ServerBackend } = await core("dist/database/backend/server-backend.mjs");
	const server = new ServerBackend();
	// Run installed core's index projection and embedded flag filtering. Only
	// the underlying storage read is a fixture, not the projection selection.
	const serverActor = {
		_preGetOperation() {}, _onGetOperation() {}, async expandEmbedded() {},
		metadata: { compendiumIndexFields: ["_id", "name"] },
		hierarchy: { items: { model: { metadata: { compendiumIndexFields: ["_id", "name"] } } } },
		sublevel: { async find(query, { project }) {
			assert.equal(query._id, actor.id);
			assert.equal(project.system.wounds, 1);
			return [structuredClone(source)];
		} }
	};
	CONFIG.Actor = { dataModels: { character: CharacterData }, documentClass: { database: { get: async (_cls, options) => {
		requests.push(options);
		return server._getDocuments(serverActor, options, {});
	} } } };
	let result = await readWoundBaseline(actor);
	assert.equal(result.baseline.wounds[0], 9);
	assert.equal(result.baseline.bloodloss, 3);
	assert.ok(requests[0].indexFields.includes("system.wounds"), "world indexes need explicit numeric fields");
	const tokenSource = { _id: "token", actorId: "base", actorLink: false, delta: { system: { wounds: { bloodloss: "5" } } } };
	CONFIG.Token = { documentClass: { database: { get: async () => [structuredClone(tokenSource)] } } };
	actor.uuid = "Scene.scene.Token.token.Actor.base";
	actor.parent = { id: "token", delta: { _source: { system: {} } }, parent: { uuid: "Scene.scene" } };
	result = await readWoundBaseline(actor);
	assert.equal(result.baseline.wounds[0], 9, "fresh base value, not cached synthetic value");
	assert.equal(result.baseline.bloodloss, 5, "fresh override, not cached token delta");
	assert.deepEqual(result.overrides, { wounds: false, bloodloss: true, baseScopes: ["Actor.base", "Actor.original"] });
	tokenSource.actorLink = true;
	await assert.rejects(readWoundBaseline(actor), { code: "invalidActor" });
	// Keep the source contract checked against both installed versions.
	const backend = await readFile(resolve(app, "client/data/client-backend.mjs"), "utf8");
	assert.match(backend, /if \( operation.index \) return response.result/);
});
