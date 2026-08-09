import { SYSTEM_ID } from "./constants.mjs";

/**
 * Current world-level migration version. Bump when adding a new one-time
 * migration; each numbered step below runs at most once per world.
 */
export const MIGRATION_VERSION = 2;

export function registerMigrationSetting() {
	game.settings.register(SYSTEM_ID, "systemMigrationVersion", {
		name: "System migration version",
		scope: "world",
		config: false,
		type: Number,
		default: 0
	});
}

/**
 * One-time world migrations (GM only). Per-document shape fixes live in the data
 * models' migrateData; this handles what migrateData cannot touch — core document
 * fields like Item#sort.
 */
export async function migrateWorld() {
	if (!game.user.isGM) return;
	const current = game.settings.get(SYSTEM_ID, "systemMigrationVersion");
	if (current >= MIGRATION_VERSION) return;

	console.log(`Maelstrom | Running world migration ${current} → ${MIGRATION_VERSION}`);

	let ok = true;
	if (current < 1) await migrateWeaponOrderToSort();
	if (current < 2) ok = (await migrateWeaponOrderStep2()) && ok;

	// Step 2 advances only on full success so a failed collection retries on the
	// next world load (all order→sort writes are idempotent).
	if (ok) {
		await game.settings.set(SYSTEM_ID, "systemMigrationVersion", MIGRATION_VERSION);
		console.log("Maelstrom | World migration complete");
	} else {
		console.warn("Maelstrom | World migration partially failed; it will retry on next load");
	}
}

/** Map a legacy order value onto core sort (×1000 preserves relative order). */
function legacyOrderToSort(item, { onlyUnsorted }) {
	if (item.type !== "weapon") return null;
	const legacyOrder = foundry.utils.getProperty(item, "_source.system.order");
	if (!Number.isFinite(legacyOrder) || legacyOrder < 0) return null;
	if (onlyUnsorted && item.sort) return null;
	return { _id: item.id, sort: (legacyOrder + 1) * 1000 };
}

/**
 * v1 (shipped in 1.0.0): the legacy system kept weapon ordering in
 * `system.order` (spaced 0, 5, 10…). Map it onto the core `sort` field for
 * world-actor items. Deliberately ignores any existing core `sort` (v9 may have
 * auto-assigned one that never reflected the legacy order): the legacy `order`
 * is authoritative on first touch. Historical behavior preserved as-is,
 * including advance-on-partial-failure — step 2 repairs what this step missed.
 */
async function migrateWeaponOrderToSort() {
	for (const actor of game.actors) {
		const updates = actor.items.map((i) => legacyOrderToSort(i, { onlyUnsorted: false })).filter(Boolean);
		if (updates.length > 0) {
			try {
				await actor.updateEmbeddedDocuments("Item", updates);
				console.log(`Maelstrom | Migrated weapon order for actor "${actor.name}" (${updates.length} items)`);
			} catch (err) {
				console.error(`Maelstrom | Weapon order migration failed for actor "${actor.name}"`, err);
			}
		}
	}
}

/**
 * v2: widen the order→sort surface that step 1 missed.
 *  (a) Rescan world actors WITH the sort guard — repairs actors step 1
 *      caught-and-skipped after advancing the setting, without clobbering
 *      manual re-sorts done since.
 *  (b) Standalone world items (game.items) — first touch, legacy order
 *      authoritative, no guard.
 *  (c) Unlinked scene tokens' DELTA-STORED items only (token.delta.items):
 *      pass-through base-actor items are covered by (a); persistence goes
 *      through the synthetic actor, which v13 writes into the token delta.
 * User compendia are NOT migrated (documented limitation, see README).
 * Returns true only if every collection migrated without error.
 */
async function migrateWeaponOrderStep2() {
	let ok = true;

	// (a) world-actor rescan, guarded
	for (const actor of game.actors) {
		const updates = actor.items.map((i) => legacyOrderToSort(i, { onlyUnsorted: true })).filter(Boolean);
		if (updates.length === 0) continue;
		try {
			await actor.updateEmbeddedDocuments("Item", updates);
			console.log(`Maelstrom | Repaired weapon order for actor "${actor.name}" (${updates.length} items)`);
		} catch (err) {
			ok = false;
			console.error(`Maelstrom | Weapon order repair failed for actor "${actor.name}"`, err);
		}
	}

	// (b) standalone world items, unguarded (never touched before)
	try {
		for (const item of game.items) {
			const update = legacyOrderToSort(item, { onlyUnsorted: false });
			if (update) await item.update({ sort: update.sort });
		}
	} catch (err) {
		ok = false;
		console.error("Maelstrom | Weapon order migration failed for world items", err);
	}

	// (c) unlinked scene-token deltas, delta-stored items only
	for (const scene of game.scenes) {
		for (const token of scene.tokens) {
			if (token.actorLink || !token.actor) continue;
			const deltaItems = token.delta?.items ?? [];
			const updates = [];
			for (const item of deltaItems) {
				const update = legacyOrderToSort(item, { onlyUnsorted: false });
				if (update) updates.push(update);
			}
			if (updates.length === 0) continue;
			try {
				await token.actor.updateEmbeddedDocuments("Item", updates);
				console.log(`Maelstrom | Migrated weapon order for token "${token.name}" on scene "${scene.name}" (${updates.length} items)`);
			} catch (err) {
				ok = false;
				console.error(`Maelstrom | Weapon order migration failed for token "${token.name}" on scene "${scene.name}"`, err);
			}
		}
	}

	return ok;
}
