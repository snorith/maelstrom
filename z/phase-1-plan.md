# Phase 1 — Repo reset: implementation plan

**Goal:** strip the dead toolchain; establish mise + zero-build layout. Old `src/`
stays untouched (D7 — it's the spec reference and keeps the legacy manifest URL alive).

## Steps

1. `mise.toml` — pin node 24 (only needed for release tooling, not for running the system)
2. Delete toolchain: `gulpfile.js`, `tsconfig.json`, `.nvmrc`, `package-lock.json`,
   `node_modules/`, `dist/` (local build artifact), `package/` (zips — tag refs still
   serve the old downloads, landmine #2)
3. Replace `package.json` with a minimal manifest-less stub (name/version/private) —
   kept only as an anchor for future release tooling
4. New lean `.gitignore` (dist of old world gone; ignore `z/fixtures/private`, OS junk,
   `.idea` stays ignored as before via existing rules — verify)
5. Rewrite `README_DEV.md` for the new workflow (symlink/clone into
   `Data/systems/maelstrom`, edit → reload; no build)
6. Keep: `src/` (reference), `README.md` (Phase 8), `LICENSE`, `.editorconfig`,
   `.gitattributes`, `.github/`
7. Verify: `git status` shows only intended deletions + new files; nothing untracked
   lost (CLAUDE.md untouched)

## Output

- Deletions + mise.toml + stub package.json + README_DEV.md
- PLAN.md phase 1 → DONE
