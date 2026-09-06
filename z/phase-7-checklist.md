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
- [ ] Legacy order survives v14 initialization; a successful migration clears
      `system.order` to null. A retry does not overwrite a later manual sort
- [ ] On a backed-up fixture world already stamped v2, exercise the explicit
      recovery command in README_DEV.md; unavailable old values require backup recovery

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

- [ ] Mixed HTTP/HTTPS clients can edit; the same next revision ID is computed
- [ ] Two GM windows/two player windows contend: one revision per request; accepted
      bleeding operations accumulate, including two rapid accepted actions
- [ ] Same-slot stale edits report durable conflict; different-slot edits survive
- [ ] Name/notes submissions never overwrite wounds; injury notes remain editable
- [ ] Restored draft blur without typing submits exactly once; native change plus
      blur does not duplicate. Retry does not erase unrelated/newer drafts
- [ ] Unprepared GM F5 and reconnect require no release/recovery; another GM window
      continues. Repeat with a different GM user after activeGM changes
- [ ] Drop commit reply: request retries automatically with no duplicate damage.
      Reload requesting player tab while pending; pending request resumes
- [ ] Delay an old GM creation until after newer revisions: duplicate revision is
      rejected, then request is found or safely retried, never a snapshot overwrite
- [ ] Database/GM outage pauses pending work; restored connection resumes it
- [ ] First journal edit preserves existing wounds; derived HP/token bars update
      on embedded-item creation and remain correct after full world restart
- [ ] Unlinked token inherits base history, then branches independently. Base actor
      updates after branching do not change token wounds. Export/import into a new
      actor preserves wounds and supports a new independent branch
- [ ] Journal revision items stay hidden from sheet lists and reject individual
      update/delete; missing/corrupt history is visibly unavailable, not editable
- [ ] Numeric actor.update works before first journal revision (indexed updates
      preserve other slots); afterward it explicitly rejects, directing to the API
- [ ] Ownership revoked while processing prevents creation; body sender spoof fails
- [ ] Upgrade test: old lease items stay inert. Old clients are closed during
      deployment; legacy pending requests are flagged rather than blindly replayed
## Items
- [ ] Create ability/weapon from table headers: right default name and icon
- [ ] Ability rows sorted by name; weapon rows drag-to-reorder and order persists
- [ ] Info icon tooltip: hover card with img/name/fields/notes; disabled when no notes
- [ ] Unrevealed Secret blocks in weapon/ability notes are hidden in tooltips for
      observers, visible to owners; revealed blocks remain visible
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
