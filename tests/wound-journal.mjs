import assert from "node:assert/strict";
import { test } from "node:test";
import { commitWoundRequest, readWoundJournal, nextWoundRevision, legacyTokenWoundOverrides } from "../module/wound-journal.mjs";

const baseline = { wounds: Array(11).fill(0), bloodloss: 2 };
const request = (id, operation = { type: "applyBleeding" }) => ({ id: id.padStart(16, "0"), senderId: "player", operation });
function fixture() {
	const items = [];
	const adapter = {
		read: async () => ({ items: structuredClone(items), baseline }), canWrite: () => true,
		create: async (record) => {
			await new Promise((done) => setImmediate(done));
			if (items.some((item) => item._id === record._id)) throw Error("duplicate");
			items.push(structuredClone(record)); return true;
		}
	};
	return { items, adapter, head: () => readWoundJournal(items, "Actor.a", baseline),
		submit: (r) => commitWoundRequest(adapter, "Actor.a", r) };
}

test("independent writers serialize immutable revisions and deduplicate the same request", async () => {
	const f = fixture();
	await Promise.all([f.submit(request("a")), f.submit(request("b")), f.submit(request("a"))]);
	assert.equal(f.items.length, 2);
	assert.equal(f.head().state.wounds[10], 4);
});

test("late old writer cannot replace newer revisions after a reload", async () => {
	const f = fixture();
	const late = nextWoundRevision(f.head(), request("late"));
	await f.submit(request("new"));
	await assert.rejects(f.adapter.create(late), /duplicate/);
	await f.submit(request("late"));
	assert.equal(f.head().state.wounds[10], 4);
});

test("lost commit acknowledgement resolves from history without another write", async () => {
	const f = fixture();
	const create = f.adapter.create;
	f.adapter.create = async (record) => { await create(record); throw Error("lost ack"); };
	assert.equal((await f.submit(request("a"))).status, "committed");
	await f.submit(request("a"));
	assert.equal(f.items.length, 1);
});

test("failed write may arrive after retry without double applying", async () => {
	const f = fixture();
	let delayed;
	const create = f.adapter.create;
	f.adapter.create = async (record) => { delayed = record; throw Error("uncertain"); };
	await assert.rejects(f.submit(request("a")), /retryableWrite/);
	f.adapter.create = create;
	await f.submit(request("a"));
	await f.submit(request("b"));
	await assert.rejects(create(delayed), /duplicate/);
	assert.equal(f.head().state.wounds[10], 4);
});

test("conflicts are durable outcomes, not retryable edits after values change again", async () => {
	const f = fixture();
	await f.submit(request("set", { type: "setWound", slot: 0, expectedValue: 0, value: 3 }));
	const stale = request("stale", { type: "setWound", slot: 0, expectedValue: 0, value: 5 });
	assert.equal((await f.submit(stale)).error, "conflict");
	await f.submit(request("reset", { type: "setWound", slot: 0, expectedValue: 3, value: 0 }));
	assert.equal((await f.submit(stale)).error, "conflict");
	assert.equal(f.head().state.wounds[0], 0);
	assert.equal(f.items.length, 3);
});

test("unlinked token snapshots inherited wounds then becomes independent; clone follows leaf", async () => {
	const f = fixture();
	await f.submit(request("base"));
	const tokenScope = "Scene.s.Token.t.Actor.a";
	const token = readWoundJournal(f.items, tokenScope, baseline);
	assert.equal(token.state.wounds[10], 2);
	const tokenRecord = nextWoundRevision(token, request("token"));
	await f.submit(request("base2"));
	const inherited = [...f.items, tokenRecord];
	assert.equal(readWoundJournal(inherited, tokenScope, baseline).state.wounds[10], 4);
	assert.equal(readWoundJournal(inherited, "Actor.clone", baseline).state.wounds[10], 4);
	await f.submit(request("base3"));
	assert.equal(readWoundJournal([...f.items, tokenRecord], tokenScope, baseline).state.wounds[10], 4);
});

test("missing revisions, forged state and reused request IDs fail closed", async () => {
	const f = fixture();
	await f.submit(request("a")); await f.submit(request("b"));
	assert.throws(() => readWoundJournal(f.items.slice(1), "Actor.a", baseline), /invalidJournal/);
	await assert.rejects(f.submit(request("a", { type: "healAll" })), /requestIdReused/);
	f.items[1].flags.maelstrom.woundJournal.state.wounds[10] = 900;
	assert.throws(f.head, /invalidJournal/);
});

test("permission revoked after read prevents creation", async () => {
	const f = fixture();
	let allowed = true;
	f.adapter.canWrite = () => allowed;
	f.adapter.read = async () => { allowed = false; return { items: [], baseline }; };
	await assert.rejects(f.submit(request("a")), /permissionDenied/);
	assert.equal(f.items.length, 0);
});

test("legacy token numeric overrides survive base journal adoption but not over copied token history", async () => {
	const f = fixture();
	await f.submit(request("base"));
	const oldToken = { wounds: [9, ...Array(10).fill(0)], bloodloss: 3 };
	const overrides = { wounds: true, bloodloss: false, baseScopes: ["Actor.a"] };
	assert.deepEqual(legacyTokenWoundOverrides({ parent: {
		baseActor: { uuid: "Actor.a", items: [] }, delta: { _source: { system: { wounds: { wounds: oldToken.wounds } } } }
	} }), overrides, "base scope is known even before its first revision broadcast");
	const head = readWoundJournal(f.items, "Scene.s.Token.old.Actor.a", oldToken, overrides);
	assert.equal(head.state.wounds[0], 9);
	assert.equal(head.state.bloodloss, 2);
	const record = nextWoundRevision(head, request("token"));
	const clone = readWoundJournal([...f.items, record], "Scene.s.Token.copy.Actor.a", oldToken, overrides);
	assert.equal(clone.state.wounds[10], 2, "copied token journal wins over its stale numeric baseline");
});
