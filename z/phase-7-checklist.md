# Phase 7 — Manual verification checklist (needs Foundry v13.347+ and/or v14)

Setup: symlink or clone this repo as `<UserData>/Data/systems/maelstrom` (dir name must
be exactly `maelstrom`), then restart Foundry. Do each section on v13 AND v14 if you
have both; v14 alone covers most risk.

## Boot & fresh world
- [ ] System appears in setup with version 1.0.0, compatible
- [ ] Create world, launch — no console errors on load
- [ ] Create a character — sheet opens; all three tabs render; no errors
- [ ] Sheet respects light AND dark theme (toggle in settings)

## Legacy world migration (the big one)
- [ ] Copy a real v9 world folder into the new install; launch it
- [ ] Console shows "Maelstrom | Running world migration 0 → 1", completes
- [ ] Existing character opens: attributes (orig/temp/used), wounds incl. bloodloss,
      armour, careers ×6, languages, characteristics, notes/equipment, biography all
      survived — compare against the old install side by side
- [ ] Weapons kept their manual order (order → sort migration)
- [ ] An UNLINKED token of a legacy actor (drop on a scene in the v0.3.x world,
      reorder its weapons there first) keeps its weapon order after migration,
      and its items still track the base actor afterwards (edit a base weapon,
      confirm the token sees the change — delta must not have adopted it)
- [ ] A standalone weapon in the world Items directory keeps its order
- [ ] Blank temp values stayed blank (no attribute suddenly reads 0)

## Derived data & token
- [ ] hp.max = endurance + 20; wounds total sums all 11 slots; hp.value = max − wounds
- [ ] Token resource bar can select `hp` and displays value/max
- [ ] Wounds > endurance shows unconscious icon; wounds > max shows dead icon

## Rolls (chat card shows title, breakdown, big outcome line)
- [ ] Attribute dice icon → modifier dialog → roll; Cancel and window-close both abort
- [ ] Armour penalty auto-included for attack/missile/defence/speed/agility only
- [ ] Modified target floors at 0; outcome bands sane (try temp=95: roll 96 = Fail not
      Critical Fail; try temp=50: roll ≤5 = Critical Success)
- [ ] Weapon AS/DS dice: rolls right attribute + weapon modifier, named after weapon
- [ ] Weapon damage d20 icon: valid formula posts roll; blank formula icon disabled;
      invalid formula (e.g. `2dd6`) posts red error card
- [ ] Sheet initiative icon rolls 2d10+speed+modifier; combat tracker initiative
      uses same formula with 2 decimals

## Wound buttons
- [ ] Bleeding + icon disabled when bleeding count is 0/blank; otherwise adds count
      to the bloodloss damage slot and PERSISTS (reload world, still there)
- [ ] Heal icon disabled at 0 wounds; otherwise decrements every wound slot by 1

## Items
- [ ] Create ability/weapon from table headers: right default name and icon
- [ ] Ability rows sorted by name; weapon rows drag-to-reorder and order persists
- [ ] Info icon tooltip: hover card with img/name/fields/notes; disabled when no notes
- [ ] Edit opens item sheet (both tabs, ProseMirror notes editor works)
- [ ] Delete asks for confirmation
- [ ] Weapon attack/defence attribute selects list all 10 attributes, persist

## Flavour & settings
- [ ] System settings show Character Sheet (Domesday/Gothic/Rome) + trademark notice
- [ ] Gothic flavour relabels Favour → Renown on the sheet header

## Regression sweep
- [ ] Reload (F5) mid-edit loses nothing (submitOnChange)
- [ ] Non-owner user sees a fully inert sheet: no edits, AND clicking any dice icon
      does nothing (observers must not post rolls as the character — legacy behavior)
- [ ] A world containing a legacy `equipment` item (create one via console:
      `Item.create({name:"t", type:"equipment"})` on a v0.3.x install first) still
      loads and the actor sheet renders (item is valid but not listed)
