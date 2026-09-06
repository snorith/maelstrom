# Development

The repository root **is** the Foundry system — there is no build step. Foundry loads
the ES modules (`module/`), CSS (`styles/`), templates and lang files directly.

## Setup

1. Install [mise](https://mise.jdx.dev/) (optional — node is only needed for release
   tooling): `mise install`
2. Make the repo visible to Foundry as the `maelstrom` system, either by cloning it
   directly into your user data folder:

   ```shell
   git clone https://github.com/snorith/maelstrom.git "<FoundryUserData>/Data/systems/maelstrom"
   ```

   or by symlinking an existing checkout:

   ```shell
   ln -s /path/to/checkout "<FoundryUserData>/Data/systems/maelstrom"
   ```

   The directory name must be exactly `maelstrom` (it must match the system `id`).

## Dev loop

Edit files → reload Foundry (F5 in the client). That's it.

## Regression checks

Run the regressions against each installed **Foundry v13/v14** copy (Node 24):

```shell
FOUNDRY_APP_PATH="/path/to/resources/app" node --test tests/*.mjs
```

On macOS the app directory is typically
`/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app`.
The checks use real Foundry fields/model initialization and the installed core
custom-socket forwarding handler. Independent workers simulate separate browser
clients; document transport and HTML enrichment are fixtures. Lost-response and
disconnection tests deliberately wait for the 15-second request timeout.
Set `WOUND_TEST_NETWORK=1` to run the forwarding tests over a localhost-only Socket.IO
server instead of worker IPC. No existing Foundry world is opened or edited.
They do not replace `z/phase-7-checklist.md` in a live Foundry world.

## Recovering a previously skipped weapon-order migration

Earlier v14 builds could mark the world migrated after core had pruned the legacy
`system.order` field. The schema now retains that field. Automatic migration still
respects the saved world version to preserve any manual sorting done since then.

After backing up the world, a GM can explicitly restore **all remaining legacy
weapon orders** from the browser console:

```javascript
const { migrateWorld } = await import("./systems/maelstrom/module/migrations.mjs");
await migrateWorld({ repairLegacyOrder: true });
```

This overwrites current sorting only for items which still have a legacy order.
Successful writes clear that legacy value, making retries safe. If the old value
has already been removed from persisted data, it cannot be reconstructed: restore
from the pre-update backup or sort those weapons manually. User compendia remain
outside the world migration.

## Journal-backed wound editing

Wound buttons and numeric inputs send operations to a connected GM. Each operation
creates one immutable embedded equipment item at the next revision, with its request
ID and result. Foundry rejects competing creations of that revision ID. There are
no persistent writer leases: GM F5, reconnect, or a replacement GM needs no release,
world restart, or recovery dialog.

Pending requests are saved in the requesting tab's sessionStorage **before sending**.
They retry automatically after a lost response, reconnect, or same-tab reload, using
the same ID. Check / retry is also available. A late old writer can only contend for
an immutable revision; it cannot overwrite the latest wounds. Conflicts are recorded
too, so an already-rejected edit cannot unexpectedly succeed on a later retry.
If the database or all GMs are unavailable, changes remain pending until available.
Closing a tab may discard its local pending request; do not assume a vanished tab's
uncertain edit failed. The committed journal survives regardless.

### Storage and compatibility

The first journal revision snapshots existing wounds and bleeding count; no bulk
world migration is needed. Thereafter journal history is authoritative.
CharacterData projects its latest state into ordinary `actor.system.wounds` and HP
on every preparation, so sheets, rolls and token bars use the journal state.
The persisted numeric source fields remain the pre-journal baseline—not a cache
that a late writer can overwrite.

Use the operation API for numeric edits:

```javascript
await actor.healAllWoundsByOne();
await actor.sufferBleedingDamage();
await actor.applyWoundOperation({ type: "setWound", slot: 3, expectedValue: 0, value: 5 });
await actor.applyWoundOperation({ type: "setBleedingCount", expectedValue: 2, value: 3 });
```

Direct numeric `actor.update()` is rejected once the actor has journal records.
Unrelated document edits and injury notes still work normally. Imports/exports must
retain the embedded journal items; tools reading raw numeric source alone will see
the old baseline. Import into a **new** actor is supported: inherited history provides
the starting values, and its next edit starts its own branch. Overwriting an existing
journal-backed actor with older JSON is not a supported wound reset operation.
Unlinked tokens inherit base wounds until their first journal edit, which snapshots
a token-specific branch independent of subsequent base edits.
Existing pre-journal token numeric overrides are preserved rather than replaced
by the base actor's newly adopted journal.

Journal items are hidden from the sheet's ability/weapon lists. They are immutable
through normal item update/delete APIs. Do not manually modify, delete, or truncate
history: request deduplication relies on it. There is deliberately no five-minute
receipt eviction or automatic compaction; storage and replay cost grow with edits.
Raw document APIs, external modules, and privileged journal tampering remain outside
the protocol guarantee. No custom Foundry server code is required.

Plain HTTP LAN clients work: IDs use getRandomValues and local SHA-256.
Normal wound editing still requires a connected GM.

### Upgrading from the unpublished lease prototype

Close **all** old client windows and restart the world once when deploying this
redesign; do not mix old lease code and journal code. Existing numeric wounds become
the baseline, and old lease items/receipt flags are left inert, not deleted.
An old pending lease request cannot safely be converted into a journal request
because its old receipt may have expired. That one-time legacy request must be
checked against current wounds and cleared with Resolve pending change. New journal
requests have no such expiry or coordinator-session recovery requirement.
## Legacy note

`src/system.json` is a **tombstone** — do not delete it. Pre-1.0 installs poll that
raw-GitHub path for updates; it redirects v13+ clients to the GitHub Releases update
channel while its legacy `minimumCoreVersion` key stops old Foundry clients from
updating into an incompatible version. The rest of the old Foundry-v9 implementation
was removed after the rewrite (behavioral spec: `z/SPEC.md`; full history: `v0.3.3` tag).

## Releasing

1. Bump `version` in `system.json` (and `package.json`), commit
2. `git tag v<version> && git push --tags`
3. `.github/workflows/release.yml` verifies the tag matches the manifest, stamps the
   `download`/`manifest` URLs, zips the system, and publishes the GitHub Release
4. If the `FVTT_PACKAGE_TOKEN` repo secret is set, the workflow also announces the
   release to the Foundry package registry via the
   [Package Release API](https://foundryvtt.com/article/package-release-api/)

Do not hand-edit the manifest/download URLs — the workflow owns them.

### How updates reach users (the two-URL pattern)

Foundry's update check fetches the manifest URL stored in the *installed* manifest and
compares `version` fields. That is why:

- the `manifest` field inside `system.json` points at the **rolling** URL
  (`releases/latest/download/system.json`) — installed copies always discover the
  newest release;
- the `download` field points at the **version-pinned** zip — a given manifest always
  installs exactly the version it describes;
- the Package Release API is passed the **version-specific** manifest URL (the API
  docs require this — it is not the rolling URL).

### Foundry package registry (one-time setup)

Registration makes the system searchable in Foundry's Install System dialog and gives
users version-aware compatibility filtering. Manual, once:

1. Submit the package at <https://foundryvtt.com/packages/submit> with id `maelstrom`
   and the rolling manifest URL
2. Copy the "Package Release Token" (`fvttp_…`) from the package edit page
3. Add it as a repository **Actions** secret named `FVTT_PACKAGE_TOKEN`
   (GitHub → Settings → Secrets and variables → Actions → New repository secret)

From then on every tagged release is published to the registry automatically. The API
rejects duplicate version numbers and rate-limits to one release per minute; a failed
registry publish fails the workflow run loudly but the GitHub Release itself will
already exist (re-run the job after fixing).
