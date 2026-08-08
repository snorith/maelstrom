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

Do not hand-edit the manifest/download URLs — the workflow owns them.
