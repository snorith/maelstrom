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
	const step1FailedActorIds = current < 1 ? await migrateWeaponOrderToSort() : null;
	if (current < 2) ok = await migrateWeaponOrderStep2(current, step1FailedActorIds);

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
 * Returns the ids of actors whose batch update failed (for step 2's same-load repair).
 */
async function migrateWeaponOrderToSort() {
	const failedActorIds = new Set();
	for (const actor of game.actors) {
		const updates = actor.items.map((i) => legacyOrderToSort(i, { onlyUnsorted: false })).filter(Boolean);
		if (updates.length > 0) {
			try {
				await actor.updateEmbeddedDocuments("Item", updates);
				console.log(`Maelstrom | Migrated weapon order for actor "${actor.name}" (${updates.length} items)`);
			} catch (err) {
				failedActorIds.add(actor.id);
				console.error(`Maelstrom | Weapon order migration failed for actor "${actor.name}"`, err);
			}
		}
	}
	return failedActorIds;
}

/**
 * v2: widen the order→sort surface that step 1 missed.
 *  (a) Rescan world actors — repairs actors step 1 caught-and-skipped.
 *      Fresh run (entry version 0): step 1 just ran in this load, so the
 *      rescan touches ONLY the actors whose step-1 batch actually failed,
 *      unguarded — actors that succeeded are never re-written, which also
 *      closes the race where a GM re-sorts mid-migration (nothing awaits
 *      migrateWorld). Entering at v1 (previous session ran step 1): rescan
 *      every actor WITH the sort guard, so manual re-sorts made since are
 *      never clobbered — weapons a failed step 1 left with a positive v9
 *      auto-sort then stay unrepaired; accepted residual, and in practice
 *      no pre-fix v1.0.0 build could load far enough to stamp v1.
 *  (b) Standalone world items (game.items) — first touch, legacy order
 *      authoritative, no guard.
 *  (c) Unlinked scene tokens: iterate the RAW delta source records
 *      (token.delta._source.items) — never the merged collection, whose
 *      contents differ between readings of the v13 API; updating an
 *      inherited base-actor item through the synthetic actor would adopt it
 *      into the delta and permanently de-link it. Raw records are by
 *      definition delta-stored, and reading plain data avoids any DataModel
 *      shape assumption. Persistence via the synthetic actor writes through
 *      to the delta (v13).
 * User compendia are NOT migrated (documented limitation, see README).
 * Returns true only if every collection migrated without error.
 */
async function migrateWeaponOrderStep2(entryVersion, step1FailedActorIds) {
	let ok = true;

	// (a) world-actor rescan (see doc comment above for the two modes)
	const freshRun = entryVersion < 1;
	const onlyUnsorted = !freshRun;
	for (const actor of game.actors) {
		if (freshRun && !step1FailedActorIds?.has(actor.id)) continue;
		const updates = actor.items.map((i) => legacyOrderToSort(i, { onlyUnsorted })).filter(Boolean);
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

	// (c) unlinked scene-token deltas — RAW delta source records only
	for (const scene of game.scenes) {
		for (const token of scene.tokens) {
			if (token.actorLink || !token.actor) continue;
			const rawDeltaItems = token.delta?._source?.items ?? [];
			const updates = [];
			for (const record of rawDeltaItems) {
				if (record?.type !== "weapon") continue;
				const legacyOrder = record?.system?.order;
				if (Number.isFinite(legacyOrder) && legacyOrder >= 0) {
					updates.push({ _id: record._id, sort: (legacyOrder + 1) * 1000 });
				}
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
