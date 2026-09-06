import assert from "node:assert/strict";
import { test } from "node:test";
import { readWoundJournal, nextWoundRevision, projectWoundJournal } from "../module/wound-journal.mjs";

test("projection caches unchanged contents without cloning unrelated items, invalidates same-ID mutations", () => {
	const baseline = { wounds: Array(11).fill(0), bloodloss: 2 };
	const actor = { uuid: "Actor.cache", items: [] };
	const record = nextWoundRevision(readWoundJournal([], actor.uuid, baseline), {
		id: "projection-request", senderId: "gm", operation: { type: "applyBleeding" }
	});
	actor.items.push({ getFlag: () => undefined, toObject: () => { throw new Error("unrelated clone"); } });
	assert.equal(projectWoundJournal(actor, baseline), null);
	actor.items.push({ id: record._id, getFlag: (scope, key) => record.flags[scope][key] });
	const state = projectWoundJournal(actor, baseline);
	assert.equal(state.wounds[10], 2);
	assert.equal(projectWoundJournal(actor, baseline), state, "unchanged content reuses validated projection");
	record.flags.maelstrom.woundJournal.state.wounds[10] = 99;
	assert.throws(() => projectWoundJournal(actor, baseline), { code: "invalidJournal" });
	record.flags.maelstrom.woundJournal.state.wounds[10] = 2;
	assert.equal(projectWoundJournal(actor, baseline).wounds[10], 2);
	actor.items.pop();
	assert.equal(projectWoundJournal(actor, baseline), null, "deleting all records must not reuse stale head");
});
