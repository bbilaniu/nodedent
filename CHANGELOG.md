# Changelog

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
