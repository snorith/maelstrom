# Durable wound journal

This design supersedes the unpublished persistent-GM-lease prototype. User-approved
scope includes authoritative storage changes, compatibility work, and automatic
recovery from ordinary reloads and uncertain acknowledgements within the system
module. No Foundry server patch, commit, publication, or live world edit is included.

## Persistence rule

Each actor-scoped revision is an immutable embedded equipment item. Its ID is the
first eight SHA-256 bytes of a namespaced actor UUID and revision number. Foundry
serializes database operations and rejects an existing embedded ID with keepId.
Competing clients therefore cannot both create revision N. A late old writer cannot
replace a newer snapshot: it can only lose that same creation race.

A revision includes the request ID, authenticated sender, operation, resulting
state, and terminal outcome. Conflict outcomes are recorded as unchanged-state
revisions too. Every read verifies contiguous history, deterministic IDs, no repeated
request IDs, and state/outcome consistency. A losing writer performs a server-backed
read, checks whether its request is already recorded, then proposes the next revision
only if necessary. History is never compacted or expired. Retry does not compare
client clocks and does not depend on a GM session ID.

## Runtime and migration

- Active GM user receives authenticated core socket requests. Multiple windows of
  that user may compete safely; there is no elected persistent writer window.
  Each window serializes the complete read/create loop per actor, with independent
  queues for unrelated actors. `wound-database.mjs` wraps SocketInterface.dispatch
  only for active journal-creation attempts matched by operation-object identity, revision ID, request
  ID, parent UUID and operation. Its acknowledgement handler rejects the exact
  expected duplicate-ID error without a toast. Other errors still notify; unmarked
  operations delegate unchanged to the original dispatch. Core pre-create hooks,
  validation and successful response/broadcast handling remain in the backend.
  Server duplicate-ID logging is unchanged; no server patch is installed.
  Correlation is held in a WeakMap, never a serializable option. Tests invoke the
  installed core document/backend creation path to verify identity preservation,
  and its server duplicate-ID rejection to pin the English message contract.
  Missing notification UI must not prevent an unexpected error from rejecting.
- Requests persist to the player's sessionStorage before sending. Missing replies
  retry automatically after two seconds, using the original ID. RPC waits at most
  fifteen seconds; database/GM outages leave the request pending. Reconnect and
  same-tab reload resume it. Closing the tab can lose its local pending record.
  Non-retryable permission/actor/history/state/request errors retain the request
  in an explicit blocked state. Automatic retry stops; correcting the problem and
  manually retrying uses the original ID. Missing actors and denied ownership get
  explicit replies instead of a silent timeout. Ambiguous requests cannot be discarded.
  Storage cleanup failure after a confirmed result warns without hiding the result
  or skipping sheet hooks. Any stale saved request remains safe to deduplicate.
- First revision snapshots existing numeric wounds. CharacterData projects the
  journal's latest state before computing HP. No asynchronous actor snapshot write
  exists, and the numeric source fields remain the original baseline.
  Before first adoption, the baseline is read from storage with explicit world
  index fields, and unlinked-token overrides are fetched through embedded Token
  reads. The real character model migrates/cleans the fresh numeric data. Token
  relinking or actor reassignment detected during that read rejects the operation.
  Reads and first-revision creation are not one transaction: arbitrary concurrent
  legacy API writes between them remain outside the protocol. Finish those writes
  before adoption; delayed broadcasts no longer make the baseline stale.
- An unlinked token inherits base history until its first local revision, which
  snapshots an independent branch. Imported/cloned histories select their leaf
  stream as the initial state and branch under the new actor UUID.
  Existing pre-journal token numeric overrides still take precedence over inherited
  base history until the token has its own journal branch.
- Imports/exports must include embedded journal items. Raw numeric-source consumers
  are incompatible after initialization; direct numeric actor.update is rejected.
  Journal item update/delete is rejected through normal item APIs. Privileged raw
  edits, destructive whole-document imports and external bypasses are out of scope.
  Import Data over an existing journal actor is explicitly rejected with a user
  notification; importing into a new actor remains supported.
- Existing prototype lease/receipt data is left inert. On deployment, close all old
  clients and restart once; mixed old/new code is unsupported. An unresolved old
  lease request needs one-time reconciliation because its receipt may have expired.
  This exception does not apply to journal requests.

## Verified framework contracts

Installed versions: Foundry 13.351 and 14.365.

- ServerDatabaseBackend queues get/create/update through the database semaphore.
  Embedded create with keepId rejects an ID already in the parent collection.
- Item.database.get(ItemClass, {parent: actor, index: true}) uses core transport
  and returns raw embedded records; it does not rely on the caller's item cache.
  `index: true` selects raw results in the client backend, not a slim server payload.
- World baseline reads specify `system.wounds` and inherited journal scopes in
  `indexFields`; default compendium-index fields would omit wound numbers. The
  installed server index projection and filtering are exercised in the tests.
- Client backend rewrites synthetic-actor embedded requests to ActorDelta parent
  UUIDs. ActorDelta uses an inherited embedded-delta collection.
- The custom-socket handler supplies authenticated user ID as its second callback
  argument and targets all windows of a recipient user.
- CharacterData.prepareDerivedData runs after embedded-document preparation, so it
  can project journal records before HP calculation.

## Verification and release gate

The 46-test suite passes against installed 13.351 and 14.365, including localhost
Socket.IO forwarding runs with a fixture database. The follow-up adds per-GM
serialization, blocked errors, storage-cleanup,
notification, native-change, projection-cache, scoped collision and fresh-baseline
regressions. Module/test syntax,
Handlebars compilation, localization/action wiring, and diff whitespace checks pass.

Tests cover competing writers, duplicate IDs, delayed old writes, lost acknowledgements,
durable conflict rejection, permission revocation, history corruption, inheritance,
real character-model projection, and sheet draft behavior. Independent worker clients
execute the installed custom-socket forwarding handler with a fixture database,
including unprepared GM reloads and automatic player reload retry. HTTP capabilities
are simulated by exposing getRandomValues but not subtle/randomUUID.

These are not live Foundry database/browser tests. Before release, run the updated
phase-7 checklist for actual embedded persistence, unlinked-token inheritance, HP/token
bar refresh, draft/focus events, export/import, disconnected writes and world restart.
Malformed history or underlying storage failure must remain visible, not be silently
replaced with a guessed state. Storage/replay cost grows linearly with accepted and
conflicted edits; safe compaction is future work, not an implied feature.
Derived-data preparation caches the validated projection only while the complete
journal contents, actor scope, numeric baseline and token overrides are unchanged.
This avoids repeated replay/hash work without missing same-ID corruption. Full
content comparison remains linear; server reads for commits never use this cache.
