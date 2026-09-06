# Maelstrom system — behavioral spec (extracted from v0.3.3, Foundry v9 codebase)

This is the contract for the rewrite. Phase 7 walks every checkbox.
"OLD:" notes describe the legacy data shape migrateData must accept.

## 1. Actor: character

### 1.1 Schema (system.*)

- [ ] `biography` — HTML string (rich text editor on Description tab)
- [ ] `age` — number (default 13), `race`, `sex`, `social`, `imbalance`, `favour`,
      `patron` — strings
- [ ] `money.amount` — string (free text, not numeric)
- [ ] `attributes.{attack, missile, defence, knowledge, will, endurance, persuasion,
      perception, speed, agility}` each:
  - [ ] `orig` — number, default 40
  - [ ] `temp` — number **or empty** (empty = no override). OLD: empty string `""`
  - [ ] `used` — boolean checkbox (bookkeeping only, no mechanical effect)
  - [ ] derived `current` (not persisted — see 1.2)
  - OLD: also declared `test: object` in TS type — never used, **drop**
- [ ] `characteristics.characteristic{1,2,3}` — strings
- [ ] `wounds.wounds` — array of 11 number slots; slots 0–9 are ordinary wounds,
      **slot 10 (last) is bloodloss damage**. OLD: persisted as object `{0: n, …}`;
      nulls/blanks possible in any slot
- [ ] `wounds.bloodloss` — number: count of currently-bleeding wounds
- [ ] `wounds.injuries`, `wounds.bleeding`, `wounds.longterm` — text (injuries +
      longterm are textareas on sheet; `bleeding` is declared but has NO sheet field —
      keep in schema for data fidelity)
- [ ] `armour.armour` — string (name), `armour.ar` — number, `armour.penalty` — number
      (negative values expected). OLD: all three default to empty string
- [ ] `notes`, `equipment` — long text (plain textareas, not rich text)
- [ ] `languages.lang{1,2,3,4}` — strings. OLD: template declared key `"languages:"`
      (colon typo); real actor data may have `languages` (from form writes), the typo
      key, or neither
- [ ] `events.supernatural` — string
- [ ] `events.careers.c{1..6}.{living, years, event}` — strings
- [ ] `initiative.modifier` — number, default 0
- [ ] `hp.{value, max, wounds}` — numbers, derived every prepare (see 1.2) but must
      remain *persisted schema fields* so the token resource bar can bind to `hp`
- OLD: `version` — integer (migration bookkeeping) → consumed by migrateData, dropped
      from new schema
- OLD: `roll.modifier` — always reset to 0, never read → **drop**

### 1.2 Derived data (prepareDerivedData)

- [ ] For every attribute: `current = temp` if finite, else `orig` if finite, else 0
- [ ] `hp.wounds` = sum of finite, truthy entries of `wounds.wounds` (all 11 slots,
      i.e. bloodloss damage counts toward total)
- [ ] `hp.max` = `attributes.endurance.current + 20`
- [ ] `hp.value` = `hp.max − hp.wounds` (may go negative; no clamping in old code)
- [ ] Status derivation (used by sheet icons, not persisted):
      unconscious when `hp.wounds > endurance.current`; dead when `hp.wounds > hp.max`

### 1.3 Attribute roll (`rollAttribute(attributeName, modifiers=[], itemName='')`)

- [ ] If attribute ∈ physical set {attack, missile, defence, speed, agility} and
      `armour.penalty` is finite and ≠ 0: prepend penalty to modifiers
- [ ] Open modifiers dialog (see §5). Cancel (button or close) aborts with no roll
- [ ] Dialog modifier appended; non-finite modifiers filtered out; attribute `current`
      prepended → target = sum of all; **floor at 0** if negative
- [ ] Roll `1d100`
- [ ] Outcome bands (roll R vs target T):
  - [ ] R ≥ 96 → `criticalfail` if T ≤ 90, else `fail`
  - [ ] else R > T → `fail`
  - [ ] else R ≤ floor(T/10) → `criticalsuccess`
  - [ ] else → `success`
- [ ] Chat card: flavor = h3 title (localized "Rolling {attribute}" or
      "Rolling {attribute} with {item}"), then "Modified attribute: {a + b + c = T}"
      breakdown (single value shown without `=` when only one term), then outcome
      line (large, bold, centered). All interpolated values HTML-escaped. Speaker =
      the actor. Public roll
- [ ] Triggered from: attribute dice icon (no item, no extra modifier); weapon AS
      dice (attribute = weapon's attack attribute, modifier = weapon `as`, item =
      weapon name); weapon DS dice (defence attribute, `ds`, name)

### 1.4 Weapon damage roll (`rollItemDamage(name, damage)`)

- [ ] Roll arbitrary formula string; chat flavor h3 "Damage from {item}"; speaker =
      actor. OLD BUG (fix, don't port): valid-formula path referenced undefined `c`
      → threw; only the error path ever worked
- [ ] Invalid formula → plain chat message with red "Invalid dice formula: '{formula}'"
- [ ] Sheet: damage dice icon disabled (grey, no action) when formula blank/whitespace

### 1.5 Initiative

- [ ] Formula: `2d10 + @attributes.speed.current + @initiative.modifier +
      (@attributes.speed.current / 100)`, 2 decimals — registered as
      `CONFIG.Combat.initiative` (combat tracker) AND rolled standalone from the
      sheet's initiative dice icon with localized flavor
- [ ] Sheet exposes `initiative.modifier` input next to the roll icon

### 1.6 Wound buttons

- [ ] **Heal all** (stethoscope): every wound slot with finite value > 0 decrements
      by 1; non-finite → 0. Enabled only when total wounds > 0
- [ ] **Bleeding damage** (plus icon on the bloodloss slot): adds `wounds.bloodloss`
      to slot 10 (creates it as the value if slot non-finite). Enabled only when
      `bloodloss` ≠ 0
- [ ] Wound buttons and numeric edits append immutable actor-scoped revisions.
      Competing GM clients claim the same next revision ID; core duplicate-ID
      rejection serializes accepted operations without a persistent writer lease
- [ ] Numeric edits include the displayed previous value; same-slot conflicts are
      recorded terminal outcomes. Different-slot edits remain independent.
      Ordinary forms strip numeric wounds; restored drafts submit once on blur
- [ ] Socket sender identity is authenticated by core and OWNER permission is checked
      before reading and again before creation. Revision records contain request ID,
      operation, resulting state and outcome together; history is never evicted
- [ ] GM reload/reconnect and replacement GM windows require no manual recovery.
      Pending requests persist in the requesting tab before sending and retry the
      same ID automatically. Unavailable database/GM leaves them pending, not replayed
      under a new ID. Full tab closure can lose local unsent/pending request data
- [ ] Non-retryable actor/permission/history/state/request failures show their reason
      and pause automatic retry. Check / retry preserves the original request ID;
      ambiguous requests cannot be discarded. Confirmed results survive local
      storage-cleanup failure, with a warning
- [ ] First journal edit snapshots legacy wounds. Thereafter derived wounds and HP
      read journal state; numeric source fields stay as baseline. Direct numeric
      updates are rejected once journal-backed. Unrelated updates retain semantics.
      Concurrent legacy numeric API writes during first initialization are outside
      the guarantee; finish them before adoption
- [ ] First adoption uses server-backed numeric values and token overrides, not
      cached client broadcasts. Expected revision-collision acknowledgements are
      quiet; permission, validation and unrelated database errors remain visible
- [ ] Unlinked tokens snapshot an independent branch on first edit. Export/new-actor
      import retains history and branches on first edit; raw-source-only tools and
      destructive imports over an existing journal actor are not supported.
      Import Data over an existing journal actor displays explicit rejection guidance
- [ ] Plain HTTP clients need no secure-context-only APIs. No custom server code
- [ ] Journal corruption pauses editing. Normal item APIs cannot alter/delete
      revision records; privileged tampering and external bypasses are out of scope
- [ ] Deploying over the unpublished lease prototype requires closing all old
      windows and restarting once. Old leases are inert; old unresolved lease
      requests need one-time reconciliation, never automatic conversion
- [ ] OLD: both mutated `actor.data` in memory + re-render only (not persisted until
      next form submit!). NEW: persist via `actor.update` — intentional improvement,
      note in changelog

## 2. Items

### 2.1 `ability`

- [ ] Fields: `rank` — string, `benefit` — string, `notes` — HTML (rich editor)
- [ ] Default icon `icons/svg/aura.svg`; default name localized "New Ability"
- [ ] Sheet: name+img header; Attributes tab (rank, benefit), Description tab (notes)

### 2.2 `weapon`

- [ ] Fields: `as` — number-ish, `ds` — number-ish, `damage` — string (dice formula),
      `range` — string, `attributes.attack` + `attributes.defence` — attribute keys
      (selects over all 10 attributes; defaults `attack`/`defence`), `notes` — HTML,
      `price` — string (declared, never on sheet; keep), `carriable` — bool (same)
- [ ] Default icon `icons/svg/combat.svg`; default name localized "New Weapon"
- [ ] Sheet: header + Attributes tab (as, ds, damage + hint, range, two attribute
      selects), Description tab
- [ ] Ordering: OLD had `order`/`lastOrder` fields + a ±6 order `<select>` on the
      weapon sheet header + reassign-on-render (0,5,10…). NEW (D6): core `sort` field
      + drag-drop rows on the actor sheet; order select removed; migrate old `order`
      → `sort` preserving relative order
- [ ] Retain nullable legacy `order` in the schema until migration writes core
      sort and clears it atomically. Already-stamped worlds have an explicit repair
      command; do not automatically overwrite subsequent manual sorts
- [ ] `equipment` is retained as a registered data model for legacy compatibility
      and immutable wound-journal revisions. Excluded from actor item lists; the
      core default sheet remains available through direct document APIs

### 2.3 Actor-sheet item lists

- [ ] Abilities table: info tooltip (only when notes non-blank; disabled icon
      otherwise), name, rank, benefit, edit, delete; create (+) in header;
      **sorted by name**
- [ ] Weapons table: info tooltip, name, AS roll icon, `as`, DS roll icon, `ds`,
      damage roll icon (or disabled), damage text, range, edit, delete, create;
      **sorted by sort/order**
- [ ] Tooltip content (was tooltipster; NEW: Foundry `data-tooltip`): item img, name,
      rank/benefit (ability) or as/ds/damage/range (weapon), then enriched notes HTML
      with unrevealed Secret blocks hidden from non-owners
- [ ] Delete asks for confirmation (was `window.confirm`; NEW: DialogV2.confirm)
- [ ] Create: new item of type with localized default name, then (OLD behavior)
      no sheet auto-open — keep

## 3. Actor sheet layout

- [ ] Header: profile img (edit on click), name input, then two info columns:
      (age, race, gender, social) / (imbalance, favour-or-renown, patron, money)
- [ ] **Flavour label swap**: world setting Gothic (2) → "Renown" label instead of
      "Favour"; Domesday/Rome → "Favour" (same underlying field `favour`)
- [ ] Tabs: Attributes/Abilities · Equip/Events · Description (initial: attributes)
- [ ] Attributes tab, col 1: attributes table (name+tooltip, orig input, roll icon,
      temp input, used checkbox), wounds panel (10 wound inputs + bloodloss-damage
      slot + bleeding-count input; total + heal button + status icon; injuries +
      longterm textareas), armour table (name, AR, penalty)
- [ ] Attributes tab, col 2: characteristics ×3, abilities table, weapons table,
      initiative row
- [ ] Equip tab: supernatural events input; notes + equipment textareas (col 1);
      careers table 6×(living, years, event) + languages 2×2 (col 2)
- [ ] Description tab: biography rich-text editor
- [ ] Zero-valued number fields render blank, not "0" (wounds, bloodloss, ar, penalty)
- [ ] Sheet size ~925×1000; item sheets 550×620

## 4. Settings & flavour

- [ ] World setting `characterSheet`: 1 = Domesday, 2 = Gothic, 3 = Rome (dropdown,
      default 1). Only observable effect: Favour/Renown label (§3). Keep as select
      for future flavour divergence
- [ ] World setting `trademarkNotice`: config-page-only legal text (type-less
      pseudo-setting rendering the Arion Games notice as its hint). Preserve the
      exact legal text (also in maelstrom.mjs header comment, LICENSE, README)

## 5. Modifiers dialog

- [ ] Prompt: single number input (default 0, autofocused, select-on-focus), label +
      tooltip; Cancel / Continue buttons; Continue = default; close = cancel
- [ ] NEW: DialogV2.wait, no inline `<script>`, autofocus via attribute/render hook

## 6. Chat / i18n / token

- [ ] All user-visible strings via `lang/en.json` (carry file over; keys stay
      MAELSTROM.*; add keys only, never repurpose)
- [ ] Token resource bar binds to `hp` (primaryTokenAttribute equivalent in new
      manifest/schema: `hp.value`/`hp.max` as a bar attribute)
- [ ] Handlebars helpers still needed by new templates: zero-blank rendering
      (`isZeroThenBlank`) and flavour comparison — provide as system helpers or
      restructure templates to avoid them; core provides `eq`, `gt` etc. in v13

## 7. Migration inputs (migrateData contract)

Accept any mix of:
- [ ] v9 actor: `system.version` present (0 or 1), wounds object-not-array, blank-string
      temp/ar/penalty, missing `wounds`/`armour` blocks entirely (pre-v0.1 actors),
      `languages` under `languages:` or `languages` or absent, stray `roll` block,
      `hp` possibly stale → recompute, `events` possibly missing careers keys
- [ ] v9 items: `order`/`lastOrder` on weapons → map relative order → core `sort`;
      missing `attributes` block on weapons → defaults
- [ ] Anything already in new shape (idempotent)
- [ ] Test fixture: `z/fixtures/` — capture from a real v9 world if available;
      otherwise synthesize from template.json defaults + hand-made variants

## 8. Explicitly NOT ported

- `MaelstromItem` / `MaelstromItemSheet` proxy factories (per-type data models replace)
- Custom `Migrator` chain (migrateData replaces)
- tooltipster (core `data-tooltip` replaces)
- gulp build, TS compile, `.js`-appending import transformer, src→dist, foundryconfig
- `equipment` item type (D5), `attributes.*.test`, `roll.modifier`, `order`/`lastOrder`
- jQuery (AppV2 actions + vanilla DOM)
- The in-memory-only wound mutation behavior (§1.6 — now persists)
