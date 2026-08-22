---
status: implemented
created_on: 2026-08-20
completed_on: 2026-08-20
archived_on: 2026-08-20
archive_reason: Content-aware conflict review, protected transactional replacement, recovery history, and backup compatibility are implemented.
---

# Encrypted Backup Revision Conflict Resolution

## Implementation Status

Implemented behavior includes canonical clinical-content digests, explicit identical/older/newer/divergent classification, structured difference summaries, safe-default per-encounter decisions, active-encounter replacement blocking, encrypted displaced-version history, transactional replacement and history restoration, stale-preview detection, version 1 backup compatibility, and version 2 backup export/restore with authenticated recovery history.

Recovery history is retained until its primary encounter is deleted or the vault is cleared or replaced. It is included in version 2 encrypted backups. Field-level clinical merging and automatic fast-forward remain out of scope because the vault does not claim snapshot ancestry.

## Context

NodeDent can import encounters from an authenticated encrypted backup when their immutable encounter IDs do not already exist in the unlocked local vault. When an incoming ID already exists, the import preview reports its revision relationship and leaves the local encounter unchanged. This safe baseline was completed as part of [Issue 20 chairside and recovery improvements](issue-20-chairside-and-recovery-improvements.md).

Revision numbers alone cannot prove that two snapshots have the same content or share a linear history. Separate copies of an encounter may reach the same revision with different edits, and a numerically newer backup snapshot is not necessarily descended from the current local snapshot. Advanced recovery therefore needs content-aware comparison and explicit clinician-controlled resolution rather than a newest-revision-wins rule.

## Goals

- Distinguish identical snapshots from genuinely divergent snapshots after the backup has been decrypted and authenticated.
- Present clinically meaningful differences without requiring raw JSON comparison.
- Keep the existing local snapshot unless the user explicitly chooses a replacement.
- Preserve a protected copy of every displaced local snapshot.
- Apply selected imports and replacements atomically.
- Detect stale previews and concurrent changes before mutation.
- Preserve backward compatibility with existing encrypted vaults and version 1 backups.

## Non-Goals

- Do not silently choose the snapshot with the larger revision number or later timestamp.
- Do not merge individual case fields, workflow state, canal state, or event arrays in the first implementation.
- Do not infer which clinical record is more accurate.
- Do not treat recovery history as an audit log for ordinary clinical edits.
- Do not sync vaults continuously or introduce a remote storage service.
- Do not persist decrypted backup contents outside the unlocked in-memory recovery workflow.

## Conflict Classification

After complete backup authentication, decryption, and schema validation, compare every incoming encounter with the current local snapshot by immutable encounter ID, revision, and a digest of canonical snapshot content.

| Classification | Meaning | Default action |
| --- | --- | --- |
| New encounter | No local encounter has the incoming ID | Import |
| Identical content | Canonical local and incoming content digests match | Skip |
| Backup older | Incoming revision is lower and content differs | Keep local |
| Backup newer, ancestry unknown | Incoming revision is higher and content differs | Require resolution |
| Divergent same revision | Revisions match but content differs | Require resolution |

The digest is a content-identity aid, not a substitute for authenticated encryption. Define and test the canonical representation explicitly. Exclude transport-only fields only when they cannot change the clinical meaning of the snapshot; do not omit clinical events, workflow position, canal state, closure state, or documentation fields.

The initial implementation does not claim fast-forward ancestry. Proven fast-forward behavior would require a separately reviewed lineage model, such as authenticated parent digests or retained revision history.

## Resolution Experience

The backup and recovery surface should group conflicts by encounter and show:

- local and backup revisions and save times;
- workflow positions;
- patient number, tooth, and procedure identifiers needed to distinguish the encounter;
- canal-status differences;
- added, removed, and changed clinical events;
- closure and next-visit differences; and
- anesthesia and radiograph-entry differences.

Each conflict offers:

- `Keep local` — selected by default;
- `Replace with backup version` — requires an explicit selection and confirmation; and
- `Decide later` — performs no mutation for that encounter.

Identical snapshots and new encounters can be summarized separately from conflicts. Raw JSON may be available as a secondary diagnostic view but must not be the primary comparison experience.

Replacing the encounter currently open in the clinical workspace is not permitted in the first implementation. The user must close it or lock the vault before replacement so autosave cannot recreate the displaced state.

## Protected Replacement Model

Before replacing a local encounter, store its complete encrypted snapshot in a dedicated recovery-history store. A replacement must:

1. Re-authenticate and validate the incoming backup.
2. Confirm that the local revision still matches the reviewed preview.
3. Encrypt the incoming snapshot with the current vault key.
4. Archive the displaced local encrypted snapshot with recovery provenance.
5. Install the incoming content as local revision `max(local revision, incoming revision) + 1`.
6. Regenerate local summary data rather than trusting the imported summary.
7. Commit the archive and primary-record replacement in the same IndexedDB transaction.

Recovery provenance should include the import time, backup export time, incoming source revision, replaced local revision, and the compared content digests. It must not expose clinical content outside encrypted storage.

If any selected encounter has changed since preview, or any write fails, abort the entire resolution transaction and require a fresh preview. Report added, replaced, skipped, deferred, and failed counts only after transaction completion.

## Storage And Backup Compatibility

Adding recovery history requires an explicit IndexedDB migration and a versioned storage contract. The migration must preserve existing encrypted case records and vault metadata.

Before recovery history is added to exported backups, define a backward-compatible encrypted-backup format transition. NodeDent must continue reading supported version 1 backups. A newer backup must declare whether recovery-history records are included, and restore must authenticate and validate those records before replacing the vault.

The implementation must define recovery-history retention and deletion behavior before release. Deleting a primary encounter or the entire vault must not leave undeclared recoverable copies behind.

## Implementation Order

1. Add canonical content digests and read-only conflict classification.
2. Add the structured conflict-comparison interface while retaining skip-only behavior.
3. Define and migrate the encrypted recovery-history store.
4. Add transactional `Keep local`, `Replace with backup version`, and `Decide later` resolution.
5. Extend encrypted backup and restore compatibility to recovery history.
6. Document retention, deletion, and operator recovery behavior.

## Acceptance Criteria

- Equal revision numbers with different content are reported as divergent, not identical.
- Larger incoming revision numbers are never accepted automatically without proven ancestry.
- `Keep local` is the default for every conflict.
- A replacement cannot proceed for the active workspace encounter.
- The comparison view exposes clinically relevant changes without requiring raw JSON.
- Every displaced local snapshot remains recoverable in encrypted recovery history.
- Replacement creates a monotonically increasing local revision and records encrypted provenance.
- Local summaries are regenerated from validated imported content.
- All selected additions, replacements, archives, and metadata updates commit atomically.
- A concurrent local change invalidates the preview and leaves all selected encounters unchanged.
- Wrong passphrases, authentication failures, malformed snapshots, duplicate IDs, unsupported formats, and transaction failures leave the vault unchanged.
- Existing version 1 vaults and backups remain supported through explicit compatibility tests.
- Tests cover identical content, divergent equal revisions, older and newer incoming revisions, mixed decisions, stale previews, active encounters, archive recovery, database migration, backup compatibility, and atomic aborts.

## Verification

- Run `npm test` for digest, classification, migration, encryption, import, and transactional behavior.
- Run `npm run build` after code or configuration changes.
- Run `npm run docs:check` after lifecycle or documentation-index changes.
