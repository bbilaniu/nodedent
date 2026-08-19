---
status: active
created_on: 2026-08-19
---

# Issue 20 Remaining Improvements

This spec records the two improvements from [GitHub issue #20](https://github.com/bbilaniu/nodedent/issues/20) that remain after the chairside pause/end-visit flow, endodontic scenario coverage, and contextual required inputs were implemented.

## 4. Make Encrypted Backup And Recovery Easier To Understand

### Problem

The current workflow separates encrypted vault export from restore. A clinician can download an encrypted whole-vault backup from the saved-cases surface, while restore is available only on the vault lock screen. Restore replaces the existing vault, so it cannot safely combine cases from another backup with cases already stored locally. The file input also has less visual weight than the actions around it.

The browser can already download multiple backup files. The product should make that behavior explicit and use collision-resistant, timestamped filenames rather than implying that NodeDent maintains only one backup slot.

### Proposed Experience

Create one clearly labelled `Backup and recovery` surface available from saved-case administration. It should place these actions together:

- `Download encrypted backup`
- `Restore and replace vault`
- `Import cases from encrypted backup`

Use a visible button or drop zone for file selection and show the selected filename, backup creation date, format version, and record count before any restore or import action is confirmed.

`Restore and replace vault` remains the disaster-recovery action. It must retain strong destructive confirmation and must authenticate and validate every encrypted record before replacing local data.

`Import cases from encrypted backup` is a separate, non-destructive merge workflow:

1. Select the encrypted `.nodedent` file and enter its original passphrase.
2. Decrypt and validate the complete backup without mutating the current vault.
3. Compare incoming encounters with local encounters by immutable encounter ID and revision.
4. Preview counts for new encounters, identical encounters, newer revisions, older revisions, and conflicts.
5. Require an explicit choice for every conflict; never silently overwrite a local encounter.
6. Apply the accepted changes in one transaction and report the result.

For an initial release, import should add only encounters that do not already exist locally. Revision replacement and conflict resolution can follow after their semantics and tests are approved. This provides useful merge behavior without making silent clinical-record decisions.

Encrypted backup filenames should include a full date and time so repeated downloads are visibly distinct. NodeDent should continue treating clinic-approved file storage and retention as an operational responsibility, not as an in-app backup history service.

### Development Data

Do not place real clinical records or an unencrypted copy of the live vault outside protected storage, including in development mode. If development needs a readily available case template, provide a clearly synthetic, non-identifying fixture or generator that is excluded from production behavior. The fixture should use the same schema validation and import path as other test data.

### Acceptance Criteria

- Backup download and encrypted import/restore are discoverable from one administration surface.
- Repeated exports produce distinct timestamped filenames.
- File selection is a visible labelled control, not an ambiguous text-only action.
- The UI distinguishes non-destructive import from destructive whole-vault replacement.
- Incoming data is decrypted, authenticated, schema-validated, and previewed before mutation.
- The first merge implementation adds new encounter IDs and skips existing IDs without overwriting them.
- Failed validation or decryption leaves the current vault unchanged.
- Merge application is transactional and reports added, skipped, and failed counts.
- Automated tests cover wrong passphrases, tampering, malformed records, duplicate encounter IDs, revision conflicts, and interrupted transactions.
- Only synthetic, non-identifying fixtures may exist outside the protected vault in development.

## 5. Make Local-Anesthesia Entry Faster And More Predictable

### Problem

`Time administered` is currently free text and starts blank. It does not provide `Now` or `Clear` controls. The anesthesia catalog already supports seeded suggestions and user overrides, including hiding seed rows, but it does not currently seed agent names and the distinction between hiding a seed and deleting a user-created shortcut is easy to miss.

### Proposed Experience

Replace free-text anesthesia time entry with a native time input backed by the existing `administeredAt` field. When a new administration form opens, populate it with the clinician device's current local time. Provide adjacent controls:

- `Now` resets the value to the current local time.
- `Clear` removes the value.

Keep the value editable and do not recalculate it when the event is submitted. Existing imported free-text values should remain readable; migration or normalization should not discard historical documentation.

Add a clinically reviewed seed list for commonly documented anesthetic agents. The list must come from approved project source material or an explicit clinician-approved list; implementation must not infer drug choices, doses, concentrations, or recommendations. Seed entries are documentation suggestions only and must never auto-populate dose or adequacy.

Preserve the existing catalog ownership model:

- Seed entries can be `Hide`/`Show`, because the shipped baseline should remain recoverable.
- User-created entries can be edited or permanently deleted.
- A hidden seed can be restored by the user.
- The UI should explain this distinction in plain language and may use `Remove from suggestions` instead of `Delete` for seed entries.

### Acceptance Criteria

- A new anesthesia-administration form starts with the current local time in `HH:mm` form.
- `Now` and `Clear` work for injection and topical administration.
- Manual edits are preserved exactly through event creation and note/export output.
- Assessment-only forms do not invent an administration time.
- Common-agent seeds are added only from an approved clinical list.
- Seed agents appear as optional suggestions and never select a dose, concentration, route, technique, or adequacy response.
- Users can hide and restore seed suggestions.
- Users can edit and delete their own shortcuts.
- Tests cover time initialization, `Now`, `Clear`, manual edits, legacy values, seed hiding/restoration, and user-item deletion.

## Recommended Order

Implement local-anesthesia time controls and catalog wording first because they are small, isolated usability changes. Then implement the backup-and-recovery surface, beginning with discovery and new-encounter-only import before adding revision conflict resolution.

## Verification

- Run `npm test` for catalog, form-state, import, encryption, and transactional behavior changes.
- Run `npm run build` after code or configuration changes.
- Run `npm run docs:check` after this spec or its lifecycle status changes.

