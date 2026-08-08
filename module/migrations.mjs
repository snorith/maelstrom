import { SYSTEM_ID } from "./maelstrom.mjs";

/**
 * Current world-level migration version. Bump when adding a new one-time
 * migration; each numbered step below runs at most once per world.
 */
export const MIGRATION_VERSION = 1;

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

	if (current < 1) await migrateWeaponOrderToSort();

	await game.settings.set(SYSTEM_ID, "systemMigrationVersion", MIGRATION_VERSION);
	console.log("Maelstrom | World migration complete");
}

/**
 * v1: the legacy system kept weapon ordering in `system.order` (spaced 0, 5, 10…).
 * Map it onto the core `sort` field (×1000 preserves relative order with room to
 * drag between). Deliberately ignores any existing core `sort` (v9 may have
 * auto-assigned one that never reflected the legacy order): the legacy `order`
 * is authoritative, and the systemMigrationVersion gate ensures this runs only
 * once, so post-migration manual sorting is never overwritten.
 *
 * Scope: world actors only. Compendium actors are not visited — this system
 * ships no packs, and user-created packs from the v9 era would need a manual
 * export/import anyway (recorded in the z/PLAN.md review ledger, round 3).
 */
async function migrateWeaponOrderToSort() {
	for (const actor of game.actors) {
		const updates = [];
		for (const item of actor.items) {
			if (item.type !== "weapon") continue;
			const legacyOrder = foundry.utils.getProperty(item, "_source.system.order");
			if (Number.isFinite(legacyOrder) && legacyOrder >= 0) {
				updates.push({ _id: item.id, sort: (legacyOrder + 1) * 1000 });
			}
		}
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
