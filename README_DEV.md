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
3. Add it as the `FVTT_PACKAGE_TOKEN` secret in this repo's GitHub settings

From then on every tagged release is published to the registry automatically. The API
rejects duplicate version numbers and rate-limits to one release per minute; a failed
registry publish fails the workflow run loudly but the GitHub Release itself will
already exist (re-run the job after fixing).
