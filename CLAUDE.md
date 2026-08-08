# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An unofficial **Foundry VTT game system** for the Maelstrom RPG (Domesday / Gothic / Rome),
targeting **Foundry v13 (13.347+) and v14**. Rewritten in 2026 from a Foundry-v9 codebase —
the rewrite's plan, behavioral spec, and manual QA checklist live in `z/` (see `z/PLAN.md`
and `z/SPEC.md`; `z/SPEC.md` is the contract for what the system must do).

**There is no build step.** The repository root IS the system directory: Foundry loads
`module/*.mjs` (plain ES modules), `styles/maelstrom.css` (plain CSS, native nesting),
`templates/*.hbs`, and `lang/en.json` directly. No TypeScript, no SASS, no bundler, no
`node_modules` needed to run.

## Commands

```shell
node --check module/**/*.mjs      # the only "compile" check that exists
mise install                      # node 24 — needed only for release tooling/scripts
```

There is no test framework. Verification is: `node --check`, the static audit pattern in
`z/phase-7-plan.md` (actions ↔ handlers, lang keys, field paths, PARTS paths), and the
manual checklist `z/phase-7-checklist.md` run inside Foundry.

To develop: symlink or clone this repo as `<FoundryUserData>/Data/systems/maelstrom`
(directory name must be exactly `maelstrom`), edit, reload Foundry (F5). See README_DEV.md.

## Architecture

Entry: `system.json` → `esmodules: ["module/maelstrom.mjs"]`, whose single `init` hook
registers everything: data models (`CONFIG.*.dataModels`), document classes, sheets,
settings. `migrateWorld()` runs on `ready` (GM only).

- **Data schemas**: `module/data/*-data.mjs` — `TypeDataModel` subclasses. Types are
  declared in `system.json` `documentTypes` (no template.json — deprecated in v14).
  `CharacterData.prepareDerivedData()` computes `attributes.*.current`, `hp.*`
  (max = endurance + 20; wounds = sum of the 11-slot array whose LAST slot is bloodloss
  damage). `hp` is persisted schema so token bars can bind to it, but always recomputed.
- **Legacy migration**: two layers. Per-document shape fixes in each model's static
  `migrateData` (runs automatically on load AND on update deltas — this is why wound
  inputs submitting `{0:…,10:…}` objects get coerced to arrays). One-time world-level
  fixes in `module/migrations.mjs` gated by the hidden `systemMigrationVersion` world
  setting (e.g. legacy weapon `system.order` → core `sort`, read from `_source`).
  `migrateData` must stay idempotent; blank-string numerics must become `null` BEFORE
  NumberField cleaning (`Number("") === 0` would turn "no value" into a 0 override).
- **Documents**: `module/documents/actor.mjs` owns the roll flows; the pure rules
  (d100 outcome banding, modifier stacking with floor-at-0) are in `module/rolls.mjs`
  with no Foundry imports — keep them pure, they're node-testable. Roll banding:
  ≥96 fails (critical fail only if target ≤90); ≤ floor(target/10) crits.
- **Sheets**: ApplicationV2 + `HandlebarsApplicationMixin` (`module/apps/`). PARTS per
  template file, `static TABS` + `_prepareTabs("primary")`, declarative `actions` map
  instead of listeners — a `data-action` in a template MUST have a matching entry in
  the sheet's actions (the Phase 7 audit checks this). ALL display logic (zero-blank
  numbers, flavour label swap, tooltip HTML, sorted item lists) is computed in
  `_prepareContext` — there are deliberately NO custom Handlebars helpers.
- **Drag-sort**: weapon rows rely on ActorSheetV2's built-in drag/drop — `class="draggable"`
  + `data-item-id` is the entire wiring. Don't add manual DragDrop.
- **Dialogs**: `DialogV2` only (`module/apps/modifiers-dialog.mjs` uses
  `DialogV2.wait` with `rejectClose: false` so dismissal = cancel).

## Conventions and constraints

- **No jQuery, no external assets** (fonts included), no `@ts-ignore`-era idioms —
  `actor.system`, namespaced APIs (`foundry.documents.collections.Actors`,
  `foundry.applications.ux.TextEditor`), async `roll.evaluate()`.
- CSS is scoped under `.maelstrom`, colors ride v13 theme variables (works in
  `.theme-dark`); deliberately unlayered so it wins over core's `@layer` styles.
  Never set `display` on `.tab` sections — core toggles their visibility.
- `lang/en.json`: add keys, never repurpose existing ones.
- Game flavour (world setting `characterSheet`: 1 Domesday / 2 Gothic / 3 Rome) only
  swaps the Favour/Renown label today, but keep new flavour logic keyed on it.
- The Arion Games trademark/legal text (module header, settings hint, README) must be
  preserved verbatim **per location as inherited from v0.3.3** — the README's public
  wording has always differed slightly from the module header; that divergence is
  historical, not an error to "fix".

## Releasing

Bump `version` in `system.json` (keep `package.json` in sync), commit, tag `v<version>`,
push the tag. `.github/workflows/release.yml` verifies tag == manifest version, stamps
`download`/`manifest` URLs, zips the system (archive root = system root), and publishes a
GitHub Release. The installable manifest URL is
`https://github.com/snorith/maelstrom/releases/latest/download/system.json`.

**Do not delete `src/system.json`.** It is a tombstone: every pre-1.0 install polls that
raw-GitHub path for updates. It carries BOTH legacy (`minimumCoreVersion`) and modern
(`compatibility`) keys so old Foundry clients refuse the incompatible update while v13+
clients migrate to the Releases update channel. It is not part of the installed system.
