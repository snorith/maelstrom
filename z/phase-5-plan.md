# Phase 5 — Sheets (AppV2): implementation plan

**Goal:** actor + item sheets on ApplicationV2, all SPEC §2–§3 behavior, zero jQuery,
zero tooltipster, zero custom Handlebars helpers (display logic moves to context prep).

## Verified API facts (v13/v14 docs + AppV2 conversion guide, 2026-08-08)

- ActorSheetV2 wires drag/drop automatically: `.draggable` elements with
  `data-item-id` get drag data; same-actor drops sort via built-in `_onSortItem`;
  cross-actor/compendium drops create embedded items. → weapon rows: just
  `class="draggable" data-item-id`.
- `data-tooltip-html` exists in BOTH v13 and v14 TooltipManager (checked both API
  doc versions) → rich item tooltips use it; plain ones use `data-tooltip`.
- Tab parts: root needs `tab` class + `data-tab`/`data-group` + `{{tab.cssClass}}`;
  nav uses core `templates/generic/tab-navigation.hbs`; context.tabs via
  `this._prepareTabs("primary")` (explicit — don't rely on base auto-adding it).
- DocumentSheetV2 provides the `editImage` action for `data-action="editImage"`.
- Rich text: `{{formInput field ... enriched=... toggled=true name="system.x"}}`
  (HTMLField → prose-mirror element); explicit `name` because fieldPath lacks the
  `system.` prefix.
- v13 checkboxes are FontAwesome-styled — style ::before/::after, not the input
  (Phase 6 note).

## Files

- `module/documents/item.mjs` — `MaelstromItem` (getDefaultArtwork per type)
- `module/apps/actor-sheet.mjs` — `MaelstromCharacterSheet`
- `module/apps/item-sheets.mjs` — shared base + `MaelstromAbilitySheet` + `MaelstromWeaponSheet`
- `templates/actor/{header,attributes,equipment,description}.hbs`
- `templates/item/{item-header,ability-attributes,weapon-attributes,item-description}.hbs`
- `lang/en.json` — ADD keys only: sheet labels, item tab labels, delete-confirm text
- `module/maelstrom.mjs` — settings (characterSheet flavour, trademarkNotice),
  sheet + Item documentClass registration

## Known deviations from OLD (all intentional, in SPEC)

- Weapon reordering: drag rows (core sort) instead of the ±6 select on the weapon sheet
- Delete confirm: DialogV2.confirm instead of window.confirm
- Wound buttons persist via actor.update
- trademarkNotice setting: type String (v13 requires a type; renders an unused input
  under the legal-text hint — cosmetic difference only)

## Trap noted in code

- ArrayField deltas: wound inputs submit as `{0:…,…,10:…}` objects; full form always
  submits all 11 slots so CharacterData.migrateData's object→array coercion is safe.
  Partial-delta updates from other code paths must pass real arrays (ours do).

## Verification

- `node --check` all .mjs; templates eyeballed against SPEC §3 field inventory
