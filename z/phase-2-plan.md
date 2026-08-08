# Phase 2 — Boot skeleton: implementation plan

**Goal:** the new system loads in Foundry v13/v14 with declared types and no code.

## Verified facts (from dnd5e master system.json, 2026-08-08)

- Types are declared via `documentTypes` in system.json:
  `{"Actor": {"character": {"htmlFields": [...]}}, "Item": {...}}`; schemas come from
  TypeDataModel (Phase 3). No template.json in modern systems.
- dnd5e compatibility: `{"minimum": "13.347", "verified": "14"}` → we use the same
  floor (documentTypes proven against that build).
- `primaryTokenAttribute` still valid; `grid` is now `{"distance": 10, "units": "ft"}`.

## Steps

1. New root `system.json`: id maelstrom, version 1.0.0, compatibility 13.347/14,
   documentTypes (character w/ htmlFields biography; ability + weapon w/ htmlFields
   notes), esmodules `module/maelstrom.mjs`, styles `styles/maelstrom.css`,
   lang en, grid, primaryTokenAttribute hp, media/urls carried from old manifest
   (manifest/download left as Phase 8 placeholders pointing at GitHub latest-release)
2. `module/maelstrom.mjs`: header legal comment + `Hooks.once("init")` log +
   initiative formula const (registered here so Phase 4 doesn't move it)
3. `styles/maelstrom.css`: stub with header comment
4. `lang/en.json`: copied verbatim from `src/lang/en.json`
5. Boot check: if a local Foundry install exists, symlink and note; otherwise flag
   manual check for Stephen (world create + empty character create must not error)

## Output

- `system.json`, `module/maelstrom.mjs`, `styles/maelstrom.css`, `lang/en.json`
- PLAN.md phase 2 → DONE
