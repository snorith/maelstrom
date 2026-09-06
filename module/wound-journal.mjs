import { applyWoundOperation, validateWoundOperation, WoundOperationError } from "./wound-operations.mjs";
import { woundLeaseId } from "./wound-ids.mjs";

export const JOURNAL_FLAG = "woundJournal";
const fail = () => { throw new WoundOperationError("invalidJournal"); };
export const revisionId = (scope, revision) => woundLeaseId(`journal-v1:${scope}:${revision}`);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const projections = new WeakMap();

/** Local derived-data cache only; authoritative commit reads always replay. */
export function projectWoundJournal(actor, baseline) {
	if (!actor) return null;
	const items = [];
	for (const item of actor.items ?? []) {
		const entry = item.getFlag?.("maelstrom", JOURNAL_FLAG) ?? item.flags?.maelstrom?.[JOURNAL_FLAG];
		if (entry) items.push({ _id: item.id ?? item._id, flags: { maelstrom: { [JOURNAL_FLAG]: entry } } });
	}
	if (!items.length) { projections.delete(actor); return null; }
	const overrides = legacyTokenWoundOverrides(actor);
	// Compare complete contents, NOT just head ID: privileged edits, removals,
	// inherited changes and same-ID corruption must invalidate cached validation.
	const signature = JSON.stringify([actor.uuid, baseline.wounds, baseline.bloodloss, overrides, items]);
	const cached = projections.get(actor);
	if (cached?.signature === signature) return cached.state;
	const head = readWoundJournal(items, actor.uuid, baseline, overrides);
	const state = Object.freeze({ wounds: Object.freeze([...head.state.wounds]), bloodloss: head.state.bloodloss });
	projections.set(actor, { signature, state });
	return state;
}

export function validateJournalRequest(request) {
	if (!request || !/^[a-zA-Z0-9_-]{16,64}$/.test(request.id ?? "")
		|| typeof request.senderId !== "string" || !request.senderId) {
		throw new WoundOperationError("invalidRequest");
	}
	validateWoundOperation(request.operation);
}

function validState(state) {
	// The pure operation validates state without altering the input.
	applyWoundOperation(state, { type: "healAll" });
	return { wounds: [...state.wounds], bloodloss: state.bloodloss };
}

function outcome(state, operation) {
	try { return { state: applyWoundOperation(state, operation), error: null }; }
	catch (error) {
		if (error.code !== "conflict" && error.code !== "invalidState") throw error;
		return { state, error: error.code };
	}
}

/** Read and validate complete immutable streams, including inherited token history. */
export function readWoundJournal(items, scope, baseline, overrides) {
	const streams = new Map();
	for (const item of items) {
		const entry = item.flags?.maelstrom?.[JOURNAL_FLAG];
		if (!entry) continue;
		if (entry.version !== 1 || typeof entry.scope !== "string" || !entry.scope
			|| !Number.isSafeInteger(entry.revision) || entry.revision < 1
			|| item._id !== revisionId(entry.scope, entry.revision)) fail();
		if (!streams.has(entry.scope)) streams.set(entry.scope, []);
		streams.get(entry.scope).push(entry);
	}
	const heads = new Map();
	for (const [key, entries] of streams) {
		entries.sort((a, b) => a.revision - b.revision);
		let state;
		const requests = new Map();
		for (const [index, entry] of entries.entries()) {
			if (entry.revision !== index + 1) fail();
			validateJournalRequest(entry.request);
			if (requests.has(entry.request.id)) fail();
			if (index === 0) {
				if (entry.parentScope !== null && typeof entry.parentScope !== "string") fail();
				state = validState(entry.baseline);
			}
			const next = outcome(state, entry.request.operation);
			if (!equal(next.state, entry.state) || next.error !== entry.error) fail();
			state = next.state;
			requests.set(entry.request.id, entry);
		}
		heads.set(key, { scope: key, revision: entries.length, state,
			parentScope: entries[0].parentScope, requests });
	}
	if (heads.has(scope)) return heads.get(scope);
	// A clone/export or unlinked token starts from the inherited leaf stream.
	// Its first local revision snapshots that state; later base edits cannot change it.
	const parents = new Set([...heads.values()].map((head) => head.parentScope));
	const leaves = [...heads.values()].filter((head) => !parents.has(head.scope));
	if (leaves.length > 1 || (heads.size && !leaves.length)) fail();
	const inherited = leaves[0];
	let state = inherited?.state ?? validState(baseline);
	// A pre-journal token may already override one or both numeric fields.
	// Apply those only over history actually inherited from its current base actor,
	// never over a token journal imported/copied with the token itself.
	if (inherited && overrides?.baseScopes.includes(inherited.scope)) {
		state = validState({ wounds: overrides.wounds ? baseline.wounds : state.wounds,
			bloodloss: overrides.bloodloss ? baseline.bloodloss : state.bloodloss });
	}
	return { scope, revision: 0, state,
		parentScope: inherited?.scope ?? null, requests: new Map() };
}

export function legacyTokenWoundOverrides(actor) {
	const token = actor?.parent;
	const delta = token?.delta?._source?.system?.wounds;
	if (!delta) return undefined;
	const baseScopes = Array.from(token.baseActor?.items ?? [], (item) =>
		item.getFlag?.("maelstrom", JOURNAL_FLAG)?.scope ?? item.flags?.maelstrom?.[JOURNAL_FLAG]?.scope).filter(Boolean);
	// The server may have the base's first revision before its broadcast reaches us.
	if (token.baseActor?.uuid) baseScopes.push(token.baseActor.uuid);
	return { wounds: Object.hasOwn(delta, "wounds"), bloodloss: Object.hasOwn(delta, "bloodloss"), baseScopes };
}

export function journalResult(entry, request) {
	if (!equal(entry.request, request)) throw new WoundOperationError("requestIdReused");
	return { id: request.id, status: entry.error ? "rejected" : "committed", error: entry.error };
}

export function nextWoundRevision(head, request) {
	validateJournalRequest(request);
	const next = outcome(head.state, request.operation);
	const revision = head.revision + 1;
	if (!Number.isSafeInteger(revision)) fail();
	return {
		_id: revisionId(head.scope, revision), type: "equipment", name: `Wound revision ${revision} (internal)`,
		flags: { maelstrom: { [JOURNAL_FLAG]: {
			version: 1, scope: head.scope, revision, request: structuredClone(request),
			...(revision === 1 ? { baseline: head.state, parentScope: head.parentScope } : {}),
			state: next.state, error: next.error
		} } }
	};
}

/** Competing/late writers can only create the same next immutable revision. */
export async function commitWoundRequest({ read, create, canWrite }, scope, request) {
	validateJournalRequest(request);
	for (let attempt = 0; attempt < 16; attempt++) {
		if (!await canWrite()) throw new WoundOperationError("permissionDenied");
		const { items, baseline, overrides } = await read();
		const head = readWoundJournal(items, scope, baseline, overrides);
		const existing = head.requests.get(request.id);
		if (existing) return journalResult(existing, request);
		const proposed = nextWoundRevision(head, request);
		if (!await canWrite()) throw new WoundOperationError("permissionDenied");
		try {
			const created = await create(proposed);
			if (created) return journalResult(proposed.flags.maelstrom[JOURNAL_FLAG], request);
		} catch { /* Read through the database to distinguish collision/lost reply. */ }
		const fresh = await read();
		const latest = readWoundJournal(fresh.items, scope, fresh.baseline, fresh.overrides);
		if (latest.requests.has(request.id)) return journalResult(latest.requests.get(request.id), request);
		// Missing result is not proof of failure: the proposed creation may arrive
		// later. A retry will reuse the same request ID and the same next revision.
		if (latest.revision === head.revision) throw new WoundOperationError("retryableWrite");
	}
	throw new WoundOperationError("retryableWrite");
}
