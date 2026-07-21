---
status: active
created_on: 2026-07-20
---

# Local Data Integrity And Recovery

## Goal

Make NodeDent's current local persistence, import/export, destructive actions, and failure recovery explicit and testable without prematurely choosing a clinical deployment architecture.

This spec owns findings PRIV-02, DATA-01 through DATA-04, and REL-01 through REL-03 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md). PRIV-01's supported privacy boundary is governed by [ADR 0007](../adr/0007-define-clinical-data-deployment-mode.md).

## Decision Gate

Mode-independent integrity work may proceed before ADR 0007 is accepted. Do not add encryption, authentication, server persistence, inactivity locking, or claims about real-patient-data suitability through this spec.

## Required Outcomes

### Stable encounter identity

- Give every saved encounter a random immutable identifier that is not derived from patient, tooth, procedure, or diagnosis.
- Keep human-readable case facts inside the record and index metadata.
- Permit multiple encounters for the same patient, tooth, and procedure without collision.
- Define migration for existing patient-derived record keys and preserve recoverability if migration is interrupted.

Repeatable workflows inside one encounter are separate and owned by [Repeatable workflow instances](repeatable-workflow-instances.md).

### Safer exports

- Use the patient number as the only case-specific value in the default filename; do not include patient name, tooth, procedure, date of birth, or other patient-specific details.
- Sanitize the patient number for filesystem safety and use a generic fallback when it is blank.
- In the current prototype/no-PHI mode, require the patient number to be synthetic. Do not describe a patient-number filename as de-identified or safe for sharing.
- Explain what full JSON exports contain before download.
- Reassess filename policy before supporting real patient information because a real chart number can identify a patient within a clinic.
- Define a separate de-identified/share-safe export only if its removal rules can be tested.

Initial implementation: JSON downloads use a filesystem-safe patient number as their only case-specific filename value. Persistent prototype warnings state that the number must be synthetic, that the full JSON contains the case record, and that the number appears in the filename. A separately validated share-safe export remains future work.

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

### Persistence service and recovery

- Centralize case storage reads, writes, removals, index maintenance, and recovery behind structured results.
- Surface saving, saved, failed, and cross-tab-conflict states.
- Add monotonic revision/update metadata and never silently overwrite a newer revision.
- Define `storage` event or `BroadcastChannel` conflict behavior.
- Offer an emergency raw backup when persistence fails.
- Define retention, the current 12-item index behavior, orphan cleanup/recovery, and index repair.
- Preserve the draft-versus-durable-history semantics in [ADR 0006](../adr/0006-define-autosave-and-draft-workflow-state-policy.md).

### Failure feedback

- Provide clinician-safe recovery for top-level render failures without exposing patient data in diagnostics.
- Explain clipboard failure and provide a manual select/copy fallback.
- Test denied/restricted storage, quota exhaustion, malformed stored state, interrupted deletion, stale tabs, and intentionally thrown render errors.

## Non-Goals

- Selecting a regulatory framework or declaring compliance.
- Implementing the deployment mode still under ADR 0007.
- Implementing repeatable workflow instances.
- Changing clinical event semantics or note wording except where export/recovery metadata must be distinguished from clinical output.

## Validation Expectations

- Unit tests for identifiers, imports, migrations, revisions, retention, and structured failures.
- Browser tests for reload recovery, two-tab conflicts, destructive confirmations, import/export, denied storage, quota failure, and clipboard fallback.
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:check`

## Completion

Archive this spec only after every required outcome is implemented or explicitly moved to another active owning spec with a link and rationale.
