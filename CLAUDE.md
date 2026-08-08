# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An unofficial **Foundry VTT game system** for the Maelstrom RPG (Domesday / Gothic / Rome). It is not a
web app or a library — the build output is a directory that Foundry loads, and `src/system.json` on
`master` *is* the live install manifest users point Foundry at.

## Commands

There is **no test framework and no linter** in this repo. Type checking is the only automated check:

```shell
npm ci                    # required first on a fresh clone -- see note below
npx tsc --noEmit          # typecheck (currently clean)
npx gulp build            # clean + compile TS/SASS + copy statics into dist/
npx gulp watch            # rebuild on change (the dev loop)
npm run build             # gulp build && gulp link  -- requires foundryconfig.json (see below)
npm run build:watch       # gulp watch
npx gulp package          # zip dist/ into package/maelstrom-v<version>.zip
npx gulp link             # symlink dist/ into the Foundry user data dir
npx gulp clean            # remove built files from dist/
```

`npx gulp --tasks` lists everything; individual tasks are not all mirrored in `package.json` scripts.

Without local `node_modules`, gulp aborts with `Local modules not found` and `npx` will happily fetch
**gulp 5** from the registry — which is not the gulp 4.0.2 this gulpfile targets. Run `npm ci` first so
`npx gulp` resolves to the pinned local binary.

### foundryconfig.json (gitignored — absent from a fresh clone)

`gulp link`, `gulp update`, and `gulp publish` all require a `foundryconfig.json` at the repo root.
`linkUserData` reads it *outside* its try block, so `npm run build` throws without it. Plain
`npx gulp build` needs nothing. Shape:

```json
{
  "dataPath": "/path/to/FoundryVTT",
  "repository": "https://github.com/snorith/maelstrom.git",
  "rawURL": "https://raw.githubusercontent.com/snorith/maelstrom"
}
```

`gulp link` symlinks `dist/` → `<dataPath>/Data/systems/maelstrom`, and only if that path does not
already exist. Combined with `gulp watch`, that is the live-reload loop: edit `src/`, reload Foundry.

**The checkout directory must be named `maelstrom`.** Both `clean()` and `linkUserData()` derive the
system name from `path.basename(path.resolve('.'))`. Under any other directory name, `clean` silently
finds nothing to remove and `link` symlinks to `<dataPath>/Data/systems/<dirname>`, where Foundry
never looks. Both fail quietly.

### Releasing (mutates git — do not run exploratorily)

```shell
npx gulp publish -u patch     # or minor | major | 0.3.4
```

Runs clean → updateManifest → build → package → **git add, git commit, git tag**. It keeps
`package.json` version, `src/system.json` version, and the `manifest`/`download` URLs in sync.
**Never bump the version by hand** — the download URL embeds the version and the tag must match it.

### Node version

`.nvmrc` pins v14.18.1 (gulp 4 / gulp-sass 5 era), but the build was verified working on Node 22.
SASS emits a wall of `/`-division deprecation warnings; they are noise, not failures.

## Architecture

### Entry and registration

`system.json` declares `esmodules: ["maelstrom.js"]` → built from `src/maelstrom.ts`. Its
`Hooks.once('init')` is the single wiring point: sets `CONFIG.Actor.documentClass` /
`CONFIG.Item.documentClass`, unregisters the core sheets, registers one sheet per item type, calls
`registerSettings()` and `preloadTemplates()`. `migrateWorld` runs on `ready`.

### The `.js` import transformer

`gulpfile.js` installs a TypeScript transformer that appends `.js` to relative import specifiers at
compile time, so extensionless relative imports work as native browser ESM. This is why source
imports are inconsistent (`'./module/settings.js'` next to `'./module/actor/MaelstromActor'`) —
both work. Write relative imports without an extension.

### `MaelstromItem` is a Proxy, not a class

Foundry does not support real Item subclass polymorphism, so `src/module/item/MaelstromItem.ts` is a
`Proxy` faking it: it dispatches on `data.type` in `construct`, in `create`/`createDocuments`, and in
`Symbol.hasInstance`. **Adding an item type touches five places:**

1. new class with a `static get type()` in `src/module/item/`
2. a case in the proxy's `construct` switch *and* its `create` switch
3. a sheet in `src/module/item/sheets/` + `Items.registerSheet` in `maelstrom.ts`
4. a type entry in `src/template.json`
5. a template in `src/templates/item/` (the sheet's `get template()` derives the path from `type`)

Note `equipment` exists in `template.json` with no class and no sheet — `MaelstromItemSheet` throws
on it. `MaelstromItemSheet` itself is a similar constructor-time proxy and is not registered anywhere.

### Data model

Schema lives in `src/template.json` (Foundry's declarative actor/item shape). Derived values are
computed in `MaelstromActor._prepareCharacterData`:

- `attributes.<name>.current` = `temp` if finite, else `orig`, else 0
- `hp.max` = `attributes.endurance.current + 20`
- `hp.wounds` = sum of the `wounds.wounds` array (Foundry hands it back as an object, not an array)
- `hp.value` = `hp.max - hp.wounds`, surfaced on token bars via `primaryTokenAttribute: "hp"`

`MaelstromActorSheet._prepareCharacterItems` **recomputes the same three hp values** — change one,
change both.

### Migrations

`src/module/migrations/Migrator.ts` is a prototype-based migrator chained via `previousMigrator`,
keyed on the integer `data.version` from the `base` template. `migrateWorld` is GM-only and runs on
`ready`. To add one: `Object.create(Migrator)` with `forVersion: N` and `forType`, link
`previousMigrator` to the N-1 migrator, re-export it as `MaelstromActorMigrator`, and bump `version`
in `template.json`'s `base` template. `Migrator.migrate` stamps `data.version` for you — the doc
comment says migration functions must not set it, though the shipped `MaelstromActorMigrator` sets it
anyway (harmlessly, to the same value). Follow the comment.

### Game flavour

The world setting `characterSheet` (1 = Domesday, 2 = Gothic, 3 = Rome) is exposed to templates as
`maelstromFlavour`. All three return the *same* `actorSheet.html` from `get template()`; the flavour
only drives conditional labels inside that one template.

### Roll pipeline

`data-*` attributes in the HTML → `_on*Roll` handlers in `MaelstromActorSheet` → methods on
`MaelstromActor`:

- `rollAttribute` awaits `getRollModifiers()` (a discriminated-union promise from
  `ModifiersDialog.ts`), auto-prepends the armour penalty for attributes in
  `MAELSTROM.physicalAttributes`, rolls `1d100`, and bands the result in `_getRollOutcome`:
  roll ≥ 96 is a fail (critical fail if target ≤ 90); roll ≤ `floor(target/10)` is a critical success.
- `INITIATIVE_FORMULA` is defined in `maelstrom.ts` and used both as `CONFIG.Combat.initiative` and
  by `rollActorInitiative`.

### Odd placements worth knowing

- **All Handlebars helpers are registered inside `registerSettings()`** in `src/module/settings.ts`,
  not anywhere named for templating.
- `preloadTemplates.ts` lists only `actorSheet.html` and `abilitySheet.html`; `weaponSheet.html` and
  `dialog/modifiers.html` are not preloaded.
- `src/maelstrom.scss` is the only SASS entry point (gulp compiles `src/*.scss`); everything under
  `src/styles/` is `@import`ed by it.

## Foundry API era

Targets **Foundry v9** (`minimumCoreVersion: 9`, `foundry-vtt-types ^9.249.2`). That means the
pre-v10 idioms: `actor.data.data` (not `actor.system`), the `sheetData.data = sheetData.data.data`
dance in every `getData()`, and `createEmbeddedDocuments`/`updateEmbeddedDocuments`. Do not apply
modern Foundry patterns here without an explicit migration decision.

`@ts-ignore` is pervasive because the v9 typings fight the actual API. Be aware it suppresses errors
on the *next line*, which in multi-line call expressions can hide genuine mistakes — `tsc --noEmit`
passing does not mean a line is correct.

## Style

`.editorconfig` governs: tabs at width 4 for source, 2 spaces for JSON/YAML/Markdown, LF endings.
Existing files are inconsistent (mixed tabs and spaces); match the file you are editing.
