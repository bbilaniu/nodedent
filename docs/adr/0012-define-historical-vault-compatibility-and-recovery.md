# ADR 0012: Define Historical Vault Compatibility And Recovery

## Status

Proposed

## Context

NodeDent stores protected clinical data locally and exports encrypted whole-vault
backups. The application, IndexedDB vault schema, encrypted-backup format,
workflow definitions, and case-export schemas evolve independently. The current
application cannot carry every historical compatibility path indefinitely, but
removing old readers without a recovery route could strand an otherwise valid
encrypted backup.

NodeDent uses Changesets for application versions. A `Version Packages` merge
produces the released source commit, and the Version workflow creates a
`vM.m.p` Git tag before synchronizing `beta`. Cloudflare Pages can build selected
branches at distinct branch-deployment origins, as it does for development
branches in related applications. A frozen `archive/vM.m.p` branch can therefore
make a tagged historical build available without sharing the current
application's browser origin.

A historical deployment is not automatically a safe compatibility solution.
An application version is not a persisted-data schema version, a branch is not
immutable merely because it is named `archive`, and an old build may contain
outdated dependencies or security defects. A deployment on another origin also
cannot access the current origin's IndexedDB. Hosting old code under the current
origin would instead expose the live vault namespace to code that may not
understand its schema.

The durable decision must therefore define both a supported compatibility
window in the current application and an isolated recovery path for older
encrypted backup artifacts. It must not turn archived clinical software into an
alternative workspace.

## Decision

NodeDent should retain tagged historical release artifacts and may deploy
selected releases as **origin-isolated, recovery-only historical readers**.
Historical readers supplement a defined compatibility and migration window in
the current application; they do not replace it.

The current application remains responsible for opening or safely migrating the
live vault stored at its own origin. A historical reader accepts only an
explicitly selected encrypted backup file. It must never attempt to discover,
unlock, migrate, or modify the current application's IndexedDB vault.

Historical recovery is intended to let an operator authenticate an unsupported
backup, inspect its identity and contents after unlock, and export a format that
the current application can import through a separately specified migration or
recovery contract. It is not intended for starting, continuing, editing, or
autosaving clinical work.

Until the implementation gate in this ADR is complete, the existing current-app
backup readers and migrations remain controlling. This proposal does not
authorize removal of any supported compatibility path.

## Version And Compatibility Contract

Application semantic version, workflow-definition version, vault-storage
schema, encrypted-backup format, and case/interchange schema remain independent.
Compatibility decisions must use the relevant persisted format and schema
versions, not application version alone.

Future protected backups should carry authenticated or otherwise validated
metadata sufficient to determine:

- encrypted-backup format version;
- protected vault payload schema version;
- application version that created the backup, for diagnostic provenance;
- applicable workflow-definition versions where required to interpret stored
  workflow state; and
- export timestamp and existing non-clinical recovery metadata.

`createdWithAppVersion` may help select a known reader, but it must not be the
sole compatibility key. No version field may contain a chart number, patient
fact, clinical label, or other identifying clinical information outside the
encrypted boundary.

The current application should bundle a reviewed compatibility manifest rather
than fetch one at runtime. The manifest should map supported backup and payload
schema combinations to one of these outcomes:

- open or migrate in the current application;
- use an approved historical recovery reader;
- reject as malformed, unauthenticated, or unsupported; or
- direct the operator to a controlled manual recovery process.

Routing is advisory until the backup has been authenticated. A visible version
claim in an untrusted file must never bypass schema validation, authentication,
input-size limits, or passphrase verification.

## Current Compatibility Window

Each released application must document and test the vault-storage,
encrypted-backup, and interchange schema versions it supports. The exact window
is an implementation and release decision, not a fixed number of application
releases in this ADR.

Before support for a schema is removed from the current application:

1. Every supported live-vault upgrade path from that schema must either migrate
   safely to a retained schema or have an approved recovery alternative.
2. Representative encrypted fixtures must prove that the designated historical
   reader can authenticate and interpret the retiring format.
3. A tested conversion or import path into the current application must exist;
   read-only display by itself is insufficient to prevent data stranding.
4. Deployment, security, privacy, and operator documentation must identify the
   end of current-app support and the recovery path.

Historical readers do not solve skipped live-vault migrations because their
separate origins cannot access the live IndexedDB database. The current
application must retain an appropriate migration or safe export path for local
browser storage.

## Release Identity And Archive Creation

The Git tag is the canonical release identity. The archive branch and Cloudflare
deployment are derived delivery mechanisms.

For each release selected for historical recovery, the release process should:

1. Merge the reviewed `Version Packages` pull request so `main` contains the
   released application version, lockfile, and changelog.
2. Create `vM.m.p` at that exact commit and refuse to move or reuse the tag.
3. Create `archive/vM.m.p` from `vM.m.p`, never from an earlier unversioned
   `main` or a later `beta` commit.
4. Protect or otherwise freeze the archive branch against ordinary development
   commits.
5. Build the historical reader in its explicit archive/recovery mode.
6. Record the tag, source commit, archive branch, Cloudflare deployment origin,
   application version, supported schemas, build-tool versions, lockfile digest,
   and retained artifact digest.
7. Synchronize `beta` only after required release tagging and archive steps have
   succeeded.

A branch name and a Cloudflare URL are not sufficient evidence of immutability.
The tagged source and retained checksummed production artifact remain the
verification references if a branch deployment is rebuilt or withdrawn.

Because a tag pushed by the repository's `GITHUB_TOKEN` does not normally
trigger another workflow, archive creation should be a downstream job in the
Version workflow or another explicitly invoked workflow. It must not depend only
on an `on: push: tags` event emitted by that token.

No historical tag should be fabricated for development before NodeDent's formal
versioning baseline. Backfilling a documented release tag requires evidence of
the exact released and deployed commit and must not infer a commit from a
version-like message alone.

## Origin And Storage Isolation

Every historical reader must use a distinct Cloudflare branch-deployment origin
from the current clinical application and from other readers when practical.
Deploying a reader at a path under the current origin is rejected because URL
paths do not isolate IndexedDB, local storage, service workers, or other
origin-scoped browser state.

The recovery reader must:

- receive the encrypted backup through an explicit file picker;
- keep the usable decryption key and decrypted contents in memory only;
- avoid persisting imported cases, passphrases, decrypted indexes, or recovery
  work in IndexedDB, local storage, caches, or service workers;
- clear decrypted state on explicit lock, page hiding, navigation, inactivity,
  and failure according to at least the security controls of the source release;
- retain the production no-clinical-network boundary and verified restrictive
  content security policy;
- avoid telemetry, remote logging, mutable remote catalogues, CDN-loaded
  application code, or runtime compatibility lookups; and
- never enumerate or link to case facts before successful authentication.

The archive origin must not be presented as a place where an existing NodeDent
vault already resides. Selecting a reader, selecting a file, entering its
passphrase, converting it, and importing the result into the current application
are separate, explicit steps.

## Recovery-Only User Experience

Archive mode must be enforced by application behavior rather than a banner
alone. It must disable or omit:

- new-vault creation;
- live-vault unlock;
- case creation, continuation, editing, deletion, and autosave;
- catalogue administration and ordinary workspace settings;
- plaintext clinical export unless a separately reviewed emergency path
  explicitly requires it; and
- any suggestion that the historical reader is the current supported clinical
  workspace.

Every screen should display the archived application version, recovery-only
status, source commit or short identifier, and a link or instruction for
returning to the current application. The page title and initial warning must
make bookmarked or stale reader tabs unmistakable.

After authentication, the reader may show the minimum information needed to
confirm that the intended backup was selected. Conversion must preserve
encounter identifiers, revisions, recovery provenance, workflow versions, and
clinical meaning. It must never silently discard an unsupported field or claim
that a lossy conversion is complete.

The normalized recovery format, its encryption and passphrase behavior, and its
import transaction semantics require an implementation spec. Until that format
exists and is supported by the current application, a historical deployment
cannot justify retiring the corresponding current-app reader.

## Security And Availability Lifecycle

Preserving a historical artifact does not promise that its public deployment
will remain safe or executable forever. Browser behavior, cryptographic APIs,
hosting controls, and known dependency vulnerabilities may change.

Each historical reader must have an owner and a recorded review status. A reader
may be removed from public availability when it no longer meets the protected
clinical boundary. The tag, source, checksummed artifact, fixtures, and recovery
documentation should remain available to the controlled recovery process. A
maintained standalone recovery tool may supersede a vulnerable archived web
reader without moving or rewriting the historical Git tag.

The deployment must be rechecked after changes to its Cloudflare configuration,
custom domains, redirect rules, security headers, certificate behavior, build
settings, or retained artifact. Archived code must not silently inherit mutable
runtime services from the current application.

## Relationship To Other Decisions

[ADR 0008](0008-adopt-constrained-local-clinical-mode.md) remains authoritative
for the protected local clinical-data, encryption, network, deployment, and EMR
boundaries. Historical recovery does not weaken those controls or make NodeDent
the official record.

[ADR 0011](0011-define-isolated-local-vault-profiles.md) may later allow a
converted recovery artifact to be restored as a new local vault. A historical
reader does not itself create a vault profile, share a passphrase between vaults,
or gain access to another origin's vault registry.

The operational versioning and tagging procedure remains in the
[versioning guide](../versioning.md). This ADR owns the architectural reason and
security boundaries for retaining and deploying historical readers.

## Implementation Gate

Historical-reader deployment and removal of an existing compatibility path are
not complete until:

1. An implementation spec defines backup metadata, the compatibility manifest,
   normalized recovery format, archive build mode, conversion rules, and failure
   behavior.
2. The release workflow creates the tag, frozen archive branch, Cloudflare
   deployment, and retained artifact from the same reviewed release commit, with
   collision and partial-failure handling.
3. Tests prove that archive mode cannot create or mutate a vault, persist
   decrypted clinical data, autosave, or send clinical data over the network.
4. Cross-version fixtures cover correct and wrong passphrases, tampering,
   unsupported fields, hostile shapes, interrupted conversion, version mismatch,
   and lossless current-app import.
5. Browser tests verify distinct-origin isolation, locking, stale tabs, keyboard
   and screen-reader operation, zoom, and the permanent recovery-only identity.
6. The threat model, privacy policy, deployment guide, operator training, release
   checklist, and applicable clinic review cover historical recovery and
   withdrawal of an unsafe reader.
7. A controlled recovery route exists if the Cloudflare deployment is
   unavailable or no longer approved.

## Consequences

- Old encrypted backups can retain a defined recovery path without keeping every
  historical reader in the current clinical bundle forever.
- Git tags and retained artifacts improve release reproducibility and debugging.
- Origin isolation prevents archived code from touching the live current vault,
  but requires explicit file transfer and passphrase entry.
- The current application still needs live-vault migrations and a documented
  compatibility window.
- Every retained reader adds fixtures, build evidence, security review,
  operational ownership, and withdrawal obligations.
- Recovery conversion becomes a durable data contract that must preserve
  clinical meaning across application generations.

## Alternatives Considered

- **Keep every migration and reader in the current application forever:** gives
  the simplest operator experience but continuously expands the clinical bundle,
  regression surface, and dependency on obsolete models.
- **Deploy the complete historical application without restrictions:** rejected
  because a banner does not prevent continued work in unsupported clinical
  software.
- **Host historical releases under paths on the current origin:** rejected
  because paths do not isolate browser storage or service workers.
- **Use archive branches without Git tags or retained artifacts:** rejected
  because branches and deployments can move or be rebuilt.
- **Route solely by application semantic version:** rejected because persisted
  formats and workflows have independent compatibility versions.
- **Use archived readers instead of live-vault migrations:** rejected because a
  separate origin cannot access the current origin's IndexedDB and same-origin
  access would weaken isolation.
- **Retain source tags but no executable recovery path:** useful for debugging,
  but insufficient when an operator must recover an encrypted backup safely.

## Future Reconsideration

Revisit this decision if NodeDent adopts a maintained standalone recovery
application, signed offline recovery packages, managed clinic deployment,
centralized accounts, or cross-device storage. Those models require their own
identity, authorization, distribution, update, and privacy decisions and must
not inherit trust merely from a historical NodeDent tag.
