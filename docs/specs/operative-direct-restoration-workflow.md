---
status: active
created_on: 2026-06-19
---

# Operative Direct Restoration Workflow

This spec defines the first usable non-endodontic primary workflow in NodeDent: `operative.direct-restoration`.

The first implementation should make operative dentistry testable inside the app without adding operative clinical decision support. It should document workflow setup, shared readiness reuse, surface-scoped restoration records, note output, and a minimal runner for the already-defined operative workflow nodes.

## Context

The case setup and shared readiness refactor is implemented and archived. NodeDent now opens to NodeDent Home, and the source workspace has been renamed to `src/nodedent`.

Current operative baseline:

- `src/nodedent/workflow/operative.ts` defines `operative.direct-restoration` as a model-only workflow.
- `OperativeWorkflowSetupPanel` captures tooth, surfaces, restoration intent, material, and shade.
- NodeDent Home can open operative setup.
- The main workspace can show operative setup without rendering endodontic canal controls.
- Diagnosis, radiograph, anesthesia, and isolation readiness can be opened from operative context.
- The operative chairside runner is still disabled.
- Operative setup is local UI state and does not yet emit or persist operative workflow events.

## Goals

- Make operative direct restoration usable as a primary workflow from NodeDent Home.
- Keep operative targets tooth/surface-scoped and separate from endodontic canal state.
- Reuse shared diagnosis, radiograph, anesthesia, and isolation readiness without making them operative-owned.
- Persist operative setup as workflow state or event-backed case state instead of transient local component state.
- Record `finalRestoration.placed` as an operative output capability scoped to the planned tooth and surfaces.
- Add note/export output for operative setup and restoration records.
- Add a minimal runner for the existing operative nodes: readiness, surface scope, restoration record, and complete.

## Non-Goals

- Do not add operative clinical decision support, preparation design rules, caries removal rules, bonding protocol recommendations, material recommendations, occlusion guidance, or pulpal management rules.
- Do not infer diagnosis, radiograph adequacy, anesthesia adequacy, isolation adequacy, material choice, or restoration readiness.
- Do not implement image storage, image viewing, or the future `shared.radiology` module in this workflow slice.
- Do not make endodontic canals satisfy operative surface requirements.
- Do not migrate the existing endodontic closure workflow in this spec.
- Do not introduce clinic catalogs for restorative materials, shades, bonding systems, or cements yet.

## Ownership Boundaries

### Case Identity

Owns patient/chart number, active tooth when applicable, procedure label, visit status, and saved-case lifecycle.

### Shared Readiness

Owns reusable diagnosis, radiographs, anesthesia, and isolation summaries. Operative workflows may query these capabilities against their tooth/surface scope, but they should not store shared module data inside operative setup.

### Operative Setup

Owns planned tooth, surfaces, restoration intent, material, shade, and any workflow-specific documentation needed to record a direct restoration. These values are documentation fields only and must not imply a clinical recommendation.

### Restoration Output

Owns the final operative event and capability:

- event type: `finalRestoration.placed`
- capability: `finalRestoration.placed`
- scope kind: `surface`
- workflow id: `operative.direct-restoration`

## Current Workflow Model

Existing workflow identity:

- workflow id: `operative.direct-restoration`
- workflow version: `0.1.0`
- discipline: `operative`
- supported scopes: `tooth`, `surface`, `procedure`

Existing node sequence:

1. `operative-readiness`
2. `operative-surface-scope`
3. `operative-restoration-record`
4. `operative-restoration-complete`

Existing shared readiness requirements:

- `diagnosis.recorded`
- `radiographs.reviewed`
- `anesthesia.adequate`
- `isolation.established`

These readiness requirements should remain non-blocking in the first usable workflow. The clinician should be able to open the shared module or continue documenting, but NodeDent should not decide whether treatment may proceed.

## Event And State Direction

The implementation should avoid adding a large operative object to `EndoCase` unless the event model proves too awkward. Prefer typed workflow events and selector helpers so later operative workflows can reuse surface-scoped state.

Candidate setup event:

- event type: `operative.scope.recorded`
- workflow id: `operative.direct-restoration`
- node id: `operative-surface-scope`
- scope: `surface`
- details:
  - `tooth`
  - `surfaces`
  - `restorationIntent`
  - `material`
  - `shade`
  - `notes`

Candidate completion event:

- event type: `finalRestoration.placed`
- workflow id: `operative.direct-restoration`
- node id: `operative-restoration-record`
- scope: `surface`
- capabilities satisfied:
  - `finalRestoration.placed`
- details:
  - `tooth`
  - `surfaces`
  - `restorationIntent`
  - `material`
  - `shade`
  - `outcome`
  - `notes`

Surface parsing should remain simple and explicit at first. User-entered values such as `M O`, `MO`, or `M,O` may normalize into a string array, but NodeDent should not validate whether those surfaces are clinically appropriate for the tooth.

## Implementation Plan

### Phase 1: Setup State Boundary And Persistence

Reasoning level needed: high. This phase creates the first durable non-endodontic workflow state, so it must avoid leaking canal assumptions into operative surfaces or putting reusable shared module data under operative ownership.

Status: implemented by moving operative setup normalization and surface-scope creation into reusable workflow helpers, storing setup as an upserted `operative.scope.recorded` event, hydrating the setup panel from the latest setup event, preserving case tooth as a fallback target, and adding regression tests for parsing, scope creation, setup hydration, and setup-event upsert.

- Move operative setup normalization and scope creation into reusable workflow helpers.
- Persist operative setup through event-backed state or another explicit workflow-state boundary.
- Hydrate the operative setup panel from the latest operative setup event when available.
- Keep `caseData.tooth` as a fallback, not the sole source of operative scope.
- Add tests for surface parsing, scope creation, and setup hydration.

### Phase 2: Shared Readiness Reuse

Reasoning level needed: medium. The shared selectors already support cross-workflow capability lookup, but operative UI must target the planned tooth/surface scope without making readiness a hard clinical gate.

Status: implemented by deriving an operative readiness summary from the persisted setup event, querying diagnosis/radiographs against the planned operative tooth, querying anesthesia/isolation against the planned tooth/surface treatment scope, passing that summary into operative readiness UI, defaulting embedded shared module forms to the operative tooth, and adding regression tests for matching tooth-level shared readiness and non-matching tooth-specific case fields.

- Query diagnosis and radiograph readiness against the planned operative tooth.
- Query anesthesia and isolation readiness against the planned tooth/surface context while preserving reassessment actions.
- Keep readiness warnings and launch actions visible in operative context.
- Confirm tooth-level anesthesia or isolation can support a matching operative surface target when selector rules allow it.
- Confirm canal-scoped endodontic progress does not satisfy operative restoration completion.

### Phase 3: Restoration Record Event Model

Reasoning level needed: high. This phase defines the durable output contract for operative workflows and must keep final restoration capability semantics distinct from endodontic canal closure.

Status: implemented by adding typed helpers for `finalRestoration.placed` operative events, restoration documentation details, surface-scope creation and hydration, `finalRestoration.placed` capability output, operative restoration event filtering, and regression tests proving only matching surface-scoped operative events satisfy completion checks.

- Add typed helpers for building and reading `finalRestoration.placed` operative events.
- Attach `workflowId`, `nodeId`, surface scope, and `capabilitiesSatisfied` to restoration events.
- Store material, shade, restoration intent, outcome, and notes as documentation details only.
- Ensure `finalRestoration.placed` satisfies only matching surface-scoped operative completion requirements.
- Add regression tests for matching and non-matching tooth/surface scopes.

### Phase 4: Note And Export Output

Reasoning level needed: medium. Operative note output should be useful without inventing clinical wording beyond what was explicitly recorded.

Status: planned.

- Add event fragments for operative scope and restoration events.
- Include operative restoration records in compact note, full note, and JSON export output.
- Avoid wording that implies recommendation, adequacy, or success beyond the recorded outcome.
- Add note/export tests for complete and partially documented operative records.

### Phase 5: Minimal Operative Runner UI

Reasoning level needed: medium-high. This phase makes the workflow usable, and the UI must feel like a primary workflow without reusing endodontic-only decision card, canal selector, or measurement surfaces.

Status: planned.

- Add a minimal operative runner for the existing node sequence.
- Launch the operative runner from NodeDent Home instead of showing only setup preview.
- Show operative setup, shared readiness, restoration record form, and completion state.
- Keep endodontic `DecisionCard`, `MeasurementPanel`, phase/canal map, and canal controls hidden for operative workflows.
- Update launcher availability from `modelOnly` to `ready` only when the runner is implemented and verified.
- Add focused render tests for operative start, record, and completion states.

## Acceptance Criteria

- NodeDent Home can start or resume `operative.direct-restoration`.
- Operative setup persists after leaving and returning to the workflow.
- Operative setup displays tooth/surface scope without active-canal controls.
- Shared readiness actions work from operative context.
- A completed operative workflow records `finalRestoration.placed` with surface scope and capability satisfaction.
- Notes and JSON export include the recorded operative documentation.
- Existing endodontic workflow behavior and tests remain unchanged.

## Verification

- Run `npm test` after workflow selector, event, note, or runner changes.
- Run `npm run build` after code changes.
- Run `npm run docs:check` after spec status, location, or README changes.

## Open Decisions

- Should operative setup be represented only by events, or should `EndoCase` gain a narrow `operative` workflow-state object?
- Should `operative.scope.recorded` be emitted on every setup edit or only when the clinician confirms scope?
- Should the first runner use a reusable generic workflow runner shell, or a small operative-specific runner?
- Should restoration outcome be a free-text field first, or a small documentation enum plus notes?
- Should the existing endodontic final restoration closure event ever emit `finalRestoration.placed`, or remain separate until a later compatibility spec?
