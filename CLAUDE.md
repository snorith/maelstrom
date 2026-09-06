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

Regressions use Node's built-in test runner with installed Foundry v13/v14 fields
and custom-socket forwarding: `FOUNDRY_APP_PATH=/path/to/resources/app node --test tests/*.mjs`.
Worker clients and database transport/sheet enrichment fixtures do not
replace live-world verification. Further verification is: `node --check`, the static audit pattern in
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
  WeaponData deliberately retains nullable `order`: v14 prunes undeclared source
  keys before ready. Successful sort writes atomically clear it to null so retries
  cannot undo subsequent manual sorting. Already-stamped worlds require explicit
  recovery (README_DEV.md), not an automatic migration-version reset.
  `migrateData` must stay idempotent; blank-string numerics must become `null` BEFORE
  NumberField cleaning (`Number("") === 0` would turn "no value" into a 0 override).
  On v14 `cleanData` runs BEFORE `_preUpdate`: Actor.cleanData merges partial wound
  objects using the cleaning source before system migration converts them to arrays.
  v13 migrates even before cleaning, so the instance Actor.update override preserves
  raw indexed edits as well. `_preUpdate` is only a compatibility fallback.
  On v14 synthetic actor.update also runs Actor.cleanData before the outgoing
  request is rewritten to ActorDelta. Live synthetic-token persistence still needs QA.
- **Wound coordination**: `wound-journal.mjs` owns immutable revision streams and
  request deduplication; `wound-service.mjs` supplies authenticated GM socket transport,
  server-backed reads, and durable in-tab requests with automatic retry.
  A fixed embedded equipment-item ID claims each next actor-scoped revision.
  Core serialized duplicate-ID rejection arbitrates competing/late writers.
  Never persist an asynchronously computed wound snapshot back to Actor.system:
  journal history is authoritative, projected by CharacterData.prepareDerivedData.
  First edit snapshots the old numeric baseline; unlinked tokens and imported clones
  branch from inherited history. Keep all revisions, including conflict outcomes:
  deleting old receipts would make delayed requests unsafe. No automatic compaction.
  No leases/release/recovery for journal operations. Reload/reconnect resumes pending
  requests with unchanged IDs. Old unpublished lease data is inert; deployment must
  close old clients and restart once. README_DEV.md describes the legacy-pending
  exception, raw-source/export compatibility, and privileged API bypass boundary.
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
  Item tooltip notes must pass through TextEditor.enrichHTML with the item's
  ownership setting; HTML sanitization alone does not remove secret sections.
- **Drag-sort**: weapon rows rely on ActorSheetV2's built-in drag/drop — `class="draggable"`
  + `data-item-id` is the entire wiring. Don't add manual DragDrop.
- **Dialogs**: `DialogV2` only (`module/apps/modifiers-dialog.mjs` uses
  `DialogV2.wait` with `rejectClose: false` so dismissal = cancel).

## Conventions and constraints

- **No jQuery, no external assets** (fonts included), no `@ts-ignore`-era idioms —
  `actor.system`, namespaced APIs (`foundry.documents.collections.Actors`,
  `foundry.applications.ux.TextEditor`), async `roll.evaluate()`.
- CSS is scoped under `.maelstrom`, colors ride v13 theme variables (works in
  `.theme-dark`); no `@layer` wrapper of our own — v13 auto-wraps manifest
  stylesheets in the `system` cascade layer, which already orders them above core.
  Never set `display` on `.tab` sections — core toggles their visibility.
- Active Effects are not supported by this system: no AE UI is provided, and
  derived fields (`attributes.*.current`, `hp.*`) are recomputed in data
  preparation so they are not AE-targetable.
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
