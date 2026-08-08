# Phase 8 — Release pipeline & legacy cutover: implementation plan

**Goal:** tag-push → GitHub Release with stamped manifest + zip; legacy update channel
handled safely; docs rewritten for the new world.

## Steps

1. `.github/workflows/release.yml` — on `v*` tag push:
   - guard: tag version must equal `system.json` version (hygiene check, hard fail)
   - stamp `download` (versioned asset URL) + `manifest` (latest/download URL) via jq
   - zip system files at archive root (Foundry extracts into `systems/maelstrom`)
   - create GitHub Release with `system.json` + zip as assets
2. **Tombstone** at `src/system.json` (the URL every existing install polls):
   full new manifest PLUS legacy `minimumCoreVersion: "13.347"` — pre-v10 clients
   check that key and refuse the update (protects v9 users from auto-updating into
   an incompatible system); v10+ clients read `compatibility` and update normally.
3. Delete the rest of old `src/` (D7 completes; behavior lives in z/SPEC.md, history
   in the `v0.3.3` tag).
4. `README.md` — new install URL (releases/latest manifest), v13/v14 requirement,
   legacy install pointer for old-Foundry users (v0.3.3 tag manifest), changelog
   entry, features refresh. Arion Games legal text preserved verbatim.
5. `CLAUDE.md` — rewritten for the new architecture (the old one documents gulp/TS).
6. PLAN.md final status + remaining human tasks (checklist run, commit/tag, optional
   Foundry package-registry submission).

## Output

- Workflow, tombstone, deletions, README, CLAUDE.md; loop ends
