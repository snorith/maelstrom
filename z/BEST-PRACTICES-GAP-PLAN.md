# Best-practices gap plan — maelstrom vs FOUNDRY-BEST-PRACTICES.md (hellas, 2026-08)

Comparison of the shipped v13 rewrite against
`/Users/stephen/WebstormProjects/hellas/z/FOUNDRY-BEST-PRACTICES.md` (§ refs below).
Target release for the fixes: **v1.0.1** (which also carries the already-fixed
circular-import load crash).

## Already compliant (verified, no action)

- §1 id/version/compatibility/manifest/download/documentTypes/grid/primaryTokenAttribute
- §2 TypeDataModel per sub-type; ""→null before NumberField cleaning; delta-safe
  presence-guarded migrateData; derived data in prepareDerivedData; no DB writes in prep
- §3 AppV2 core contract (DEFAULT_OPTIONS/PARTS/TABS/actions/isEditable gating);
  free drag-drop; tab template structure; sheet registration via namespaced collections;
  tooltip CSS scoped under #tooltip
- §3b DialogV2 form-less content; render-callback focus; wait() semantics
- §4 package-class scoping; no external fonts; core theme variables
- §5 TYPES.* labels (fixed after first boot); composed-key audit
- §7 async dice + toMessage + CONST roll modes; single Item class; _preUpdate for
  whole-document context
- §8 tag-push CI, stamped manifest, both assets attached, stable manifest URL,
  pinned download, Package Release API step, dev material excluded from zip
- §9 both migration layers (migrateData + gated world runner)
- §10 no deprecated APIs in use; mise pins node 24

## Corrections to our own records (no code)

- **C1. Rollout plan**: hellas §8 says renamed-branch raw URLs redirect — VERIFIED
  live today: `…/master/src/system.json` returns HTTP 200 serving main's content.
  Therefore (a) the legacy channel never broke during the staged rollout (it serves
  v0.3.3's manifest → "no update"), and (b) the deferred "recreate master branch"
  step is unnecessary — merging to main flips the channel alone. Update PLAN.md.
- **C2. CSS-layer explanation**: our stylesheet header AND CLAUDE.md claim we
  "deliberately unlayered" to beat core; per hellas §4 v13 auto-wraps
  manifest-declared stylesheets in the `system` cascade layer. Behavior fine,
  explanation wrong — fix both locations (droid F1: plan originally missed
  CLAUDE.md).

## Gaps to implement (proposed, severity-ordered)

| # | Gap (doc §) | Change | Size | Sev |
|---|---|---|---|---|
| G1 | §2 `choices:` invalidates nonconforming legacy docs | Drop `choices` from WeaponData attack/defence StringFields; migrateData normalizes ONLY present keys: value ∉ ATTRIBUTES (incl. blank/non-string) → field default; never create a missing `attributes` sibling; guard `source.attributes` is an object. Smoke-test: partial deltas, malformed values, valid non-default values, double-run | S | P1 |
| G2 | §3b `parseInt` truncates exponent input (`1e2`→1) | `Number()` in modifiers-dialog callback (real defect) + actor-sheet onRollWeapon (consistency only — dataset value is already field-cleaned) | S | P3 |
| G3 | §3 `scrollable: [""]` idiom | Add to the three actor tab parts + both item sheets' attribute/description parts | S | P3 |
| G4 | §9/§7 world migration surface incomplete | **New migration step 2** (`MIGRATION_VERSION = 2`, `current < 2` guard — v1.0.0 worlds already store 1 and would skip a widened step 1 forever). Step 2 applies order→sort to: standalone world items (`game.items`), and unlinked scene-token actor deltas (`scene.tokens` → actorDelta items). Advance the setting ONLY if every collection migrated without error (idempotent re-run on next load otherwise). User compendia: NOT migrated — documented limitation (G5) | S | P1 |
| G5 | §7/§9 docs stance | README + CLAUDE.md: AEs not supported (derived fields recomputed in prep are not AE-targetable); compendium items keep legacy order (order→sort not applied inside packs); very old worlds should step through core generations (v11→v12→v13) rather than jump | S (docs) | P3 |
| G6 | §1 `flags.hotReload` | `"flags": {"hotReload": {"paths": ["styles", "templates", "lang"]}}` | S | P4 |
| G7 | §1 setup-screen `media` entry | `{"type": "setup", "url": <cover URL>, "thumbnail": <same URL>}` alongside existing cover/screenshot | S | P4 |
| G8 | §3 rich-text observer view (REDUCED after review) | Keep `{{formInput}}` for editable (it emits the sanctioned prose-mirror); render bare `{{{enriched}}}` when not editable (biography + item notes) | S | P4 |
| V1 | verify-then-decide | Confirm whether DocumentSheetV2 (v13) ships an `editImage` action: if yes, header.hbs `data-action="editImage"` is live (droid F6 wrong, keep); if no, wire a FilePicker action per doc §3. Settle by API-doc scrape during implementation | S | P4 |

## Explicitly out of scope for v1.0.1 (recorded so reviewers don't propose them)

- `background` login image (§1): needs a real local asset; none exists post-rewrite
- Active Effects UI (§7): dropping AE support note is enough for a system this size;
  an AE tab is a feature, not a compliance fix
- Compendia practices (§6): system ships no packs; user-compendium order→sort is a
  documented limitation (G5), not silent exclusion
- **G9 (LOCALIZATION_PREFIXES + schema labels)** — moved out of scope by BOTH
  reviewers (rev 1): sheets hand-write every label and G8-reduced keeps formInput
  only for label-less HTMLFields; schema localization would have zero user-visible
  effect. Revisit at formGroup adoption
- trademarkNotice setting name/hint as i18n keys (codex rev-1 P3) — REJECTED:
  intentional literal legal text; translation must not alter licensed wording
  (droid concurs). Recorded here so it is not re-proposed

## Sequencing

1. C1+C2 (record fixes) → 2. V1 verification → 3. G1–G8 (all small now) →
4. re-run full static suite (load smoke, migrate smoke incl. new G1/G4 cases, lang
   audit, template parse, CSS parse) → 5. version bump v1.0.1 + tag AFTER Stephen's
   Foundry smoke test passes (bundles the load-crash fix already on the branch)

## Review ledger (this plan)

### Plan rev 1 → rev 2, reviewed 2026-08-09 by codex (GPT-5.6) + droid (GLM-5.2)

**codex found (FOLDED):** P1 G4 needed a new migration step (v1.0.0 worlds at
setting=1 would skip a widened step 1 forever) · P2 G4 surface incomplete (world
items, compendium decision, no version-advance on failure) · P4 G7 missing
thumbnail · G1 approach confirmed with a tightened normalization spec · G2
severity split (dialog half real, sheet half consistency) · fold core-generation
advice into G5.
**codex found (REJECTED):** P3 trademarkNotice i18n — intentional literal legal
text (droid concurs); recorded in out-of-scope.
**droid found (FOLDED):** F1 C2 must also fix CLAUDE.md · F5 G7 thumbnail
(agrees w/ codex) · F3+F4 G8/G9 assessment.
**droid found (VERIFY-THEN-DECIDE):** F6 claims header.hbs `data-action="editImage"`
is dead (no such action in the sheet's map) — conflicts with round-1 review-loop
verification that DocumentSheetV2 provides it. Became V1; settle by API-doc scrape,
not opinion (Gate 3).
**Gate-3 resolutions:** G8 — codex "keep (S)" vs droid "churn, defer": folded the
reduced form both support (formInput stays for editable; observers get bare
enriched HTML). G9 — both defer: moved out of scope.
**Gate 4: NOT converged** (substantive folds) → plan confirmation round required.
