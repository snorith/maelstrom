# Phase 6 — Styles: implementation plan

**Goal:** `styles/maelstrom.css` — plain CSS, native nesting, scoped under `.maelstrom`,
themed via v13 CSS custom properties so light AND dark modes look native.

## Decisions

- Drop the Google Fonts `@import` (Roboto) from the old SCSS — external network fetch,
  and v13's bundled font stack is the native look. DEVIATION from old, intentional.
- Keep the old layout skeleton: `grid`/`grid-2col`, `info-grid-form`, `grid-wounds`,
  `sheet-header`/`profile-img`, table column widths, 40px wound inputs, `item-controls`.
- Semantic colors stay literal (bloodloss darkred, bleeding crimson border) — they read
  correctly in both themes. Ornamental browns become `--maelstrom-accent` with a
  dark-theme override (v13 marks app windows `.theme-dark`).
- Theme-agnostic subtle fills via `color-mix(in srgb, currentColor N%, transparent)`
  instead of hardcoded greys.
- Per the AppV2 guide warning: never set `display` on `.tab` sections (core toggles
  visibility); grids live INSIDE the tab sections.
- No `@layer`: unlayered system CSS deliberately wins over layered core styles.

## Verification

- CSS parse check (any strict parser); eyeball against old sheet screenshot layout
- Real rendering check happens in Phase 7 (needs Foundry)

## Output

- `styles/maelstrom.css` (replaces stub); PLAN.md phase 6 → DONE
