# Changelog

## 2.4.4

### Patch Changes

- 2e113a6: Improve light-theme muted-text contrast and keep background application chrome hidden from assistive technology while a dialog is open. Add keyboard and accessibility regression coverage for vault access and recording versus dismissal.
- 5d50e2c: Add focused keyboard and axe accessibility checks to the existing quality gates, plus a read-only post-deployment check for application loading and independently expected version, mode, and commit identity. Preserve pre-deployment and Beta synchronization checks; defer full primary-workflow journeys.

## 2.4.3

### Patch Changes

- 223debd: Strengthen CI with lint, workflow validation, deployment-mode builds, and synthetic Chromium tests for vault access, recording, persistence, and case transfer. Require the expanded checks before deployment and automatic Beta synchronization, and identify PR builds by the commit actually tested.
- 459c61e: Show rejected case JSON import errors inside the import dialog, including when importing from the vault entry screen, with an accessible link to the input. Clear the error when the input changes.

  Correct operative memo dependencies and stabilize Case Setup focus dependencies while introducing the lint gate.

## 2.4.2

### Patch Changes

- 08e8f80: Apply the semantic action, selection, status, and form-focus contracts to Case Entry and Case Setup so workflow selection no longer looks like positive clinical status and principal, secondary, and plaintext-download actions have consistent visual hierarchy.
- ee65fd5: Complete the semantic UI migration for vault, validation, workflow feedback, measurements, clinical runners, import, privacy, and floating actions, and add accessible dialog focus, keyboard, background, scroll, restoration, and discard-warning behavior.
- 94c695b: Apply semantic selection, status, action, focus, and list contracts to workflow targets, note history and output, catalogue administration, and encrypted recovery rows.
- 14b8725: Standardize dialog structure, dismissal, high-consequence decision actions, saved-case administration, and phase/canal selection without changing clinical workflow behavior.
- 08e8f80: Align application chrome, vault feedback, deployment and clinical-data notices, difficulty banners, and footer focus with the shared semantic action and status contracts.

## 2.4.1

### Patch Changes

- 796d586: Keep endodontic and operative setup in their owning workflows instead of duplicating those sections in Case Setup & Status, while preserving workflow launch actions from Treatment plan.

  Place the Sandbox data warning below the complete Import and Vault action row so it spans the protected-vault card width.

## 2.4.0

### Minor Changes

- fed8ebc: Add discipline-scoped endodontic diagnosis management and reorganize Case Setup into consistent Diagnosis, Radiographs, Anesthesia, and Isolation readiness cards that route documentation to their owning surfaces without a duplicate readiness summary.

  Keep endodontic measurements available from the first workflow step, show the active tooth and canal in measurement and progress panels, and guide users to Case Setup when the workflow tooth is missing.

  Introduce shared semantic contracts for action prominence, selected controls, and clinical status across workflow launchers and shared modules, including consistent record, navigation, and return actions plus a development state gallery and regression coverage.

## 2.3.1

### Patch Changes

- 83192fb: Created the catalogue management page. Cleaned up the anesthetic workflow and clarified the shared workflows

## 2.3.0

### Minor Changes

- 1bfb9c5: Add fail-safe Current, Beta, and Sandbox deployment identities for GitHub and Cloudflare Workers Builds, visible mode warnings, artifact validation, and historical release branch automation with pre-publication Sandbox checks.

### Patch Changes

- 9eb06ea: Hide the active encounter from the saved-case review action, use consistent plural wording for saved cases, standardize file-picker controls, collapse backup and catalogue import workflows until needed, and automatically preview authenticated backup imports.

## 2.2.1

### Patch Changes

- 225c69d: Show derived workflow progress in Case Setup and preserve workflow-owned targets when the default tooth changes.

## 2.2.0

### Minor Changes

- 6860bb8: Improve chairside continuation and contextual requirements, add repeatable anesthesia and radiograph documentation with shared catalogue preferences, and add timestamped encrypted backups with safe new-encounter import, content-aware conflict review, protected replacement, and recoverable encrypted history. Make vault entry and recovery easier with direct case JSON file import, encrypted-vault import and download actions after unlock, a consistent backup file picker and form-control typography, clearer action grouping and hierarchy on the opened-vault screen, and a persistent theme control on the vault lock screen. Clear paused canal status when treatment resumes so closure validation uses the canal's current derived treatment state.

## 2.1.1

### Patch Changes

- cb81017: Open the full-page Case Setup after confirming a new case from the clinical workspace or workflow launcher.

## 2.1.0

### Minor Changes

- Redesign Case Setup as a full-page workspace with durable endodontic and operative workflow selections that can coexist in one clinical case.

## 2.0.3

### Patch Changes

- a57e9db: Add a post-unlock case entry screen that distinguishes untouched vault placeholders from meaningful active cases and only offers saved-case review when another meaningful case exists.

## 2.0.2

### Patch Changes

- 16bf200: Require an explicit target scope when recording shared anesthesia, isolation, and radiology readiness, and show existing out-of-scope records as needing review instead of incorrectly reporting that nothing was recorded.

## 2.0.1

### Patch Changes

- 2cc1870: Give encrypted backup restore its own passphrase field and show actionable validation errors instead of silently disabling the restore action when its required input is missing.

## 2.0.0

### Major Changes

- cec74ef: Replace plaintext case `localStorage` with a passphrase-protected encrypted IndexedDB vault, explicit locking and recovery controls, safer versioned exports, and a no-migration boundary for legacy browser records. Add an accessible product privacy policy and a global application-version footer. Existing prototype browser cases remain separate and must be explicitly backed up or deleted.

## 1.0.0

### Major Changes

- Establish the first formally versioned NodeDent clinical workspace release.

  **User-visible changes**

  - Added a workflow-neutral home screen for selecting primary workflows.
  - Added endodontic RCT and operative direct-restoration workflows.
  - Added shared anesthesia, isolation, and radiology modules.
  - Added local autosave, saved-case resume, and JSON import/export.
  - Added multiple clinical-note and data-output formats.
  - Added responsive layouts and dark mode.

  **Clinical architecture**

  - Added event-backed workflow documentation.
  - Added scoped shared-module readiness and capability tracking.

  **Compatibility**

  - This release establishes application-level versioning.
  - Workflow-definition versions remain independently managed.
  - No persisted-case schema migration is introduced by this Changeset.

This project began using formal application release versioning with Changesets in 2026.

## Historical development before formal versioning

The following capabilities were developed before application releases were formally tracked with Changesets:

- Established the NodeDent clinical workspace and workflow-neutral home screen.
- Added the endodontic RCT workflow.
- Added the operative direct-restoration workflow.
- Added shared anesthesia, isolation, and radiology modules.
- Added event-backed clinical documentation and scoped readiness tracking.
- Added local autosave, saved-case resume, and JSON import/export.
- Added compact, full, patient, printable, event-log, and JSON outputs.
- Added responsive layouts, dark mode, and automated workflow tests.

This section is a retrospective summary of Git history. It does not represent separately issued historical semantic releases.
