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
- Requests persist to the player's sessionStorage before sending. Missing replies
  retry automatically after two seconds, using the original ID. RPC waits at most
  fifteen seconds; database/GM outages leave the request pending. Reconnect and
  same-tab reload resume it. Closing the tab can lose its local pending record.
- First revision snapshots existing numeric wounds. CharacterData projects the
  journal's latest state before computing HP. No asynchronous actor snapshot write
  exists, and the numeric source fields remain the original baseline.
- An unlinked token inherits base history until its first local revision, which
  snapshots an independent branch. Imported/cloned histories select their leaf
  stream as the initial state and branch under the new actor UUID.
  Existing pre-journal token numeric overrides still take precedence over inherited
  base history until the token has its own journal branch.
- Imports/exports must include embedded journal items. Raw numeric-source consumers
  are incompatible after initialization; direct numeric actor.update is rejected.
  Journal item update/delete is rejected through normal item APIs. Privileged raw
  edits, destructive whole-document imports and external bypasses are out of scope.
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
- Client backend rewrites synthetic-actor embedded requests to ActorDelta parent
  UUIDs. ActorDelta uses an inherited embedded-delta collection.
- The custom-socket handler supplies authenticated user ID as its second callback
  argument and targets all windows of a recipient user.
- CharacterData.prepareDerivedData runs after embedded-document preparation, so it
  can project journal records before HP calculation.

## Verification and release gate

The 32-test suite passed against installed 13.351 and 14.365. Module/test syntax,
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
