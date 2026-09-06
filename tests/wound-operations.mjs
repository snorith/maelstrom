import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWoundOperation, validateWoundOperation, WoundOperationError } from "../module/wound-operations.mjs";

const initial = () => ({ wounds: [4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0], bloodloss: 2 });
const failsWith = (code) => (error) => error instanceof WoundOperationError && error.code === code;

test("successive bleeding operations accumulate without mutating input", () => {
	const original = initial();
	const first = applyWoundOperation(original, { type: "applyBleeding" });
	const second = applyWoundOperation(first, { type: "applyBleeding" });
	assert.equal(second.wounds[10], 4);
	assert.equal(first.wounds[10], 2);
	assert.deepEqual(original, initial());
});

test("heal and bleed preserve their accepted order", () => {
	const run = (types) => types.reduce((state, type) => applyWoundOperation(state, { type }), initial());
	assert.deepEqual(run(["healAll", "applyBleeding"]).wounds, [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
	assert.equal(run(["applyBleeding", "healAll"]).wounds[10], 1);
});

test("manual edits to different slots both survive", () => {
	const first = applyWoundOperation(initial(), { type: "setWound", slot: 0, expectedValue: 4, value: 7 });
	const next = applyWoundOperation(first, { type: "setWound", slot: 1, expectedValue: 2, value: 8 });
	assert.deepEqual(next.wounds.slice(0, 2), [7, 8]);
});

test("stale same-slot edits conflict rather than overwrite", () => {
	const updated = applyWoundOperation(initial(), { type: "setWound", slot: 0, expectedValue: 4, value: 7 });
	assert.throws(() => applyWoundOperation(updated,
		{ type: "setWound", slot: 0, expectedValue: 4, value: 9 }), failsWith("conflict"));
	assert.equal(updated.wounds[0], 7);
});

test("bleeding uses the accepted count and stale count edits conflict", () => {
	const updated = applyWoundOperation(initial(), { type: "setBleedingCount", expectedValue: 2, value: 3 });
	assert.equal(applyWoundOperation(updated, { type: "applyBleeding" }).wounds[10], 3);
	assert.throws(() => applyWoundOperation(updated,
		{ type: "setBleedingCount", expectedValue: 2, value: 4 }), failsWith("conflict"));
});

test("blank and zero have the same conflict semantics", () => {
	const updated = applyWoundOperation(initial(), { type: "setWound", slot: 2, expectedValue: null, value: null });
	assert.equal(updated.wounds[2], null);
	assert.equal(applyWoundOperation(updated,
		{ type: "setWound", slot: 2, expectedValue: 0, value: 3 }).wounds[2], 3);
});

test("request validation rejects missing expectations, bad slots, nonfinite values and extra write paths", () => {
	for (const operation of [null, [], {}, { type: "unknown" },
		{ type: "healAll", target: "another actor" },
		{ type: "setWound", slot: 0, value: 3 },
		...[-1, 11, 1.5, "0"].map((slot) => ({ type: "setWound", slot, expectedValue: 0, value: 3 })),
		...[undefined, NaN, Infinity, "3"].map((value) => ({ type: "setBleedingCount", expectedValue: 2, value }))]) {
		assert.throws(() => validateWoundOperation(operation), failsWith("invalidOperation"));
	}
});

test("malformed state and arithmetic overflow cannot produce a wound write", () => {
	for (const wounds of [[], Array(11), [...Array(10).fill(0), Infinity]]) {
		assert.throws(() => applyWoundOperation({ wounds, bloodloss: 2 }, { type: "healAll" }), failsWith("invalidState"));
	}
	assert.throws(() => applyWoundOperation({ wounds: Array(11).fill(Number.MAX_VALUE), bloodloss: 2 },
		{ type: "applyBleeding" }), failsWith("invalidState"));
});
