---
status: active
created_on: 2026-06-18
---

# Case Setup And Shared Readiness Refactor

This spec follows the implemented main workspace shell cleanup. It separates broad case identity from procedure-specific setup and defines a shared readiness surface that can support endodontic and future operative workflows.

The current `Case Setup & Status` panel still reflects its endodontic-first origin. It mixes case identity, diagnosis, radiographs, endodontic measurements, active canal data, anesthesia, isolation, prior-visit setup, case audit, and catalog-maintenance surfaces. That is workable for the current endodontic workflow, but it will not scale cleanly to operative dentistry.

## Goals

- Split case setup into clearer ownership areas:
  - case identity and administrative context
  - shared clinical readiness
  - workflow/procedure-specific setup
  - shared module capture surfaces
- Keep diagnosis, radiographs, anesthesia, and isolation reusable across endodontic and operative workflows.
- Keep endodontic-only canal and measurement fields out of future operative setup surfaces.
- Preserve the implemented shared readiness side card as the main reusable readiness summary.
- Prepare a clean path for a future shared radiology/radiographs module.

## Non-Goals

- Do not implement operative dentistry in this refactor.
- Do not redesign the full event ledger.
- Do not add radiographic interpretation or clinical recommendations.
- Do not invent source-backed radiology rules.
- Do not remove existing endodontic measurements or prior-visit tools.

## Current Problems

- `Case Setup & Status` mixes global case identity with endodontic workflow fields.
- Diagnosis and radiographs behave like shared readiness concepts, but they are still embedded in endodontic-oriented setup UI.
- Radiographs are currently pre-op fields rather than a standalone shared module or shared event surface.
- Endodontic active-canal measurements live beside shared modules, making the panel feel workflow-specific.
- The new shared readiness card can deep-link into setup sections, but the underlying sections still need clearer ownership.

## Proposed Structure

### Case Identity

Owns broad case and visit context:

- patient/chart number
- active tooth or broad case target
- procedure label while procedure identity remains string-based
- visit status
- next visit/plan
- prior-visit source context
- import/export and saved-case actions

### Shared Clinical Readiness

Owns reusable readiness summaries and launch/focus actions:

- diagnosis
- radiographs
- anesthesia
- isolation

This surface should stay workflow-aware but not workflow-owned. It should summarize event-backed capabilities and open the relevant shared module or setup section.

### Workflow/Procedure Setup

Owns workflow-specific setup:

- endodontic: active canal, estimated WL, chamber depth, canal measurements, canal status
- operative: future teeth/surfaces, restoration intent, material/shade setup

Workflow setup should not become a universal target model. Each primary workflow should own its target panel and procedure-specific setup.

### Shared Module Capture

Owns structured event capture for reusable modules:

- anesthesia
- isolation
- future radiology/radiographs if split out
- future diagnosis module if diagnosis becomes event-backed beyond the current case field summary

## Radiology Direction

Radiographs should likely become a shared radiology/radiographs module, but the boundary should be staged.

Candidate shared radiology responsibilities:

- record PA, BW, CBCT, or other image review as documentation
- scope radiograph review to tooth, teeth, quadrant, arch segment, procedure, or custom region
- record image date/source notes when useful
- record limitations or adequacy as clinician-entered documentation only
- emit or support `radiographs.reviewed` capability

Non-goals for the first radiology slice:

- no radiographic interpretation rules
- no diagnostic recommendations
- no automatic adequacy inference beyond explicit clinician-entered documentation
- no source-backed imaging rules without a separate ADR/spec

## Implementation Plan

### Phase 1: Layout Boundary And Names

Reasoning level needed: medium. This phase is mostly structural naming and component boundary work, but it needs enough design reasoning to avoid baking endodontic assumptions into shared setup labels.

Status: implemented by splitting the case setup panel into named local sections for case identity, visit status, diagnosis readiness, radiograph readiness, endodontic workflow setup, shared clinical readiness, and shared module capture areas while preserving the existing modal entry point and update handlers.

- Rename or split local components so the current panel distinguishes case identity, shared readiness, workflow setup, and shared modules.
- Keep the existing modal entry point for now.
- Preserve current field behavior and event output.

### Phase 2: Case Setup Focus Targets

Reasoning level needed: medium. The mapping should be explicit and maintainable, with careful attention to how shared readiness deep-links into setup without spreading string ids across the codebase.

Status: implemented by keeping `CaseSetupFocusTarget` as the typed focus contract and routing modal section focus through a single target-to-ref mapping/helper in the case setup panel.

- Keep `CaseSetupFocusTarget` explicit for shared readiness rows.
- Ensure diagnosis, radiographs, anesthesia, and isolation focus actions are stable.
- Avoid using stringly-typed section ids outside a single mapping/helper.

### Phase 3: Endodontic Workflow Setup Extraction

Reasoning level needed: high. This phase changes ownership boundaries for endodontic-specific setup, so it needs deliberate review of workflow behavior, measurement state, and future operative isolation.

Status: implemented by extracting active-canal chamber depth and estimated WL setup into `EndodonticWorkflowSetupPanel`, using the same canal status and measurement summary helpers as the endodontic target panel while leaving detailed measurement capture in `MeasurementPanel`.

- Move active canal and endodontic measurement setup into an endodontic-specific workflow setup component.
- Keep `MeasurementPanel` and `EndodonticTargetPanel` aligned so canal details do not leak into operative setup.

### Phase 4: Shared Radiology Module Spec

Reasoning level needed: high. Radiology boundaries affect shared clinical documentation and future event semantics, and any clinical behavior must remain limited to source-backed or explicitly clinician-entered documentation.

Status: implemented by creating [Shared Radiology Module](shared-radiology-module.md). The staged decision is to keep current radiograph case setup fields for one more cycle, define `shared.radiology` as the future module identity, and preserve `radiographs.reviewed` as the compatibility capability.

- Decide whether radiographs remain as case setup fields for one more cycle or become a shared `shared.radiology` module.
- If split out, write a dedicated shared radiology module spec before implementation.

### Phase 5: Operative Readiness Review

Reasoning level needed: medium. This phase is a compatibility review, but it still requires careful workflow reasoning to confirm the shared surfaces work without exposing endodontic-only fields.

Status: implemented by threading active workflow identity into Case Setup & Status, gating endodontic canal audit/setup surfaces to endodontic workflows, adding a NodeDent Home path that switches the main workspace into operative setup, and adding regression coverage that operative context keeps diagnosis/radiograph/anesthesia/isolation readiness available without active-canal setup fields.

- Confirm the refactored setup can support operative teeth/surfaces without displaying active-canal fields.
- Confirm shared readiness can open diagnosis, radiographs, anesthesia, and isolation from an operative workflow context.

## Decisions

- Case identity and procedure-specific setup should be separated conceptually.
- The shared readiness card remains the cross-workflow summary surface.
- Endodontic canal and measurement fields remain endodontic workflow setup, not platform setup.
- Radiology/radiographs should be treated as the future `shared.radiology` module, with current case setup radiograph fields retained for one more compatibility cycle before implementation.

## Open Decisions

- Should Case Setup & Status remain one modal with grouped sections, or become separate Case Identity and Workflow Setup panels?
- Should diagnosis become a shared module or remain case fields backed by capability selectors?
- Where should future operative procedure setup live relative to the shared readiness card?
