import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { woundLeaseId, woundRequestId } from "../module/wound-ids.mjs";

test("HTTP lease IDs match SHA-256 across padding boundaries and Unicode", () => {
	for (const uuid of ["Actor.base", "Scene.scene.Token.token.Actor.base", "Actor.é🐉", ...Array.from({ length: 257 }, (_, n) => "x".repeat(n))]) {
		const expected = createHash("sha256").update(`maelstrom-wounds:${uuid}`).digest("hex").slice(0, 16);
		assert.equal(woundLeaseId(uuid), expected, `UUID length ${uuid.length}`);
	}
});

test("request IDs need only getRandomValues, available on HTTP", (t) => {
	const crypto = globalThis.crypto;
	t.mock.method(globalThis, "crypto", { getter: true }, () => ({ getRandomValues: crypto.getRandomValues.bind(crypto) }));
	const ids = Array.from({ length: 100 }, () => woundRequestId());
	assert.ok(ids.every((id) => /^[0-9a-f]{32}$/.test(id)));
	assert.equal(new Set(ids).size, ids.length);
});
