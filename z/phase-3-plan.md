# Phase 3 — Data models: implementation plan

**Goal:** TypeDataModel schemas for character/ability/weapon registered via
`CONFIG.*.dataModels`; all legacy shapes absorbed by `migrateData`; weapon
`order` → core `sort` via a one-time world migration.

## Files

- `module/data/character-data.mjs` — `CharacterData extends foundry.abstract.TypeDataModel`
- `module/data/ability-data.mjs`, `module/data/weapon-data.mjs`
- `module/migrations.mjs` — one-time world migration (weapon order→sort)
- `module/maelstrom.mjs` — register dataModels in init; run migration on ready (GM only)

## Key mechanics (traps to handle)

1. **`NumberField` casts `""` to 0** (`Number("") === 0`), so every legacy
   blank-string numeric (attribute temp, armour ar/penalty, age, as/ds) must be
   normalized to `null` in `migrateData` BEFORE field cleaning runs. "Blank temp"
   must stay null, not become a 0 override.
2. **wounds.wounds arrives as an object** `{0: n, 1: n, …}` from legacy data →
   coerce to an 11-slot array, non-finite → 0 (SPEC §7).
3. **`languages:` typo key** → copy to `languages` if present and target absent.
4. **Legacy `version`/`roll`/`test` keys**: ignored by schema (unknown keys are
   stripped at initialization) — no action needed beyond not declaring them.
5. **Weapon order→sort cannot live in migrateData** — `sort` is a *document* field,
   not system data. One-time GM migration on ready: for each actor, weapons with a
   finite legacy `_source.system.order` and default sort get
   `sort = order * 1000` (relative order preserved). Guarded by a world setting
   `maelstrom.systemMigrationVersion` (int, registered in init, hidden).
6. **Derived data** in `CharacterData.prepareDerivedData()` per SPEC §1.2, plus
   `isUnconscious`/`isDead` getters for the sheet.
7. hp stays a *persisted* SchemaField (token bar binding) but is recomputed every
   prepare.

## Verification

- `node --check` each .mjs (syntax)
- Fixture-driven dry run under mocked `foundry.*` is NOT attempted — migrateData is
  pure enough to eyeball + Phase 7 exercises it against real fixture data in Foundry

## Output

- 4 new/updated module files; PLAN.md phase 3 → DONE
