---
document_type: review
status: historical
reviewed_on: 2026-07-11
reviewed_commit: 5fb0adb9dda26c694593bb1ad92dbf6075c4ec57
reviewed_url: https://nodedent.com
review_method: static-live-and-source-review
---

# NodeDent Website Review

> Historical snapshot: findings describe the deployed site and `main` at commit
> `5fb0adb9dda26c694593bb1ad92dbf6075c4ec57` on 2026-07-11. They are not a
> statement of current implementation status. Active follow-up work belongs in
> the owning ADR or implementation spec linked from each finding.

**Reviewed target:** [nodedent.com](https://nodedent.com) and the connected
[`bbilaniu/nodedent`](https://github.com/bbilaniu/nodedent) repository, default
branch `main`.

**Change policy:** Observation and testing only. No application or repository
changes were made during the review.
  
## Executive summary  
  
NodeDent has a strong technical foundation for an early clinical-workflow application:  
  
- The workflow engine, note generation, schemas, workflow registry, and React UI are meaningfully separated.  
- The application already has broad domain-level automated tests, local autosave, case resume, JSON import/export, dark mode, responsive layouts, and event-backed clinical modules.  
- The newer workflow-neutral home screen is a good architectural direction and reduces the earlier endodontic bias.  
  
The most important improvements are not cosmetic. They concern **patient-data handling, recoverability, validation, accessibility, and automated deployment assurance**.  
  
The highest-priority finding is that patient identifiers and clinical case content are stored as clear-text browser `localStorage` values. Patient number, tooth, and procedure also appear in storage keys and exported filenames. This is convenient for a local-first prototype, but it is not a sufficiently explicit or robust privacy model for routine use with real patient information.  
  
The next priorities are to:  
  
1. Define and enforce the privacy/security boundary.  
2. Protect destructive actions and exported files.  
3. Validate imported data through the existing schemas and migrations.  
4. Add CI and real browser-level end-to-end testing.  
5. make dialogs, error feedback, and forms reliably keyboard- and screen-reader-accessible.  
6. Make autosave failures, conflicts, and recovery visible to the clinician.  
  
## Scope and test method  
  
**Completed observations and tests**  

| Area | Result | Notes |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTPS site reachability | Pass | The public root responded over HTTPS. |
| HTTP-to-HTTPS behavior | Pass | The HTTP root resolved to the HTTPS application. |
| Public indexing/content discovery | Observed | Search indexing exposed the current clinical-workspace title and workflow summaries; whether public indexing is desirable remains a product/privacy decision. |
| Repository/source inspection | Completed | Inspected application entry point, launcher, case setup, saved-case handling, persistence, form controls, styling, manifest, registry, and test suite. |
| Current workflow inventory | Completed | Endodontic RCT and operative direct restoration are primary workflows; anesthesia, isolation, and radiology are shared modules. |
| Persistence behavior review | Completed | Reviewed current-case autosave, case index, saved records, import, export, deletion, and reset logic. |
| Accessibility code review | Completed | Reviewed labeling, invalid-state semantics, modal structure, keyboard/focus behavior visible in source, and target sizing. |
| Automated test-suite review | Completed | Reviewed the large Node test suite and its coverage themes. |
| Latest-commit assurance status | Partial | A GitHub Pages deployment workflow existed and ran `npm ci` plus `npm run build` after pushes to `main`. No commit statuses were attached to the reviewed commit, and the workflow did not provide pull-request CI, explicit test/docs checks, browser tests, or accessibility tests. |
  
  
### Limitations  
  
The live site is a client-rendered single-page application, and the available web inspection tool did not provide an interactive browser session. Therefore, this review did **not** execute real clicks, keyboard navigation, screen-reader output, mobile rotation, Lighthouse, axe, network throttling, or visual-regression testing.  
  
The repository test command was inspected but not executed during this dated review because a runnable checkout was not available in that execution environment. Findings that depend on runtime browser behavior are identified as items to verify, not reported as confirmed defects. Later repository work must revalidate them rather than treating this report as current test evidence.
  
## What is working well  
  
### 1. The architecture is becoming workflow-neutral  
  
The current home screen presents primary workflows separately from shared clinical modules. New cases start with no treatment selected, and starting a workflow assigns the appropriate procedure. This is a meaningful improvement over an endodontic-first shell.  
  
**Why this matters:** It supports the broader NodeDent direction in which one appointment can contain unrelated tooth-specific workflows without forcing all clinical activity through an RCT model.  
  
### 2. Domain logic is intentionally separated from browser and React concerns  
  
The test suite explicitly checks that engine and note modules do not depend on React, the DOM, `window`, `document`, `navigator`, or browser storage.  
  
**Benefit:** This makes the clinical logic easier to test, migrate, reuse, and eventually run in another interface or persistence model.  
  
### 3. Event-backed documentation is a strong foundation  
  
Anesthesia, isolation, radiology, endodontic decisions, and operative setup/restoration are represented through clinical events and derived capability state.  
  
**Benefit:** This is better than relying only on mutable form fields. It supports note reconstruction, workflow handoffs, scoped readiness, and later audit/history improvements.  
  
### 4. The test suite is broad at the domain level  
  
The single Node test file covers protocol-node integrity, schemas, status derivation, notes and JSON output, shared-module capability rules, catalogs, persistence normalization, workflow launcher rendering, endodontic progression, and operative behavior.  
  
**Caution:** Breadth in one large test file is useful, but it does not replace browser-level testing, and the file will become harder to navigate as the product grows.  
  
### 5. The UI has thoughtful responsive and dark-mode groundwork  
  
The application uses responsive grid layouts, a 320-pixel minimum page width, mobile wrapping, a persisted light/dark setting, and extensive dark-theme overrides.  
  
### 6. Local-first behavior is clear and fast  
  
The application autosaves locally, supports resuming saved workflows, and exports JSON and human-readable notes without requiring a server round trip.  
  
**Trade-off:** The same local-first design creates the review’s largest privacy, conflict, and recovery risks.  
## Findings and recommendations

Each finding is classified as one of:

- **Confirmed:** directly supported by the reviewed source or deployment response.
- **Inferred risk:** a risk derived from confirmed architecture or behavior.
- **Needs browser verification:** static inspection was insufficient to confirm runtime behavior.

Recommendations record desired outcomes. Detailed implementation requirements and lifecycle status belong in the linked owning document.

### Finding disposition

| Findings | Review classification | Owning documentation |
| --- | --- | --- |
| PRIV-01, PRIV-02 | Confirmed storage/export behavior; confidentiality impact is an inferred risk | [ADR 0007](../adr/0007-define-clinical-data-deployment-mode.md) and [Local data integrity and recovery](../specs/local-data-integrity-and-recovery.md) |
| DATA-01 through DATA-04 | Confirmed from inspected persistence and case-management paths | [Local data integrity and recovery](../specs/local-data-integrity-and-recovery.md) |
| ASSURE-01, ASSURE-02 | Confirmed repository-automation coverage gap; browser behavior remains untested | [Automated assurance](../specs/automated-assurance.md) |
| A11Y-01 through A11Y-03, TOUCH-01 | Static-source findings; runtime accessibility and ergonomics need browser/manual verification | [Accessible interaction](../specs/accessible-interaction.md) |
| REL-01 through REL-03 | Confirmed missing recovery/feedback paths plus inferred failure modes | [ADR 0006](../adr/0006-define-autosave-and-draft-workflow-state-policy.md) and [Local data integrity and recovery](../specs/local-data-integrity-and-recovery.md) |
| PROV-01 | Confirmed product-status/provenance gap | [Global footer and application version](../specs/global-footer-and-application-version.md) owns only the application-version portion; broader workflow/schema provenance remains roadmap work |
| UX-01, UX-02 | Confirmed terminology and information-density concerns; usability impact needs testing | [Workspace cross-workflow consistency](../specs/workspace-cross-workflow-consistency.md) |
| OFFLINE-01, THEME-01, META-01, I18N-01, OBS-01 | Confirmed implementation state with strategic choices still open | [NodeDent long-term product roadmap](../specs/nodedent-long-term-product-roadmap.md) |
  
## P0 — Address before routine use with real patient identifiers  
  
### PRIV-01: Clinical data and patient identifiers are stored in clear-text `localStorage`  
  
The current application:  
  
- Loads and writes the active case through `localStorage`.  
- Creates additional per-case records in `localStorage`.  
- Stores patient number, tooth, diagnosis, prior-visit details, measurements, events, and other clinical content in the case object.  
- Builds the saved-case identifier from patient number, tooth, and procedure.  
  
Browser storage is available to JavaScript on the same origin and to a person or process with access to the browser profile. OWASP specifically advises against storing sensitive information in local storage when confidentiality or authentication is assumed.  
  
#### Recommendations  
- Decide and document one supported mode:  
    - **Prototype/no-PHI mode:** prohibit real patient identifiers and display a persistent warning.  
    - **Local clinical mode:** encrypt case data with a key that is not stored alongside it, add an inactivity lock, and define device/profile requirements.  
    - **Authenticated clinical mode:** move durable storage to a properly secured server and use short-lived local caches.  
- Replace patient-derived record keys with random UUIDs.  
- Keep patient-facing metadata inside the protected record rather than in storage-key names.  
- Add a one-click **Clear clinical data from this device** action with a clear explanation of what is removed.  
- Add an application-level privacy screen or lock after inactivity.  
- Define retention and deletion behavior.  
- Add a threat model covering:  
    - shared computers and browser profiles;  
    - lost devices;  
    - malicious extensions;  
    - cross-site scripting;  
    - backup/cloud-sync of browser profiles;  
    - exported JSON and copied notes.  
- Before clinical deployment, obtain a privacy/security review appropriate to the deployment jurisdiction and clinic environment.  
  
### PRIV-02: Exported filenames include patient number and tooth  
  
The JSON download filename currently follows this pattern:  
  
```
endo-case-{patientNumber}-{tooth}.json

```
  
  
That can expose identifiers in Finder/Explorer, Recent Files, cloud-sync logs, email attachments, backup indexes, and screenshots even when the file contents are otherwise handled carefully.  
  
#### Recommendations  
- Use a non-identifying filename such as:  
  
```
nodedent-case-20260711-143502.json

```
  
  
- Let the user opt into a chart-number filename only after a privacy warning.  
- Add an export dialog that summarizes what the file contains.  
- Provide a clear visual indication that JSON is a complete clinical-data export.  
- Consider a separately generated share-safe or de-identified export.  
  
### DATA-01: Destructive saved-case actions execute without an in-component confirmation  
  
The saved-cases interface exposes:  
  
- **Clear current**  
- **Reset all**  
- **Delete saved case**  
  
The connected handlers remove records immediately. `Reset all` iterates through the application’s storage keys, deletes them, clears the index, and starts a new case.  
  
#### Recommendations  
- Require confirmation for clear, delete, and reset-all actions.  
- For **Reset all**, require a stronger confirmation such as typing `RESET`.  
- State exactly how many saved cases will be removed.  
- Focus the least destructive button when the confirmation dialog opens.  
- Add a brief undo window where feasible.  
- Export or download a backup before reset.  
- Test interrupted deletion and storage failure.  
  
### DATA-02: Imported JSON is normalized permissively rather than validated through the existing schema  
  
`importCaseJson()` parses JSON and sends it to `normalizeImportedEndoCase()`. The normalizer spreads arbitrary top-level data into the case, applies defaults, and casts the result as an `EndoCase`. The repository already contains Zod schemas, but the inspected import path does not use `safeParse()`.  
  
This risks malformed state, difficult-to-diagnose crashes, accidental acceptance of incompatible versions, and silent data loss.  
  
#### Recommendations  
- Require a top-level export kind and explicit schema version.  
- Validate imports with the existing Zod schema before state mutation.  
- Reject unsupported versions with a precise error.  
- Add ordered migration functions, for example:  
    - `migrateV1ToV2`  
    - `migrateV2ToV3`  
- Return field-level errors rather than only “invalid JSON or unsupported case format.”  
- Apply a file/text size limit.  
- Preserve the original import until migration succeeds.  
- Add fixtures for every supported historical version.  
- Test hostile and malformed inputs, unexpected arrays/objects, duplicate event IDs, invalid dates, unknown workflow IDs, and missing scopes.  
## P1 — High-value reliability and safety work  
  
### ASSURE-01: Deployment exists, but required CI assurance is incomplete
  
The repository defines commands for:
  
- `typecheck`  
- `test`  
- `build`  
- documentation checks  
- workflow graph export  
  
The repository already contained a GitHub Pages workflow that installed dependencies and ran `npm run build` after pushes to `main`. The reviewed commit had no attached commit statuses. The workflow did not run on pull requests and did not explicitly run the test suite, documentation lifecycle checks, browser tests, or accessibility tests.
  
#### Recommendations  
Add a required CI workflow that runs on pull requests and the default branch:  
  
```
npm ci
npm run typecheck
npm test
npm run build
npm run docs:check

```
  
  
Also consider:  
  
- dependency audit with an agreed failure policy;  
- lockfile consistency;  
- artifact retention for the production build;  
- branch protection requiring CI;  
- deployment only from a passing commit;  
- a visible build/version identifier inside the app;  
- an automated smoke test against the deployed site.  
  
### ASSURE-02: Existing tests are strong in domain logic but weak in real browser behavior  
  
The current test suite uses Node’s test runner and static React rendering. This is appropriate for deterministic clinical logic, but it cannot verify browser interactions such as:  
  
- opening and closing dialogs;  
- trapping and restoring focus;  
- autosave across reloads;  
- storage quota errors;  
- copy-to-clipboard feedback;  
- touch behavior;  
- actual responsive layouts;  
- dark-mode contrast;  
- keyboard-only completion;  
- import/export through a browser;  
- multi-tab conflicts.  
  
#### Recommendations  
Add Playwright-based end-to-end tests for at least:  
  
1. Start a neutral case and select each primary workflow.  
2. Enter patient/tooth data, reload, and verify autosave recovery.  
3. Create two same-patient/same-tooth encounters and verify they remain distinct.  
4. Switch between operative and endodontic workflows without scope leakage.  
5. Record radiology, anesthesia, and isolation on different teeth.  
6. Complete and resume a multi-canal endodontic case.  
7. Import a valid legacy case and reject an invalid case.  
8. Export all note modes and JSON.  
9. Cancel and confirm every destructive action.  
10. Use all dialogs by keyboard only.  
11. Run at representative phone, tablet, laptop, and wide-desktop widths.  
12. Simulate localStorage denial/quota failure.  
13. Open the same case in two tabs and test conflict handling.  
14. Test dark and light themes with visual snapshots.  
  
Split the large test file into domain-focused suites as the application expands.  
  
### A11Y-01: Modal dialogs do not expose a complete accessible-dialog pattern in the inspected source  
  
Several overlays are implemented as fixed `<div>` and `<section>` elements. In the inspected components, they do not visibly provide:  
  
- `role="dialog"`  
- `aria-modal="true"`  
- `aria-labelledby` or `aria-label`  
- focus movement into the dialog;  
- focus trapping;  
- Escape-to-close handling;  
- focus restoration to the trigger;  
- an inert background.  
  
W3C’s modal-dialog pattern expects these semantics and keyboard behaviors.  
  
#### Recommendations  
- Create one reusable `Dialog` component.  
- Prefer the native `<dialog>` element where it fits, with a tested fallback/design.  
- On open:  
    - move focus to the title or first appropriate control;  
    - make background content inert.  
- Trap `Tab` and `Shift+Tab` within the dialog.  
- Close on Escape unless doing so would discard unconfirmed work without warning.  
- Restore focus to the invoking control.  
- Add `role`, `aria-modal`, and an accessible name.  
- Prevent background scroll.  
- Put the least destructive action first in destructive confirmations.  
- Add automated axe checks and manual VoiceOver/NVDA testing.  
  
### A11Y-02: Invalid states and feedback are not consistently exposed semantically  
  
`TextInput` changes its border color for an invalid value, but the inspected component does not add `aria-invalid` or connect an error message through `aria-describedby`.  
  
The JSON import textarea uses placeholder text but no visible label. Copy failure is silently converted back to the uncopied state, without explaining the problem.  
  
#### Recommendations  
- Add `aria-invalid` to invalid controls.  
- Render specific error text with a stable ID and `aria-describedby`.  
- Give every textarea a visible label, including JSON import.  
- Add `aria-live="polite"` for:  
    - autosave state;  
    - successful copy;  
    - copy failure;  
    - import errors;  
    - workflow validation failures.  
- Do not rely on color alone for required, invalid, complete, warning, and expired states.  
- Add a form-level error summary that links to each invalid field.  
  
### REL-01: Autosave is frequent but its failure and conflict states are not visible  
  
The app writes the full case after a 500 ms delay whenever case data or the current node changes. The write path is not wrapped in visible error handling.  
  
Potential failure modes include:  
  
- private browsing or restricted storage;  
- quota exceeded;  
- malformed previous data;  
- multiple open tabs;  
- device/browser cleanup;  
- a stale tab overwriting newer work;  
- storage becoming unavailable mid-appointment.  

The draft-versus-durable-history boundary is governed by [ADR 0006](../adr/0006-define-autosave-and-draft-workflow-state-policy.md). That ADR does not resolve storage failures, backup/recovery, or cross-tab conflict handling; those remain owned by the local-data reliability spec.
  
#### Recommendations  
- Wrap every storage read/write/remove operation in a persistence service.  
- Return structured success/failure results.  
- Display:  
    - `Saving…`  
    - `Saved locally at 14:32`  
    - `Save failed — download a backup`  
    - `This case changed in another tab`  
- Add a monotonically increasing revision or `updatedAt`.  
- Use `BroadcastChannel` or the `storage` event for cross-tab conflict detection.  
- Never overwrite a newer revision silently.  
- Offer an emergency JSON download when persistence fails.  
- Add periodic backup snapshots rather than only overwriting one current record.  
- Consider IndexedDB for transactional local storage, while remembering that it does not by itself provide confidentiality.  
  
### PROV-01: Clinical provenance and product status should be more explicit  
  
The UI identifies NodeDent as a “clinical workspace” and includes a chairside state-machine guide. A clinician should be able to tell:  
  
- whether a workflow is experimental, draft, reviewed, or released;  
- which clinical references informed it;  
- which workflow version generated a note;  
- what changed between versions;  
- whether a recommendation is a documentation shortcut or clinical guidance;  
- what remains the clinician’s responsibility.  
  
#### Recommendations  
- Display application version, workflow version, and release date.  
- Add a workflow information panel with:  
    - intended use;  
    - exclusions;  
    - references;  
    - author/reviewer;  
    - last clinical review date;  
    - change log.  
- Clearly distinguish:  
    - software availability;  
    - recorded documentation;  
    - derived readiness;  
    - clinical adequacy;  
    - recommendation.  
- Ensure catalog seed values are labeled as documentation shortcuts, not treatment defaults.  
- Include workflow and schema versions in every export.  
- Add regression fixtures for clinically important note outputs.  

Application-version display is now owned by [Global footer and application version](../specs/global-footer-and-application-version.md). That spec must not be treated as satisfying workflow-definition, schema, clinical-reference, or review-status provenance.
## P2 — Usability, workflow clarity, and maintainability  
  
### UX-01: “Ready” is used for different concepts  
  
The launcher registry uses `Ready` to mean that a workflow/module is implemented and launchable. Other areas use readiness language to describe whether clinical prerequisites have been satisfied.  
  
This can make “Ready” ambiguous: is the software available, or is the patient/workflow clinically ready?  
  
#### Recommendations  
Use distinct vocabulary:  

| Meaning                                 | Suggested label  |
| --------------------------------------- | ---------------- |
| Feature exists and can be opened        | Available        |
| No case data recorded                   | Not started      |
| Some data recorded                      | In progress      |
| Required documentation present          | Documented       |
| Needs review because scope/time changed | Reassess         |
| Workflow ended                          | Complete         |
| Clinical judgment still required        | Clinician review |

Terminology and launcher consistency are owned by [Workspace cross-workflow consistency](../specs/workspace-cross-workflow-consistency.md).
  
  
### UX-02: The first-run/home screen remains information-dense  
  
The home screen shows case facts, shared-module status, primary workflow cards, and shared-module cards. This is useful for an established case but can feel heavy for an empty case.  
  
#### Recommendations  
- Add a first-run empty state:  
    1. Identify the case.  
    2. Choose a primary workflow.  
    3. Record shared modules when relevant.  
- Make **Start new case** or **Resume saved case** the two most prominent initial actions.  
- Collapse repeated “not started” shared-module summaries until a case target exists.  
- Show the selected target scope directly on every module card when it differs from the case tooth.  
- Continue generalizing `Prior visit` so it is not visually owned by endodontics when other workflows need it.  
- Test whether “Case Setup & Status” is understandable to a first-time user without prior product knowledge.  

Home/launcher hierarchy work is owned by [Workspace cross-workflow consistency](../specs/workspace-cross-workflow-consistency.md).
  
### DATA-03: Saved encounter identity can collide  
  
The case ID is derived from:  
  
```
patient number + tooth + procedure

```
  
  
Two visits for the same patient, tooth, and procedure will produce the same identifier and can overwrite or merge into the same saved record.  
  
#### Recommendations  
- Generate a random immutable case/encounter UUID.  
- Store patient number, tooth, and procedure as searchable metadata.  
- Add encounter date and optional appointment identifier.  
- Show a human-readable case label while preserving the UUID internally.  

This finding concerns encounter identity and saved-record collision. Multiple independently scoped workflows inside one appointment are a separate architectural concern owned by [Repeatable workflow instances](../specs/repeatable-workflow-instances.md).
  
### DATA-04: The saved-case index is capped at 12 without visible lifecycle behavior  
  
The index keeps only the newest 12 summaries. Older per-case records are not removed by that slice operation, so records can become unlisted/orphaned in local storage.  
  
#### Recommendations  
- Make retention explicit and configurable.  
- Either:  
    - remove records that fall out of the index;  
    - archive them visibly; or  
    - paginate/search the full library.  
- Display storage usage and record count.  
- Add a repair/rebuild-index tool.  
- Test index corruption and orphan recovery.  
  
### OFFLINE-01: PWA metadata exists, but offline behavior was not established  
  
The project contains:  
  
- a web manifest;  
- standalone display mode;  
- application icons;  
- mobile web app metadata.  
  
No service-worker implementation or registration was found in the inspected entry point or build configuration.  
  
A manifest can make an app feel installable, but reliable offline operation requires an intentional caching and update strategy.  
  
#### Recommendations  
- Decide whether offline is a supported product promise.  
- If yes:  
    - add a service worker;  
    - cache only static application assets;  
    - avoid caching sensitive exports/responses;  
    - show online/offline state;  
    - show the currently running build version;  
    - implement safe update/reload behavior;  
    - test first load, repeat load, offline reload, and interrupted deployment.  
- If no:  
    - avoid implying that installation equals offline reliability.  
  
### TOUCH-01: Some controls may be small for chairside/touch use  
  
Header buttons use a minimum height of 36 CSS pixels. This is above WCAG 2.2’s 24-pixel minimum target-size criterion, but may still be uncomfortable for one-handed, hurried, or gloved chairside interaction.  
  
#### Recommendations  
- Test 44–48 pixel controls for primary chairside actions.  
- Increase spacing between destructive and adjacent actions.  
- Keep high-frequency actions within thumb reach on phones/tablets.  
- Test with gloves and a mounted tablet, not only a desktop pointer.  
- Use larger targets for checkboxes and status tiles.  
- Verify zoom to 200% and text spacing without clipping.  
  
### A11Y-03: Focus styling should be standardized  
  
Inputs have explicit focus rings. The shared button style tokens mostly define hover states and do not consistently define `focus-visible` styling.  
  
The browser may still show a default outline, but a clinical application should not depend on inconsistent browser defaults.  
  
#### Recommendations  
- Add a shared `focus-visible` ring token to every interactive control.  
- Verify contrast in light and dark themes.  
- Include links, tabs, cards acting as buttons, checkboxes, and icon-only controls.  
- Add screenshot tests for keyboard focus states.  
  
### THEME-01: Dark mode relies on many manual utility overrides  
  
The dark theme maps individual classes and class fragments to dark equivalents. This works now but can miss newly introduced colors or opacity variants.  
  
#### Recommendations  
- Move to semantic design tokens for:  
    - surface;  
    - elevated surface;  
    - text;  
    - muted text;  
    - border;  
    - success;  
    - warning;  
    - danger;  
    - info.  
- Avoid selectors tied to specific generated utility strings where possible.  
- Add contrast tests and dark-mode visual regression snapshots.  
- Verify native selects, date inputs, autofill, disabled controls, print output, and browser high-contrast mode.  
  
### REL-02: Application errors need a clinician-safe recovery path  
  
No React error boundary was identified in the inspected entry point. A render error could leave the user without an obvious way to recover or export the current case.  
  
#### Recommendations  
- Add a top-level error boundary.  
- On failure, offer:  
    - reload application;  
    - download raw local backup;  
    - copy diagnostic information without patient data;  
    - clear only the broken current draft;  
    - return to saved cases.  
- Log a non-PHI error code and app version.  
- Test malformed imported state and intentionally thrown render errors.  
  
### REL-03: Clipboard failure is silent  
  
When copying a note fails, the app simply returns to the uncopied state.  
  
#### Recommendations  
- Show a visible error: “Clipboard access failed. Select the note and copy manually.”  
- Provide a select-all fallback.  
- Test non-secure contexts, denied permission, iOS Safari, embedded web views, and older browsers.  
## P3 — Product polish and future scale  
  
### META-01: Public metadata is minimal  
  
The HTML contains a title, description, theme metadata, icons, and manifest, but the description is generic.  
  
#### Recommendations  
- Decide whether the root is a public product page or a clinician-only app.  
- For a public product:  
    - add a concise explanation of purpose and limitations;  
    - add Open Graph metadata and a canonical URL;  
    - include privacy/security documentation;  
    - keep the interactive workspace behind an explicit launch action.  
- For a private/internal tool:  
    - consider preventing public indexing;  
    - add authentication before any server-backed patient storage is introduced.  
  
### I18N-01: Internationalization is not yet explicit  
  
UI labels are English, while date/time output uses the browser locale.  
  
#### Recommendations  
- Define supported languages and clinical terminology sources.  
- Separate UI strings from code.  
- Store timestamps in ISO format and format them at display time.  
- Make notation, date format, decimal separator, and tooth notation explicit per user/clinic.  
- Ensure exported notes use a selected language/locale rather than whichever browser opened the case.  
  
### OBS-01: Observability should be privacy-preserving  
  
No production telemetry was identified in the inspected code. That avoids accidental data leakage, but it also makes failures difficult to understand.  
  
#### Recommendations  
- Collect only non-clinical operational events, such as:  
    - app version;  
    - page load failure;  
    - persistence failure category;  
    - workflow ID without tooth/patient data;  
    - anonymized performance timings.  
- Never send note content, patient numbers, teeth, diagnoses, measurements, event details, or exported text to analytics by default.  
- Provide an opt-out and a transparent data inventory.  
## Related branch disposition

Branch ancestry alone is misleading when GitHub used squash merges. The branch audit performed after this review established:

| Branch | Disposition | Documentation impact |
| --- | --- | --- |
| `9-implement-changesets-and-establish-the-nodedent-release-versioning-baseline` | Squash-merged in [PR #10](https://github.com/bbilaniu/nodedent/pull/10); its tip tree matches the integration commit and the branch can be pruned | No additional finding |
| `codex/isolation-module` | Squash-merged in [PR #7](https://github.com/bbilaniu/nodedent/pull/7); its tip tree matches the integration commit and the branch can be pruned | No unresolved isolation-module documentation |
| `note-artifacts-and-treatment-plan-model` | Not merged; its four commits are contained in `codex/2026-06-24-hardening` | Clinical-note issues remain in [Clinical note generator QA](../specs/codex-verification-outputs.md), not this review |
| `codex/2026-06-24-hardening` | Genuine unmerged work requiring selective salvage rather than a wholesale merge | Note correctness remains in the existing note QA spec; durable workflow instances and the appointment map belong in [Repeatable workflow instances](../specs/repeatable-workflow-instances.md) |

Fully merged remote topic branches are repository-cleanup candidates only and do not create additional findings in this review.

## Recommended implementation sequence  
  
### Phase 1 — Safety boundary and data integrity  
  
1. Define whether real patient identifiers are currently permitted.  
2. Replace patient-derived case IDs with UUIDs.  
3. Remove patient identifiers from export filenames.  
4. Add confirmation/undo for destructive storage actions.  
5. Validate imports with Zod and explicit schema versions.  
6. Add storage error handling and visible backup/recovery controls.  
  
### Phase 2 — Automated assurance  
  
1. Add GitHub Actions for install, typecheck, tests, build, and docs checks.  
2. Add Playwright smoke and critical-path tests.  
3. Add axe accessibility checks.  
4. Add a deployment smoke test.  
5. Make CI required before merge/deployment.  
  
### Phase 3 — Accessible interaction  
  
1. Introduce a shared accessible dialog component.  
2. Add focus management and Escape behavior.  
3. Add semantic invalid/error states and live announcements.  
4. Standardize focus-visible styling.  
5. Test VoiceOver, NVDA, keyboard-only, zoom, and touch.  
  
### Phase 4 — Workflow clarity and offline strategy  
  
1. Clarify availability versus clinical readiness labels.  
2. Simplify first-run home.  
3. Expose exact workflow scopes.  
4. Decide and implement—or explicitly defer—offline service-worker support.  
5. Add workflow provenance/version information.  
  
### Phase 5 — Scale and maintainability  
  
1. Split tests by domain.  
2. Move dark mode to semantic tokens.  
3. Add case-library search/retention/index repair.  
4. Add privacy-safe observability.  
5. Add localization infrastructure.  
## Suggested acceptance criteria for the next review  
  
A future review should be able to demonstrate all of the following:  
  
- A real patient identifier is never stored or exported without an explicit supported privacy mode.  
- Two visits for the same patient/tooth/procedure cannot collide.  
- Invalid or future-version JSON cannot enter application state.  
- Reset-all and delete actions cannot occur accidentally.  
- A storage failure produces a visible warning and backup option.  
- All required checks run automatically on every pull request.  
- A browser test completes both primary workflows’ critical paths.  
- Every modal traps focus, closes appropriately with Escape, and restores focus.  
- Every invalid field is announced by a screen reader.  
- The application works at phone, tablet, laptop, and wide-desktop widths.  
- Light and dark themes pass contrast and visual-regression checks.  
- The UI clearly distinguishes feature availability from clinical readiness.  
- Workflow/version provenance is present in the UI and exports.  
- Offline behavior is either tested and supported or clearly not promised.  
## Evidence reviewed  
  
### Live deployment  
  
- `https://nodedent.com`  
- HTTP root redirect/resolution to HTTPS  
- Search-indexed workspace and workflow summaries  
  
### Repository paths  
  
- `package.json`  
- `vite.config.ts`  
- `index.html`  
- `public/favicon/manifest.json`  
- `src/main.tsx`  
- `src/styles.css`  
- `src/nodedent/NodeDentApp.tsx`  
- `src/nodedent/state/persistence.ts`  
- `src/nodedent/components/WorkflowLauncher.tsx`  
- `src/nodedent/components/CaseManagementModal.tsx`  
- `src/nodedent/components/CaseSetupStatusPanel.tsx`  
- `src/nodedent/components/FormControls.tsx`  
- `src/nodedent/components/uiStyles.ts`  
- `src/nodedent/workflow/registry.ts`  
- `src/nodedent/__tests__/engine.test.ts`  
  
### External reference guidance  

- [OWASP HTML5 Security Cheat Sheet — Storage APIs](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis) (accessed 2026-07-11)
- [WAI-ARIA Authoring Practices — Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) (accessed 2026-07-11)
- [WCAG 2.2 — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) (accessed 2026-07-11)
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (accessed 2026-07-11)
- [web.dev — Service workers and the Cache Storage API](https://web.dev/learn/pwa/service-workers) (accessed 2026-07-11)
## Bottom line  
  
NodeDent’s domain architecture is ahead of its current product-hardening layer. The best next investment is not adding another workflow. It is making the existing workflows safe to trust: explicit data handling, validated persistence, recoverable autosave, accessible dialogs, and required automated browser/CI checks.  
  
Once those foundations are in place, the workflow-neutral home and shared-module architecture provide a credible base for expanding into extraction, hygiene, and other dental workflows.  
