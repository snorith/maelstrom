import { SYSTEM_ID } from "./constants.mjs";
import { validateWoundOperation, WoundOperationError } from "./wound-operations.mjs";
import { woundRequestId } from "./wound-ids.mjs";
import { commitWoundRequest, legacyTokenWoundOverrides } from "./wound-journal.mjs";

const CHANNEL = `system.${SYSTEM_ID}`;
const PROTOCOL = "wound-journal-v1";
const calls = new Map();
const unresolved = new Map();
const inFlight = new Set();
const retryTimers = new Map();
const codeError = (code) => new WoundOperationError(code);
const storageKey = () => `${SYSTEM_ID}.wounds.${game.world.id}.${game.user.id}`;
const canEdit = (actor, userId) => {
	const user = game.users.get(userId);
	return !!user?.active && actor.testUserPermission(user, "OWNER");
};
const changed = (actor) => Hooks.callAll("maelstromWoundStatus", actor);
const save = () => sessionStorage.setItem(storageKey(), JSON.stringify([...unresolved]));

export function woundStatus(actor) {
	if (actor.system?.woundJournalError) return "invalidJournal";
	return unresolved.has(actor.uuid) ? "pending" : !game.socket?.connected || !game.users?.activeGM ? "unavailable" : "ready";
}
export const pendingWoundOperation = (actor) => unresolved.get(actor.uuid)?.operation;

async function resolveActor(uuid) {
	if (typeof uuid !== "string" || uuid.length > 256 || uuid.startsWith("Compendium.")) return null;
	const actor = await fromUuid(uuid);
	return actor?.documentName === "Actor" && actor.type === "character" && actor.uuid === uuid ? actor : null;
}

/** Fetch through core's database queue, not a possibly stale client collection. */
async function readJournal(actor) {
	const cls = CONFIG.Item.documentClass;
	const items = await cls.database.get(cls, { parent: actor, index: true });
	const source = actor._source?.system?.wounds ?? actor.system.wounds;
	return { items, baseline: { wounds: [...source.wounds], bloodloss: source.bloodloss }, overrides: legacyTokenWoundOverrides(actor) };
}

async function receive(message, senderId) {
	if (!message || message.protocol !== PROTOCOL || typeof senderId !== "string") return;
	if (message.kind === "reply") {
		const call = calls.get(message.callId);
		if (!call || call.userId !== senderId || !game.users.get(senderId)?.isGM) return;
		calls.delete(message.callId);
		clearTimeout(call.timer);
		message.error ? call.reject(codeError(message.error)) : call.resolve(message.result);
		return;
	}
	if (message.kind !== "operation" || !game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
	if (typeof message.callId !== "string" || message.callId.length > 64) return;
	try {
		const actor = await resolveActor(message.actorUuid);
		if (!actor || !canEdit(actor, senderId)) return;
		const request = { id: message.request?.id, operation: message.request?.operation, senderId };
		const result = await commitWoundRequest({
			read: () => readJournal(actor),
			create: async (record) => {
				const created = await actor.createEmbeddedDocuments("Item", [record], { keepId: true, renderSheet: false });
				return created.some((item) => item.id === record._id);
			},
			canWrite: () => {
				if (!game.socket.connected || !game.user.isGM) throw codeError("retryableWrite");
				return canEdit(actor, senderId);
			}
		}, actor.uuid, request);
		reply(senderId, message.callId, { result });
	} catch (error) {
		reply(senderId, message.callId, { error: error.code ?? "retryableWrite" });
	}
}

function reply(userId, callId, data) {
	game.socket.emit(CHANNEL, { protocol: PROTOCOL, kind: "reply", callId, ...data }, { recipients: [userId] });
}

function rpc(actor, request) {
	if (!game.socket.connected || !canEdit(actor, game.user.id)) return Promise.reject(codeError("unavailable"));
	const userId = game.users.activeGM?.id;
	if (!userId) return Promise.reject(codeError("unavailable"));
	const callId = woundRequestId();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => { calls.delete(callId); reject(codeError("retryableWrite")); }, 15000);
		calls.set(callId, { resolve, reject, timer, userId });
		game.socket.emit(CHANNEL, { protocol: PROTOCOL, kind: "operation", callId, actorUuid: actor.uuid, request }, { recipients: [userId] });
	});
}

function scheduleRetry(actor) {
	if (retryTimers.has(actor.uuid) || !unresolved.has(actor.uuid)) return;
	retryTimers.set(actor.uuid, setTimeout(async () => {
		retryTimers.delete(actor.uuid);
		if (!game.socket.connected || !game.users.activeGM) return;
		try { await retryWoundOperation(actor); }
		catch (error) {
			if (["conflict", "invalidState", "invalidJournal", "legacyPending"].includes(error.code)) {
				globalThis.ui?.notifications?.warn(game.i18n.localize(`MAELSTROM.wounds.coordinator.${error.code}`));
			}
		}
	}, 2000));
}

function finish(actor, request, result) {
	if (unresolved.get(actor.uuid) !== request) return;
	unresolved.delete(actor.uuid);
	clearTimeout(retryTimers.get(actor.uuid));
	retryTimers.delete(actor.uuid);
	save();
	Hooks.callAll("maelstromWoundResult", actor, request.operation, result);
	changed(actor);
}

async function send(actor, request) {
	if (inFlight.has(actor.uuid)) throw codeError("pending");
	inFlight.add(actor.uuid);
	try {
		// Old unpublished lease requests cannot be blindly converted to new edits.
		if (request.protocol !== PROTOCOL) throw codeError("legacyPending");
		const result = await rpc(actor, request);
		if (!["committed", "rejected"].includes(result?.status) || result.id !== request.id) throw codeError("retryableWrite");
		finish(actor, request, result);
		if (result.error) throw codeError(result.error);
		return result;
	} catch (error) {
		if (unresolved.has(actor.uuid)) {
			if (["invalidOperation", "invalidRequest"].includes(error.code)) finish(actor, request, { status: "rejected", error: error.code });
			else if (!["invalidJournal", "invalidState", "requestIdReused", "permissionDenied", "legacyPending"].includes(error.code)) scheduleRetry(actor);
		}
		throw error;
	} finally { inFlight.delete(actor.uuid); changed(actor); }
}

export async function submitWoundOperation(actor, operation) {
	validateWoundOperation(operation);
	if (unresolved.has(actor.uuid)) throw codeError("pending");
	const request = { protocol: PROTOCOL, id: woundRequestId(), actorUuid: actor.uuid, operation };
	unresolved.set(actor.uuid, request);
	try { save(); } catch (error) { unresolved.delete(actor.uuid); throw error; }
	changed(actor);
	return send(actor, request);
}

export function retryWoundOperation(actor) {
	const request = unresolved.get(actor.uuid);
	if (!request) return Promise.resolve();
	return send(actor, request);
}

/** One-time handling for pending requests from the unreleased lease prototype. */
export async function discardWoundRequest(actor) {
	const request = unresolved.get(actor.uuid);
	if (!request || request.protocol === PROTOCOL || inFlight.has(actor.uuid) || !canEdit(actor, game.user.id)) throw codeError("pending");
	const confirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: game.i18n.localize("MAELSTROM.wounds.journal.legacyTitle") },
		content: `<p>${game.i18n.localize("MAELSTROM.wounds.journal.legacyConfirm")}</p>`
	});
	if (!confirmed) return false;
	finish(actor, request, { status: "rejected", error: "legacyPending" });
}

export function woundCoordinatorControls(actor) {
	const request = unresolved.get(actor.uuid);
	return { canResolveLegacyWounds: !!request && request.protocol !== PROTOCOL };
}

async function resumePending() {
	for (const uuid of unresolved.keys()) {
		const actor = await resolveActor(uuid);
		if (actor) scheduleRetry(actor);
	}
	changed(null);
}

export function registerWoundService() {
	try {
		for (const [uuid, request] of JSON.parse(sessionStorage.getItem(storageKey()) ?? "[]")) {
			if (request?.actorUuid === uuid) unresolved.set(uuid, request);
		}
	} catch { /* Invalid local data cannot confer write authority. */ }
	game.socket.on(CHANNEL, receive);
	game.socket.on("disconnect", () => {
		for (const pending of calls.values()) { clearTimeout(pending.timer); pending.reject(codeError("retryableWrite")); }
		calls.clear();
		changed(null);
	});
	game.socket.on("connect", resumePending);
	Hooks.on("userConnected", resumePending);
	game.maelstrom ??= {};
	game.maelstrom.wounds = { submit: submitWoundOperation, retry: retryWoundOperation, discard: discardWoundRequest };
	void resumePending();
}
