---
status: active
created_on: 2026-06-20
---

# Workspace Cross-Workflow Consistency

This spec defines the next workspace cleanup pass after the operative direct restoration workflow became usable. It focuses on making NodeDent feel like one clinical workspace across endodontic, operative, and shared-module contexts before adding another primary workflow family.

The previous main workspace shell cleanup moved the app identity toward NodeDent, scoped endodontic canal progress behind an active-workflow target panel, and moved shared readiness into a reusable card. The operative direct restoration workflow then added the first non-endodontic primary workflow with its own setup, runner, restoration output, notes, and export behavior.

The next step is not another clinical protocol. It is to make the existing workflows behave consistently enough that future cleaning, hygiene, radiology, or broader operative workflows can reuse established workspace patterns instead of adding more one-off surfaces.

## Context

Current baseline:

- NodeDent Home can launch endodontic RCT, operative direct restoration, and shared module workflows.
- Case Setup & Status owns broad case setup, shared readiness capture, and workflow-specific setup entry points.
- Endodontic RCT uses canal-specific protocol nodes, canal status, measurements, and an endodontic target/progress panel.
- Operative direct restoration owns tooth/surface setup, shared readiness review, restoration recording, and `finalRestoration.placed` output.
- Shared anesthesia and isolation modules use event-backed documentation and reusable capabilities.
- Radiographs are still case setup fields, with `shared.radiology` defined as the future module boundary.

Known friction:

- Launcher labels, readiness labels, status text, and empty states are not yet fully parallel across primary workflows and shared modules.
- Endodontic workflow surfaces are more mature and visually denser than operative surfaces.
- Case Setup & Status still contains mixed responsibilities: case identity, endodontic setup, operative setup, shared readiness, quick capture, saved-case lifecycle, and audit/history surfaces.
- Shared module entry points work, but their labels and placement vary by context.
- Operative workflow UI is usable, but it should be checked against the same readiness-band, target-panel, and action-label patterns as endodontic RCT.

## Goals

- Make launcher, readiness, setup, runner, completion, and return-to-home behavior consistent across endodontic RCT, operative direct restoration, shared anesthesia, and shared isolation.
- Keep workflow-specific target panels strict: endodontic canals stay endodontic; operative tooth/surface setup stays operative; shared module scopes stay shared.
- Normalize status labels, action labels, empty states, and completion messaging so users can predict how each workflow behaves.
- Clarify the responsibility split between NodeDent Home, Case Setup & Status, shared readiness, active workflow runners, and workflow-specific target panels.
- Perform a light visual hierarchy pass on the main workspace so workflow surfaces feel related without flattening their clinical differences.
- Add tests for routing and visibility guardrails where cross-workflow behavior can regress.

## Non-Goals

- Do not add cleaning, hygiene, perio, or broader operative clinical protocol steps in this spec.
- Do not invent clinical guidance, sequencing, materials, adequacy rules, or recommendations.
- Do not edit clinical source material in `docs/source/`.
- Do not implement `shared.radiology`; keep radiology work in the active shared radiology spec.
- Do not merge endodontic closure and operative final restoration capabilities.
- Do not create a universal target model for canals, surfaces, quadrants, sextants, and arches.
- Do not replace the existing workflow engine or event ledger.
- Do not redesign the app as a marketing or landing page.

## Product Principles

### One Workspace, Workflow-Specific Surfaces

NodeDent should feel like one workspace, but each workflow keeps ownership of its clinical target model and event output.

Examples:

- Endodontic RCT owns canals, working lengths, canal continuation, endodontic phase progress, and endodontic closure events.
- Operative direct restoration owns tooth/surface setup, restorative documentation fields, and operative restoration output.
- Shared anesthesia owns anesthetic documentation and scoped anesthesia capability output.
- Shared isolation owns isolation documentation and scoped isolation capability output.

### Shared Readiness Is Reusable, Not Workflow-Owned

Diagnosis, radiographs, anesthesia, and isolation readiness can be displayed in endodontic and operative contexts when their scopes match. The readiness UI should not copy shared module data into workflow-owned state or imply that NodeDent has judged clinical adequacy beyond the recorded event or field.

### Similar Labels Should Mean Similar Interaction

Actions such as `Start`, `Resume`, `Record`, `Review`, `Complete`, `Add event`, `Open setup`, and `Return home` should behave predictably across workflows. If a workflow needs different behavior, the label should make that difference clear.

### Empty States Should Be Actionable

Missing setup, missing readiness, and missing workflow output should be shown with compact context and a clear next action. Empty states should not read as errors unless the user is blocked by validation.

## Proposed Changes

### 1. Launcher And Home Consistency

Review NodeDent Home entries for primary workflows and shared modules.

Expected behavior:

- Primary workflows show workflow name, brief status, availability, and a clear launch/resume action.
- Shared modules show their reusable documentation purpose and a clear record/review action.
- Unavailable or future workflows are clearly marked without appearing broken.
- Launching a workflow updates active workflow context and preserves shared readiness behavior.
- Returning home does not discard event-backed state.

Implementation notes:

- Prefer existing workflow launcher registry patterns.
- Avoid hard-coding endodontic or operative exceptions in NodeDent Home when a registry property can express the behavior.
- Keep labels short enough for mobile and desktop layouts.

### 2. Readiness Band Consistency

Review the shared readiness surface in endodontic and operative contexts.

Expected behavior:

- Diagnosis, radiographs, anesthesia, and isolation rows use consistent status language.
- Each row exposes a focused action in primary workflow contexts: Diagnosis -> focus diagnosis, Radiographs -> focus radiographs, Anesthesia -> open anesthesia workflow, and Isolation -> open isolation workflow.
- Readiness remains advisory/documentation-oriented, not a hard clinical gate.
- Scope-sensitive readiness summaries name the relevant target when useful, such as tooth, canal, or operative surfaces.
- Missing readiness rows provide a route to record or review the relevant shared data.
- Shared readiness should sit above workflow-specific target/progress panels rather than pushing those panels down inside a narrow rail.
- Prefer a full-width readiness band below the header and above the active workflow grid. This reflects that diagnosis, radiographs, anesthesia, and isolation are common readiness concerns for most dental treatment, while still keeping them distinct from the active clinical decision.
- Do not include a generic `Case Setup` button in the readiness band when the header already has `Case Setup & Status`. Keep readiness actions row-specific so the band does not duplicate global navigation.

Implementation notes:

- Use existing capability selectors and scope-matching rules.
- Keep radiographs compatible with current case setup fields until `shared.radiology` is implemented.
- Add tests for endodontic and operative readiness card rendering if current coverage does not protect the labels and actions being changed.
- Use a compact horizontal row layout for the four readiness items at wider breakpoints instead of simply stretching the current narrow stacked card.
- On small screens, allow the readiness band to stack before the active workflow and target/progress panels.
- If diagnosis or radiographs still need Case Setup & Status as their editing surface, make those row actions open the relevant focused section instead of exposing a separate generic setup button.
- The readiness band should show for primary workflows and shared modules, but should disable the currently open shared module row so that workflow cannot open itself recursively.

### 3. Workflow Target Panel Guardrails

Strengthen the active workflow target-panel pattern.

Expected behavior:

- Endodontic RCT shows endodontic progress and canal controls only in endodontic context.
- Operative direct restoration shows operative setup and treatment target context without canal controls.
- Shared modules do not inherit endodontic or operative target panels unless explicitly embedded in a workflow context.
- Unknown or future workflows fail closed with no mismatched clinical target panel.

Implementation notes:

- Keep target-panel routing centralized.
- Tests should cover endodontic, operative, shared, and unknown workflow IDs.
- Do not generalize canals and surfaces into one broad selector.

### 4. Case Setup & Status Responsibility Cleanup

Clarify which Case Setup & Status sections are global, shared, endodontic-specific, and operative-specific.

Expected grouping:

- Case identity and visit metadata.
- Shared readiness and documentation capture.
- Endodontic setup and prior-visit continuity.
- Operative setup and restoration planning fields.
- Saved-case lifecycle, import/export, and audit/history surfaces.

Implementation notes:

- This phase may be a labeling and hierarchy cleanup rather than a component split.
- If component extraction is useful, keep it small and aligned with existing component patterns.
- Do not move clinical source content or alter note semantics as part of layout cleanup.

### 5. Workflow Runner Action Labels

Normalize action labels and completion states across endodontic, operative, anesthesia, and isolation runners.

Expected behavior:

- The primary action for recording documentation uses `Record` language.
- Continuing an active workflow uses `Continue` or `Resume` consistently.
- Completion messaging identifies what was recorded without implying success, adequacy, or recommendation.
- Secondary actions such as returning home, opening setup, or reviewing notes use consistent placement and style.

Implementation notes:

- Preserve clinical event types and note fragments unless a label is purely UI copy.
- Avoid changing clinical wording in generated notes without a separate note-output reason and tests.

### 6. Light Visual Hierarchy Pass

Make the existing workspace surfaces feel like parts of the same product.

Targets:

- NodeDent Home workflow cards.
- Shared readiness band.
- Case Setup & Status section headings and action rows.
- Endodontic target/progress panel.
- Operative setup and runner panels.
- Shared anesthesia and isolation runner entry surfaces.

Expected behavior:

- Dense clinical workspace layout, not a landing page.
- Consistent button sizing, status badges, section headings, and empty-state treatment.
- Clear distinction between active clinical decisions, setup/documentation actions, and read-only summaries.
- Readable light and dark mode states.

## Suggested Implementation Phases

### Phase 1: Inventory And Label Contract

Reasoning level needed: medium.

- Inventory launcher entries, readiness rows, target panels, setup sections, and runner action labels.
- Define a short label contract for start/resume/record/review/complete/return actions.
- Identify copy changes that are UI-only versus note/export wording.
- Add this contract to the spec before broad UI edits if the inventory reveals meaningful ambiguity.

### Phase 2: Launcher And Readiness Alignment

Reasoning level needed: medium.

Status: partially implemented by moving shared readiness into a full-width band below the header, removing the generic Case Setup action from the readiness surface, keeping row-specific readiness actions, showing explicit review/open action labels on readiness rows, using patient-specific shared-module status in launcher cards, dynamically labeling not-started endodontic workflow launch as `Start workflow`, disabling the currently open shared-module row to prevent recursive modal launch, and removing the duplicate operative-runner readiness block so the workspace band owns shared readiness.

- Normalize NodeDent Home launcher labels and status text.
- Normalize shared readiness row labels and actions across endodontic and operative contexts.
- Move shared readiness toward a full-width band below the header.
- Remove the generic Case Setup action from shared readiness once row-specific readiness actions and the header Case Setup & Status action cover the same path.
- Preserve current scope matching and non-blocking behavior.
- Add or update regression tests for launcher/readiness output.

### Phase 3: Target Panel And Setup Guardrails

Reasoning level needed: medium-high.

Status: partially implemented by adding explicit routing coverage for endodontic, operative, shared-module, and unknown workflow IDs; confirming shared-module contexts render no workflow target setup in Case Setup & Status; grouping Case Setup & Status into Case identity, Shared readiness, Endodontic setup, and Operative setup surfaces; and wiring the operative setup group to the same event-backed operative setup state used by the active workflow panel.

- Verify endodontic panels are hidden in operative and shared-module contexts.
- Verify operative setup does not appear in endodontic-only contexts unless explicitly opened.
- Clarify Case Setup & Status section ownership through headings, grouping, or small component boundaries.
- Add tests for workflow target-panel routing and context-specific setup visibility.

### Phase 4: Runner Action And Completion Polish

Reasoning level needed: medium.

Status: partially implemented by changing shared-module runner dismiss actions from `Return to parent workflow` to `Close shared workflow`, keeping the modal header action as `Close`, adding regression coverage so dismiss UI does not use return language reserved for modeled workflow options, and aligning the isolation runner with the anesthesia runner by keeping the workflow close action visible before completion, grouping record/save actions inside the form card, and retaining the full form layout with an appended-event confirmation after placement events are recorded.

- Normalize runner action labels and completion states.
- Keep note and export output unchanged unless intentionally tested.
- Confirm endodontic, operative, anesthesia, and isolation workflows all provide a clear route back to home/setup.

### Phase 5: Visual Hierarchy Pass

Reasoning level needed: medium.

Status: partially implemented by introducing shared panel and section-heading styles, applying them to the shared readiness band, Case Setup & Status groups and focus targets, and operative runner panels while leaving clinical event semantics and generated note behavior unchanged.

- Apply a restrained visual cleanup across the touched workflow surfaces.
- Check mobile and desktop layouts for text wrapping and overlapping controls.
- Keep cards, buttons, and section headings consistent with the existing NodeDent visual system.

### Phase 6: Answered Open Question Follow-Through

Reasoning level needed: medium-high.

Status: partially implemented by confirming NodeDent Home remains the persistent first screen before workflow activation and quick-switcher modal after activation, moving Case Setup & Status operative setup from a duplicate editor to a summary/link surface, routing that link back to the active operative workflow, and changing shared module re-entry labels to `Review` when current anesthesia or isolation status already exists.

- Treat NodeDent Home as the persistent first screen and keep the modal launcher as a quick-switcher, without duplicating workflow state or clearing event-backed state when switching.
- Split Case Setup & Status conceptually and internally into global case setup, shared readiness/documentation capture, workflow setup summaries, saved-case lifecycle, and audit/history surfaces, without creating separate user-facing setup screens yet.
- Move operative-specific setup ownership toward the active operative runner. Case Setup & Status should summarize the operative scope and provide a route back to the active operative workflow instead of being the primary duplicated editing surface.
- Use `Review` for shared modules when a current event already exists. Reserve `Record` language for primary documentation actions and avoid `Add event` where it could imply duplicate creation.
- Show scope metadata inline only when it prevents confusion, such as shared, global, cross-workflow, or mismatched readiness context. Avoid scope labels on obvious active-workflow rows.

## Acceptance Criteria

- NodeDent Home uses consistent status and action language for endodontic RCT, operative direct restoration, shared anesthesia, and shared isolation.
- Shared readiness rows behave consistently in endodontic and operative contexts while preserving scope-sensitive summaries.
- Shared readiness appears as a full-width workspace band on wider layouts, with workflow-specific target/progress panels below it in the active workflow grid.
- Shared readiness does not duplicate the header's generic Case Setup & Status action; readiness actions are specific to diagnosis, radiographs, anesthesia, or isolation.
- When a shared module is already open, its matching readiness row is disabled or otherwise non-recursive.
- Endodontic canal UI does not appear in operative or shared-module contexts.
- Operative tooth/surface setup does not get treated as an endodontic canal target.
- Case Setup & Status clearly separates into section headings/groups for Case identity, Shared readiness, Endodontic setup, and Operative setup.
- Workflow runner actions and completion states use predictable labels without changing clinical event semantics.
- Light and dark mode remain readable for status, warning, readiness, and action surfaces.
- Tests cover routing or rendering behavior that would allow cross-workflow leakage.

## Verification

- Run `npm test` after workflow routing, readiness, event, note, or runner behavior changes.
- Run `npm run build` after code or config changes.
- Run `npm run docs:check` after documentation lifecycle or structure changes.

## Open Questions

- Should NodeDent Home become a persistent first screen now that there are two primary workflows, or remain available as the workspace launcher modal?
- Yes. Make it a persistent first screen. Keep the launcher modal as a quick-switcher.
- Should Case Setup & Status be split into separate global, shared-module, and workflow-setup components in this pass, or only relabeled and regrouped?
- Split conceptually and internally, but not into separate user-facing screens yet.
- Should operative setup live mainly in the active workflow runner, Case Setup & Status, or both?
- The active workflow runner should own operative-specific setup. Case Setup & Status should summarize it and link into it.
- Which action label should shared modules use when a current event already exists: `Review`, `Add event`, or `Record update`?
- Add event sounds like creating a duplicate(which isn't always the case). Record update is useful only when the module is explicitly event-log based. Review is safest when something already exists.
- Should readiness summaries show target scope inline for every row, or only when scope mismatch could confuse the user?
- Only show scope inline when it prevents confusion.
Showing scope on every row creates noise. Use scope chips/metadata for shared, global, cross-workflow, or mismatched items. Hide it for obvious active-workflow rows.
