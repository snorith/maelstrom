# Phase 0 — Spec extraction: implementation plan

**Goal:** an exhaustive behavioral checklist (`z/SPEC.md`) that the rewrite must satisfy
and Phase 7 verifies against. After this phase, the old code is only consulted through
SPEC.md.

## Steps

1. Read every old source file end to end (TS modules, all 4 Handlebars templates,
   template.json, system.json, en.json, SCSS entry + utils). — done during research
   and this phase's prep; findings folded in below.
2. Write SPEC.md with sections: data schema, derived math, roll rules, sheet inventory
   (per tab, per field, with bindings), item behavior, settings/flavour, chat output,
   token integration, migration inputs (the exact old shapes migrateData must accept),
   known bugs (fix-not-port list).
3. Record quirks discovered that a naive port would miss:
   - `languages:` colon typo in template.json vs `data.languages` form writes
   - wounds array serialized as object
   - weapon order select on the *item* sheet (±6, clamp 0..lastOrder)
   - `used` checkbox per attribute (bookkeeping only — no mechanical effect in code)
   - `test` field declared in the attribute type but never used anywhere → drop
   - blank-string `temp` means "no override" (Number.isFinite gate)
   - bloodloss "+" button only enabled when `bloodloss != 0`
   - status icons: unconscious when wounds > endurance.current, dead when wounds > hp.max
   - critical-fail only when roll ≥ 96 AND target ≤ 90
   - stacked modifier total floors at 0
   - armour penalty auto-added only for physical attributes and only when ≠ 0
   - `rollItemDamage` broken at runtime (undefined `c`) — damage rolls never posted
     for valid formulas; only the invalid-formula error path worked
4. Sign-off gate: Stephen reviews SPEC.md (async — flag in loop updates; do not block).

## Output

- `z/SPEC.md`
- PLAN.md phase 0 → DONE
