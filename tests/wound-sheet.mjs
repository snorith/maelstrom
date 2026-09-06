import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";

class Sheet {
	constructor(actor) { this.actor = actor; this.isEditable = true; }
	async _onRender() {}
	render() {}
}
globalThis.foundry = {
	data: { fields: {} }, abstract: { TypeDataModel: class {} }, utils: {},
	applications: { api: { HandlebarsApplicationMixin: (cls) => cls }, sheets: { ActorSheetV2: Sheet } }
};
globalThis.Hooks = { on: () => 1, callAll() {} };
globalThis.ui = { notifications: { warn() {} } };
globalThis.sessionStorage = { getItem: () => null, setItem() {} };
const socket = new EventEmitter();
socket.connected = true;
const users = new Map([["gm", { id: "gm", active: true, isGM: true }], ["player", { id: "player", active: true }]]);
users.activeGM = users.get("gm");
globalThis.game = { socket, users, user: users.get("player"), world: { id: "sheet" }, i18n: { has: () => true, localize: (key) => key } };
const service = await import("../module/wound-service.mjs");
const { MaelstromCharacterSheet } = await import("../module/apps/actor-sheet.mjs");
service.registerWoundService();
let sequence = 0;

function fixture() {
	const receipts = [];
	const actor = {
		uuid: `Actor.sheet${++sequence}`, items: new Map(), testUserPermission: () => true,
		getFlag: () => receipts,
		applyWoundOperation: (operation) => {
			if (failHello) throw Object.assign(new Error("invalidOperation"), { code: "invalidOperation" });
			return service.submitWoundOperation(actor, operation);
		},
		sufferBleedingDamage: () => service.submitWoundOperation(actor, { type: "applyBleeding" })
	};
	let failHello = false, loseReply = false, operations = 0;
	socket.on("system.maelstrom", (message) => {
		if (message.actorUuid !== actor.uuid) return;
		let error, result;
		if (message.kind === "hello") {
			if (failHello) error = "unavailable";
			else result = { sessionId: "gm-session", issuedAt: Date.now() };
		} else if (message.kind === "operation") {
			if (!receipts.some((r) => r.id === message.request.id)) {
				operations++;
				receipts.push({ id: message.request.id });
			}
			if (loseReply) error = "retryableWrite";
			else result = { id: message.request.id, status: "committed" };
		} else return;
		queueMicrotask(() => socket.emit("system.maelstrom", {
			protocol: "wound-journal-v1", kind: "reply", callId: message.callId, error, result
		}, "gm"));
	});
	const sheet = new MaelstromCharacterSheet(actor);
	const render = async (value = "") => {
		const input = { name: "system.wounds.wounds.0", value, defaultValue: value, isConnected: true };
		sheet.element = { querySelectorAll: () => [input] };
		await sheet._onRender({}, {});
		return input;
	};
	return { sheet, render, operations: () => operations,
		failHello: (value) => { failHello = value; }, loseReply: (value) => { loseReply = value; } };
}

test("retrying bleeding cannot erase a draft from an earlier rejected numeric edit", async () => {
	const f = fixture();
	let input = await f.render();
	input.value = "7"; input.oninput();
	f.failHello(true);
	await f.sheet._onChangeForm({}, { target: input });
	f.failHello(false); f.loseReply(true);
	await MaelstromCharacterSheet.onBleedingDamage.call(f.sheet);
	f.loseReply(false);
	await MaelstromCharacterSheet.onRetryWounds.call(f.sheet);
	input = await f.render();
	assert.equal(input.value, "7", "unrelated retry must preserve the failed numeric draft");
	assert.equal(f.operations(), 1);
});

test("numeric retry clears only the submitted draft, not subsequent typing", async () => {
	const f = fixture();
	let input = await f.render();
	input.value = "7"; input.oninput();
	f.loseReply(true);
	await f.sheet._onChangeForm({}, { target: input });
	input.value = "8"; input.oninput();
	f.loseReply(false);
	await MaelstromCharacterSheet.onRetryWounds.call(f.sheet);
	input = await f.render("7");
	assert.equal(input.value, "8");
	assert.equal(f.operations(), 1);
});

test("restored draft submits on blur without native change, once only", async () => {
	const f = fixture();
	let input = await f.render();
	input.value = "7"; input.oninput();
	input.isConnected = false;
	assert.equal(input.onblur(), undefined, "detached rerender input must not submit");
	input = await f.render();
	assert.equal(input.value, "7");
	const change = f.sheet._onChangeForm({}, { target: input });
	await Promise.all([change, input.onblur()]);
	assert.equal(f.operations(), 1, "change plus blur must not double-submit");
	input = await f.render("7");
	input.value = "8"; input.oninput();
	input = await f.render("7");
	await input.onblur();
	assert.equal(f.operations(), 2, "programmatic restoration needs no subsequent keystroke");
});
