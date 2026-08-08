# Phase 7 — Verification: implementation plan

**Goal:** catch every wiring mistake that doesn't need a running Foundry, and hand
Stephen a precise manual checklist for the rest.

## Part A — static audit (automated, this phase)

1. Every `data-action` in templates ↔ an entry in the sheet's `actions` map (both ways)
2. Every `MAELSTROM.*` key referenced in templates + .mjs exists in `lang/en.json`
   (report unused keys informationally — old keys kept for safety are fine)
3. Every `name="system.…"` form path in templates resolves against the declared
   schema paths (hand-derived from SPEC §1.1/§2 — catches typos)
4. Every `PARTS` template path exists on disk (core `templates/generic/…` excluded)
5. `node --check` everything again after any fixes

## Part B — manual checklist (Stephen, needs Foundry v13 and/or v14)

Delivered as `z/phase-7-checklist.md`, derived from SPEC.md — world boot, legacy-world
migration, every roll flow, wound buttons, drag-sort, flavour switch, token bar,
combat tracker, light+dark themes.

## Change vs original plan

Old `src/` deletion moves to Phase 8: the legacy update-channel manifest lives at
`src/system.json`, so its removal and the tombstone/registry decision are one move.

## Output

- Audit script results + fixes; `z/phase-7-checklist.md`; PLAN.md updated
