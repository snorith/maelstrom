import { WoundOperationError } from "./wound-operations.mjs";

const attempts = new WeakMap();
const installed = new WeakSet();

/**
 * Core shows database errors before rejecting its Promise. Route only registered
 * journal creations through an acknowledgement handler which rejects expected ID
 * contention quietly. All other requests retain the original core dispatch.
 * Creation/validation/hooks/broadcast handling still run through core's backend.
 */
export function installWoundDatabaseTransport(SocketInterface) {
	if (installed.has(SocketInterface)) return;
	const original = SocketInterface.dispatch;
	SocketInterface.dispatch = function (event, request) {
		const operation = request?.operation;
		const attempt = attempts.get(operation);
		const record = operation?.data?.[0];
		if (event !== "modifyDocument" || request?.action !== "create" || request.type !== "Item"
			|| !attempt || operation.parentUuid !== attempt.parentUuid || operation.keepId !== true
			|| !Array.isArray(operation.data) || operation.data.length !== 1 || record?._id !== attempt.id
			|| record.flags?.maelstrom?.woundJournal?.request?.id !== attempt.requestId) {
			return original.call(this, event, request);
		}
		return new Promise((resolve, reject) => {
			game.socket.emit(event, request, (response) => {
				if (!response.error) return resolve(response);
				const error = new Error(response.error.message);
				if (response.error.stack) error.stack = response.error.stack;
				// Exact expected parent, collection and revision ID. Permission,
				// validation and unrelated duplicate-ID errors remain visible.
				if (error.message !== attempt.collision) globalThis.ui?.notifications?.error(error.message);
				reject(error);
			});
		});
	};
	installed.add(SocketInterface);
}

export async function createWoundRevision(actor, record) {
	installWoundDatabaseTransport(foundry.helpers.SocketInterface);
	const parent = actor.parent?.delta ?? actor;
	// Foundry 13.351/14.365 preserve this operation object through dispatch.
	// Keep correlation out of serializable options and other modules' hooks.
	const operation = { keepId: true, renderSheet: false };
	attempts.set(operation, {
		id: record._id, requestId: record.flags.maelstrom.woundJournal.request.id, parentUuid: parent.uuid,
		// Verified against both installed server versions; regression tests invoke
		// core's duplicate rejection so a wording change cannot silently pass.
		collision: `The _id [${record._id}] already exists within the parent collection: ${parent.documentName} [${parent.id}] items`
	});
	try {
		const created = await actor.createEmbeddedDocuments("Item", [record], operation);
		return created.some((item) => item.id === record._id);
	} finally { attempts.delete(operation); }
}

/** Read the legacy baseline from storage, never from a delayed client broadcast. */
export async function readWoundBaseline(actor) {
	const actorClass = CONFIG.Actor.documentClass;
	const token = actor.parent?.delta ? actor.parent : null;
	let tokenData;
	if (token) {
		const cls = CONFIG.Token.documentClass;
		// Embedded get returns the entire collection; filter locally. index:true
		// selects raw client results, not a projected embedded payload.
		const tokens = await cls.database.get(cls, { parent: token.parent, index: true });
		tokenData = tokens.find((entry) => entry._id === token.id);
		if (!tokenData || tokenData.actorLink || tokenData.actorId !== actor.id) throw new WoundOperationError("invalidActor");
	}
	const sources = await actorClass.database.get(actorClass, {
		query: { _id: actor.id }, index: true,
		indexFields: ["_id", "type", "system.wounds", "items.flags.maelstrom.woundJournal"]
	});
	const source = sources.find((entry) => entry._id === actor.id);
	if (!source || source.type !== "character") throw new WoundOperationError("invalidActor");
	const delta = tokenData?.delta?.system?.wounds;
	const system = foundry.utils.mergeObject({ wounds: source.system?.wounds ?? {} }, delta ? { wounds: delta } : {}, { inplace: false });
	// Apply the same migration and number cleaning as an ordinary character;
	// old worlds may still store pre-rewrite wound shapes or numeric strings.
	let baseline;
	try { baseline = new CONFIG.Actor.dataModels.character(system)._source.wounds; }
	catch { throw new WoundOperationError("invalidState"); }
	return {
		baseline: { wounds: [...baseline.wounds], bloodloss: baseline.bloodloss },
		overrides: delta ? {
			wounds: Object.hasOwn(delta, "wounds"), bloodloss: Object.hasOwn(delta, "bloodloss"),
			baseScopes: [`Actor.${actor.id}`, ...(source.items ?? []).map((item) => item.flags?.maelstrom?.woundJournal?.scope).filter(Boolean)]
		} : undefined
	};
}
