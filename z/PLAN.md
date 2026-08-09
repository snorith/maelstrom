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

### Round 2 — rev 2 (commit 3725c82), confirmation, 2026-08-08

- **codex** (`review --commit 3725c82`): clean — "changes correctly make migration
  normalization delta-safe, preserve legacy weapon ordering, and gate mutating sheet
  actions without introducing a concrete regression." Zero findings.
- **droid** (same session as round 1): all fixes verified correct and complete — traced
  all 17 SPEC §7 legacy shapes through the presence-guarded migrateData (full-document
  and delta modes), checked every fix for regressions (none), and ran a NEW outward
  sweep enumerating all 12 actor/item system-data write paths (form submits, action
  handlers, world migration, item creation, compendium import, external macros) —
  every path produces a shape migrateData + schema handle. No new findings.
- **Gates:** G1 counts stated as tables (17 shapes, 12 paths) · G2 fresh outward
  enumeration found nothing · G3 no disagreement · G4 **CONVERGED** — two model
  families (GPT-5.6 + GLM-5.2; devin not selected, so convergence is two-family,
  not three).
- Residual items deliberately outside review scope: `_source` legacy-key retention
  and real-Foundry rendering remain on the phase-7 manual checklist.

**Review loop closed at rev 2** for codex+droid. Re-opened for round 3 (devin, third
family) at Stephen's request.

### Round 3 — rev 3 (commit d7a0a35 reviewed), devin (SWE-1.7), 2026-08-08

Single-reviewer round (judgment focus). First dispatch failed on devin's
workspace-trust gate; retried once with the wrapper-documented
`--respect-workspace-trust false` per-run opt-in (read-only mode).

**devin found (FOLDED):**
- P1/P2 dropping the `equipment` type is an avoidable world-breakage risk if a legacy
  world contains one → minimal `EquipmentData` declared + registered (no sheet, not
  listed on actor sheet — pure safety net). NOTE: devin's claimed failure mode (actor
  init throws) is unverified here — v10+ invalid-document quarantine may soften it —
  but the mitigation is ~15 lines with zero downside, so the fold does not depend on
  settling that. Checklist gained an explicit equipment-item test
- P2 observer-visible dice rolls — **overturns droid round 2**, which blessed un-gated
  rolls as "matches SPEC". Gate-3 resolution in devin's favor: the v9 sheet attached
  NO listeners for non-editable viewers (rolls were owner-only), and rolls speak AS
  the character. All four roll actions now `isEditable`-gated; checklist wording
  hardened ("fully inert sheet")
- P2 partial wound updates: ship a guard, not just documentation →
  `MaelstromActor._preUpdate` now merges partial `wounds.wounds` objects onto the
  current array before ArrayField replacement (macro footgun closed)
- P3 README lacked a back-up-before-updating warning for a data-layer rewrite → added
- P4 compendium actors outside `migrateWeaponOrderToSort` scope → documented in code
  (system ships no packs)
- P4 unused lang keys (`MAELSTROM.item.weapon.order.*`, `MAELSTROM.saveChanges`) →
  removed after verifying unreferenced

**devin REJECTED-by-us:** tombstone `minimumCoreVersion` as string — the v0.3.3
manifest used string values too; consistency with legacy format is the point.

**devin confirmed sound:** the full legacy-update-channel trace (v9 frozen safely,
v13 upgrader migrates, fresh v14 installs clean), wound-button persistence and
drag-reorder as right calls, migrateData fixes, AppV2 wiring, roll rules, release
workflow.

**Gates:** G1 — smoke suite is 32 assertions (rounds 1–2 ledger said 33: miscount,
corrected), all pass after folds; lang audit re-run clean after key removals. G2 —
devin's fresh angle (user-impact/judgment + channel trace) found the observer-roll
gap both other families missed. G3 — one cross-round disagreement (droid r2 vs devin
r3 on roll gating) resolved by legacy-behavior evidence, recorded above. G4 — round 3
folded substantive findings, so **NOT yet converged**: a confirmation round is
required. Note: single-reviewer round — devin-only convergence would be single-model
evidence; the confirmation round should re-engage at least one other family.

### Round 4 — rev 4 (commit 199a9ca), devin confirmation, 2026-08-08

First dispatch blocked (devin attempted a confirmation-requiring tool call in headless
mode); single allowed retry, narrowed to direct file reads with no git commands,
succeeded.

- **devin**: "the folds are correct. No P1–P4 findings." Confirmed: (a) `_preUpdate`
  receives the raw change object BEFORE schema cleaning/migrateData, so partial wound
  objects are distinguishable there; (b) full 11-key form submissions merge as an
  identity overlay; (c) the guard is safe for non-character actors and during
  creation; (d) EquipmentData + registration + documentTypes fully neutralizes the
  legacy-world load risk with no sheet needed; (e) `isEditable` gating is correct for
  GM-on-unowned (editable), LIMITED/OBSERVER (not), locked compendium (not);
  `editItem` correctly left ungated.
- **Gates:** G1 no new quantifiers this round · G2 outward passes stand from rounds
  2–3 (write-path enumeration, channel trace, judgment sweep), nothing new · G3 no
  disagreement · G4 **CONVERGED for this loop** (devin).
- **Honest caveat:** the rev-3 delta (equipment type, roll gating, _preUpdate; ~110
  lines) has been reviewed only by devin — codex/droid converged on the state BEFORE
  those folds. The delta is small and implements devin's own findings, but a final
  codex or droid pass over `git show 199a9ca` would upgrade it to cross-family. This
  is Stephen's call, not an automatic next round.

**Review loop closed at rev 4.** All three model families have signed off on the
state each last reviewed. Do not re-open without new code changes.

## Rollout state (staged release, 2026-08-08)

DONE:
- Default branch renamed `master` → `main` (remote `main` = v0.3.3 `9ca75bc`;
  leftover `master` ref removed)
- `foundry-v13-rewrite` pushed; tag `v1.0.0` pushed from it
- Release workflow ran green: [v1.0.0 release](https://github.com/snorith/maelstrom/releases/tag/v1.0.0)
  with `system.json` + `maelstrom-v1.0.0.zip`; verified live: rolling manifest URL
  serves the stamped 1.0.0 manifest, zip has system files at archive root
- Registry publish step skipped (no FVTT_PACKAGE_TOKEN secret yet) — as designed

DEFERRED until Stephen's Foundry smoke test passes (the whole point of staging):
1. Merge `foundry-v13-rewrite` → `main` with a **merge commit** (not squash — the
   release tags must remain reachable from main). THIS is the step that flips the
   legacy update channel: VERIFIED 2026-08-09 that GitHub's branch-rename redirect
   serves `…/master/src/system.json` from `main` (HTTP 200, currently the v0.3.3
   manifest) — so no `master` branch recreation is needed, and the channel was
   never broken during staging (legacy users simply see "no update").
2. Foundry package registry submission + FVTT_PACKAGE_TOKEN secret (see README_DEV)

Fresh installs are already possible via
`https://github.com/snorith/maelstrom/releases/latest/download/system.json`.
NOTE: the v1.0.0 release zip contains the circular-import load crash — release
v1.0.1 (load fix + best-practices pass, see BEST-PRACTICES-GAP-PLAN.md) once the
smoke test passes; do not flip the channel onto 1.0.0.

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
   `https://github.com/snorith/maelstrom/releases/latest/download/system.json`.
   Then copy the package's `fvttp_…` release token into the repo secret
   `FVTT_PACKAGE_TOKEN` — the release workflow will publish every future version
   to the registry automatically (see README_DEV.md "Foundry package registry")
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
