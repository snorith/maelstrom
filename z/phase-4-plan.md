# Phase 4 — Documents: implementation plan

**Goal:** `MaelstromActor` with the three roll flows working end to end (SPEC §1.3–1.6),
async dice, fixed bugs, DialogV2 modifiers prompt (pulled forward from Phase 5 because
`rollAttribute` depends on it).

## Files

- `module/rolls.mjs` — pure functions, node-testable:
  - `rollOutcome(total, target)` → criticalfail | fail | criticalsuccess | success
    (exact banding SPEC §1.3)
  - `stackModifiers(values)` → `{total, terms}` (filter non-finite, floor total at 0)
- `module/apps/modifiers-dialog.mjs` — `getRollModifiers(baseModifier)` via
  `DialogV2.wait` (`rejectClose: false` → dismiss = cancel); autofocus number input;
  no inline scripts
- `module/documents/actor.mjs` — `MaelstromActor extends Actor`:
  - `rollAttribute(attributeName, {modifiers, itemName})` — armour penalty prepend
    (physical only, ≠ 0), dialog, 1d100, outcome chat card
  - `rollItemDamage(name, formula)` — async, **fixes the undefined-`c` bug**; invalid
    formula → red error chat message
  - `rollActorInitiative()` — INITIATIVE_FORMULA vs this.getRollData()
- `module/maelstrom.mjs` — `CONFIG.Actor.documentClass = MaelstromActor`

## API modernizations (old → new)

- `new Roll(f).roll({async: false})` → `await new Roll(f, data).evaluate()`
- `toMessage(data, CONFIG.Dice.rollModes.publicroll)` → `toMessage(data, {rollMode: CONST.DICE_ROLL_MODES.PUBLIC})`
- `Handlebars.Utils.escapeExpression` → `foundry.utils.escapeHTML`
- `Dialog` + promise plumbing + inline `<script>` focus hack → `DialogV2.wait` + autofocus

## Verification

- `node --check` all files; smoke-test `rolls.mjs` pure functions against SPEC §1.3
  edge cases (96/90 boundary, floor-at-0, crit threshold floor(T/10))

## Output

- 3 new files + registration; PLAN.md phase 4 → DONE
