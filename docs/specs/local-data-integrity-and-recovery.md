---
status: active
created_on: 2026-07-20
---

# Local Clinical Data Security, Integrity, And Recovery

## Goal

Define the implementation required to move NodeDent from prototype/no-PHI storage to the constrained local clinical mode proposed by [ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md), while keeping ClearDent or Dentrix as the official record.

This spec owns findings PRIV-02, DATA-01 through DATA-04, and REL-01 through REL-03 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md). The currently supported boundary remains governed by [ADR 0007](../adr/0007-define-clinical-data-deployment-mode.md) until ADR 0008's implementation gate is complete.

## Safety Gate

This spec is a design and implementation target, not authorization to enter real patient data. NodeDent must continue to prohibit real patient information until ADR 0008 is accepted and every implementation-gate item is verified.

The primary deployment assessment is Alberta. The architecture should remain assessable elsewhere in Canada, including Quebec, but implementation must not claim nationwide or province-specific compliance without the applicable operational and legal review.

## Required Outcomes

### Stable encounter identity

- Give every saved encounter a random immutable identifier that is not derived from patient, tooth, procedure, or diagnosis.
- Keep human-readable case facts inside the record and index metadata.
- Permit multiple encounters for the same patient, tooth, and procedure without collision.
- Start the protected clinical store in a new namespace with an empty encounter set.
- Do not migrate, copy, or silently import existing prototype `localStorage` records.
- Detect legacy data without parsing it into the clinical vault, and offer only explicit export or confirmed deletion.

Repeatable workflows inside one encounter are separate and owned by [Repeatable workflow instances](repeatable-workflow-instances.md).

### Safer exports

- Keep EMR transfer limited to plain-text notes under [ADR 0009](../adr/0009-defer-structured-emr-interoperability.md).
- Treat JSON or encrypted case files as NodeDent backup/continuation artifacts, not EMR interchange.
- Explain that full case exports contain identifying clinical information before download.
- Use `YYYY_MM_DD_<chart-number>_<discipline>_<encounter-suffix>.json` for plaintext case exports.
- Sanitize the chart number, use a controlled discipline code, and exclude name, date of birth, procedure, diagnosis, area, and tooth from the default filename.
- Use a short random encounter suffix to prevent same-day collisions without adding patient facts.
- Keep an encrypted NodeDent backup format as a future compatible extension of the protected store.
- Define a separate de-identified/share-safe export only if its removal rules can be tested.

### Destructive actions

- Confirm clear-current, delete-case, and reset-all actions.
- State the exact scope and record count being removed.
- Give reset-all stronger friction and focus the least destructive action initially.
- Define backup-before-reset and a bounded undo strategy where feasible.
- Report removal failures rather than implying success.

### Validated and versioned imports

- Require an export kind and explicit schema version.
- Validate through the Zod schema before mutating application state.
- Run ordered, testable migrations for supported historical versions.
- Reject unsupported versions and malformed structures with actionable errors.
- Preserve the original import until validation and migration complete.
- Enforce an input size limit and test hostile shapes, duplicate IDs, invalid dates, unknown workflows, and missing scopes.
- Do not treat legacy browser records as an import source or migration format.

### Protected persistence service and recovery

- Centralize case storage reads, writes, removals, index maintenance, and recovery behind structured results.
- Store protected clinical records and indexes transactionally in IndexedDB, not as plaintext case JSON in `localStorage`.
- Encrypt case records and identifying indexes using authenticated browser Web Crypto primitives.
- Keep the usable encryption key in memory only; never persist the unlock secret or a plaintext key.
- Store only the minimum unencrypted vault metadata needed to identify the format and derive or locate the decryption key.
- Provide explicit lock and inactivity lock behavior, and clear decrypted application state when locked.
- Surface saving, saved, failed, and cross-tab-conflict states.
- Add monotonic revision/update metadata and never silently overwrite a newer revision.
- Define `BroadcastChannel` or equivalent cross-tab lock and conflict behavior without sending clinical data.
- Offer an encrypted emergency backup when persistence fails; plaintext emergency export requires a separate explicit warning.
- Define retention, purge-after-transfer behavior, orphan cleanup/recovery, and index repair before enabling clinical mode.
- Preserve the draft-versus-durable-history semantics in [ADR 0006](../adr/0006-define-autosave-and-draft-workflow-state-policy.md).

### Deployment and application safeguards

- Require HTTPS and a clinic-controlled device, operating-system account, and browser profile.
- Document full-disk encryption, automatic screen locking, physical access, approved-extension, backup, and secure-deletion expectations.
- Add a restrictive content security policy and prohibit analytics, telemetry, remote logging, and unintended clinical-data network requests.
- Treat dependency integrity, build provenance, and deployed-commit verification as part of the clinical threat model.
- State that application encryption protects a locked vault at rest but not an unlocked compromised browser or device.
- Keep ClearDent or Dentrix as the sole official record and make successful text transfer a clinician-verified action.

### Failure feedback

- Provide clinician-safe recovery for top-level render failures without exposing patient data in diagnostics.
- Explain clipboard failure and provide a manual select/copy fallback.
- Test denied/restricted storage, quota exhaustion, malformed stored state, interrupted deletion, stale tabs, and intentionally thrown render errors.

## Non-Goals

- Selecting a regulatory framework or declaring compliance.
- Migrating legacy `localStorage` data into the protected clinical store.
- Structured ClearDent or Dentrix interoperability.
- Making NodeDent an official clinical record or authoritative retention system.
- Server persistence, multi-user accounts, clinic synchronization, or cross-device sync.
- Implementing repeatable workflow instances.
- Changing clinical event semantics or note wording except where export/recovery metadata must be distinguished from clinical output.

## Validation Expectations

- Unit tests for identifiers, encrypted envelope parsing, encryption/decryption, wrong-key failures, imports, revisions, retention, and structured failures.
- Browser tests for lock/reload recovery, inactivity locking, two-tab conflicts, destructive confirmations, import/export, denied storage, quota failure, and clipboard fallback.
- Tests proving that legacy `localStorage` is not copied or parsed into the protected store.
- Tests proving that plaintext clinical content and identifying index fields do not appear in protected browser storage.
- Network tests proving that clinical fixtures are not transmitted.
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:check`

## Completion

Archive this spec only after every required outcome is implemented or explicitly moved to another active owning spec with a link and rationale.
