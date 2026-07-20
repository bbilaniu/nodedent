# Changelog

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
