# Maelstrom v2 — Foundry v13/v14 rewrite (Option C)

Clean rewrite of the system against current Foundry idioms, using the old v9 codebase
as the behavioral spec. System `id` stays `maelstrom` so existing worlds keep working.

## Standing decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Plain JavaScript ESM + JSDoc, no TypeScript | fvtt-types v13 is beta-from-git with no v14 story; drops the whole compile step |
| D2 | Plain CSS with native nesting, no SCSS | Everything the SCSS does is native CSS now; zero build steps |
| D3 | `compatibility: {minimum: 13, verified: 14}` | AppV2/TypeDataModel/DialogV2 identical on both |
| D4 | Repo root = system root (no src/dist split) | Nothing to compile; clone/symlink into `Data/systems/maelstrom` |
| D5 | Drop the `equipment` item type | Declared in template.json but no class/sheet/UI ever existed; old code throws on it |
| D6 | Weapon ordering via core `sort` + drag-drop | Replaces custom `order`/`lastOrder` fields and the order `<select>` on the weapon sheet; migrate `order` → `sort` |
| D7 | Old `src/` tree stays in place as reference until Phase 7, then deleted | It is the spec; new system lives at repo root alongside it |
| D8 | Fix, don't port: the `c` bug (MaelstromActor.ts:226), the `languages:` colon-typo key | Known defects |

## Phases

| Phase | Title | Status | Plan file |
|-------|-------|--------|-----------|
| 0 | Spec extraction | DONE (awaiting Stephen's review of SPEC.md) | [phase-0-plan.md](phase-0-plan.md) → [SPEC.md](SPEC.md) |
| 1 | Repo reset (toolchain, hygiene) | DONE | [phase-1-plan.md](phase-1-plan.md) |
| 2 | Boot skeleton (new system.json, empty module, boots in v13/v14) | DONE (manual boot check pending — no local Foundry on this machine) | [phase-2-plan.md](phase-2-plan.md) |
| 3 | Data models (TypeDataModel × 3, migrateData, delete template.json usage) | DONE (migrateData smoke-tested: 17/17) | [phase-3-plan.md](phase-3-plan.md) |
| 4 | Documents (MaelstromActor rolls, async dice, outcome banding) | DONE (rolls smoke-tested: 16/16; modifiers DialogV2 pulled forward from Phase 5) | [phase-4-plan.md](phase-4-plan.md) |
| 5 | Sheets (AppV2 actor sheet + 2 item sheets, DialogV2 modifiers) | DONE (all .mjs syntax-checked; all 8 .hbs parse under Handlebars) | [phase-5-plan.md](phase-5-plan.md) |
| 6 | Styles (plain CSS on v13 theme variables, light/dark) | DONE (lightningcss: 0 errors 0 warnings) | [phase-6-plan.md](phase-6-plan.md) |
| 7 | Verification pass (static cross-ref audit + manual checklist for Stephen; src/ deletion moved to Phase 8 to coordinate with manifest tombstone) | Part A DONE (audit clean: actions/lang/fields/paths). Part B = Stephen runs [phase-7-checklist.md](phase-7-checklist.md) in Foundry | [phase-7-plan.md](phase-7-plan.md) |
| 8 | Release pipeline (GH Actions, manifest landmine, package registry) | DONE (workflow + tombstone + docs; registry submission is a human task) | [phase-8-plan.md](phase-8-plan.md) |

Statuses: TODO → IN PROGRESS → DONE. Update this table as phases move.

## External review ledger

### Round 1 — rev 1 (commit 1ac79bf), reviewed 2026-08-08 by codex (GPT-5.6, `review --base master`) + droid (GLM-5.2)

**codex found (all FOLDED):**
- P1 `CharacterData.migrateData` injected absent keys into update deltas (blankToNull(undefined)→null assigned unconditionally): a wounds-only update also nulled `age`/`bloodloss`, a temp-only update nulled `orig` → rewritten presence-guarded (`normalizeBlank`)
- P1 initiative modifier: non-blank values were forced through `Number.isFinite` (false for numeric strings) → 0; now only blank/null → 0, everything else left for NumberField casting
- P1 `WeaponData.migrateData` same delta-injection class (as/ds nulled, other attribute reset on partial updates) → presence-guarded
- P2 mutating sheet actions not gated for non-editable users → `isEditable` guards on heal/bleed/create/delete + canHeal/canBleed context gated (icons render disabled for observers)

**droid found:**
- Blocking Qs 1,2,4,5,7 (TABS/_prepareTabs, formInput+HTMLField→ProseMirror, ActorSheetV2 drag/drop, manifest/documentTypes/token bar, DialogV2.wait semantics incl. 0-returning callback): **verdict correct** — settled, do not re-review
- P2 weapon order→sort migration: `!item.sort` guard could skip weapons whose v9 core sort was auto-assigned → FOLDED (guard dropped; legacy `order` is authoritative, once-only gate makes it safe). Residual: `_source` retention of undeclared keys is unverifiable statically → stays on the phase-7 manual checklist
- P3 `MAELSTROM.events.column.event.header` said "Living" → FOLDED ("Event"). NOTE: legacy bug, present since v0.3.3 — droid caught a five-year-old defect
- P3 wound object coercion via Object.values could misplace slots on partial objects → FOLDED (index-mapped). Residual (recorded, not fixable in migrateData): an external partial update still zero-fills unspecified slots — ArrayField deltas replace, they cannot merge
- P3 README legal text not verbatim vs module header → **REJECTED**: each location preserves its own v0.3.3 wording verbatim; the divergence predates the rewrite. CLAUDE.md rule clarified to "verbatim per location"
- P4 canBleed `≠0` vs action's `>0` → FOLDED (`>0`; same mismatch existed in old code)
- P4 select-on-focus missing on modifiers dialog (SPEC §5) → FOLDED (DialogV2 render callback)
- P4 as/ds zero-blank display differs between actor sheet and weapon sheet → **REJECTED**: 0 and blank are semantically identical for a nullable NumberField; actor-sheet blanking matches the legacy blank-string rendering
- P4 dead CSS (`grid-column` on grid container; `col.event` selector) → FOLDED (removed)

**Gates:** G1 — normalization sites recounted after rewrite (character: age, 10×orig/temp, ar, penalty, wounds array, bloodloss, initiative.modifier; weapon: as, ds, 2×attributes) — all presence-guarded, verified by 16 new delta assertions in the smoke test (33/33 total). G2 — outward enumeration of paths into migrateData: sheet full-form submit, healAllWounds/sufferBleeding updates, world-migration sort updates (no system delta), item create, JSON/compendium import, external macros — presence guards cover all; residual ArrayField-replace semantics recorded above. G3 — no codex/droid disagreement; injection mechanism confirmed by direct inspection. G4 — **NOT converged** (substantive findings folded) → round 2 (confirmation) required.

## Implementation complete — remaining HUMAN tasks (Stephen)

1. **Review** `z/SPEC.md` (the behavioral contract) and skim the new code
2. **Run** `z/phase-7-checklist.md` in Foundry v13/v14 — especially the legacy-world
   migration section (back up the world folder first)
3. **Commit** (nothing has been committed; one commit or per-phase via
   `git add -p` — your call) and, when checklist passes: bump nothing, just
   `git tag v1.0.0 && git push --tags` → the release workflow does the rest
4. Optional but recommended: **submit the system to the official Foundry package
   registry** (foundryvtt.com → "Submit a Package") so users get version-aware
   installs; the manifest URL to register is
   `https://github.com/snorith/maelstrom/releases/latest/download/system.json`
5. If any checklist item fails: notes → me, I fix against SPEC

## Rules for every phase

- Each phase ends with the system **bootable** (from Phase 2 onward).
- Behavior comes from `z/SPEC.md`, not from re-reading old code ad hoc. If old code
  and SPEC disagree, fix SPEC first, then implement.
- No commits unless Stephen asks; the working tree is the workspace. Old code is
  recoverable via the `v0.3.3` tag and `master` history.
- `CLAUDE.md` gets rewritten in Phase 8 (it currently documents the old architecture; it
  goes stale from Phase 1 on — expected, do not patch it mid-rewrite).

## Landmines (do not forget)

1. **Update channel break**: existing installs poll
   `raw.githubusercontent.com/snorith/maelstrom/master/src/system.json`. Phase 1 keeps
   old `src/` (D7) so that file keeps existing until Phase 7. Phase 8 must decide:
   leave a tombstone manifest at `src/system.json` pointing at the new manifest URL,
   and submit to the official Foundry package registry.
2. **Old release zips** are referenced by tag URLs (`v0.3.3/package/…zip`) — deleting
   `package/` from master does NOT break old installs (tag refs still serve them).
3. **Languages data** may live under `system.languages` (from form writes) OR the
   template.json `languages:` typo key on old actors — migrateData handles both.
4. **Wounds array** arrives as an object (`{0: 1, 1: 0, …}`) from old data — coerce
   to a real array in migrateData.
