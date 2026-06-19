---
status: active
created_on: 2026-06-19
---

# Shared Radiology Module

This spec defines the first shared radiology/radiographs module boundary for NodeDent. It follows the case setup and shared readiness refactor and keeps the first implementation limited to clinician-entered documentation of image review.

The current app records pre-op radiograph review as case setup fields. That should remain in place for one more cycle while the shared module contract is defined. The next implementation slice can then introduce `shared.radiology` without mixing radiology documentation with endodontic canal setup or future operative target setup.

## Goals

- Define `shared.radiology` as the preferred shared module identity for radiograph review documentation.
- Keep radiograph readiness reusable across endodontic and future operative workflows.
- Support clinician-entered review records for PA, BW, CBCT, and other image types.
- Scope radiology documentation to a tooth, teeth, quadrant, arch segment, procedure, or custom region.
- Preserve or emit the existing `radiographs.reviewed` capability when image review is explicitly documented.
- Keep current case setup radiograph fields as a compatibility surface until the module is implemented.

## Non-Goals

- Do not add radiographic interpretation rules.
- Do not provide diagnostic recommendations.
- Do not infer image adequacy, treatment readiness, pathology, or risk from image type or review status.
- Do not add source-backed radiology rules without a separate ADR or active spec.
- Do not implement image storage, image viewing, DICOM handling, AI interpretation, or attachment management in the first module slice.
- Do not replace clinician judgment about whether imaging is needed for a workflow.

## Decision

Radiographs should become `shared.radiology`, not `shared.radiographs`.

Reasoning:

- `radiology` leaves room for future documentation beyond a narrow radiograph checkbox, such as image source, date, modality, review scope, and limitations.
- The first capability can remain `radiographs.reviewed` for compatibility with existing selectors and readiness summaries.
- The current PA/BW/CBCT case fields should remain until `shared.radiology` has event capture, summary, import/export, and readiness wiring.

## Current Compatibility Baseline

Current case setup fields:

- `preOp.paReviewed`
- `preOp.bwReviewed`
- `preOp.cbctReviewed`
- legacy `preOp.radiographsReviewed`
- `priorVisit.priorRadiographsAvailable`

Current readiness behavior:

- `radiographs.reviewed` is derived from those case fields.
- Shared readiness can focus the radiograph readiness section in Case Setup & Status.
- Radiograph review is not yet event-backed.

The first implementation should continue reading the existing fields so older saved cases and imports remain valid.

## Event Model

Initial workflow identity:

- workflow id: `shared.radiology`
- workflow version: `0.1.0`

Initial event type:

- `radiology.reviewed`

Candidate event details:

- `modalities`
- `scope`
- `tooth`
- `teeth`
- `regionKind`
- `regionLabel`
- `procedureId`
- `imageDate`
- `sourceLabel`
- `limitations`
- `notes`

Initial modality values:

- `pa`
- `bw`
- `cbct`
- `other`

These values are documentation categories only. They should not imply that a modality is required, adequate, diagnostic, or preferred.

## Capability Rules

`radiology.reviewed` should support or emit `radiographs.reviewed` when the clinician explicitly records image review for the matching scope.

The capability should be scoped to the recorded target when possible:

- tooth
- teeth
- quadrant
- arch segment
- procedure
- custom region

Case-field fallback should continue to satisfy `radiographs.reviewed` until old saved cases can be migrated or summarized through generated compatibility events.

## First Implementation Slice

- Add a typed radiology event model and formatter.
- Add a compact Case Setup & Status capture surface for `radiology.reviewed`.
- Keep the existing PA, BW, and CBCT checkboxes visible or compatibility-backed during the transition.
- Update capability selectors so explicit `radiology.reviewed` events satisfy `radiographs.reviewed`.
- Preserve saved-case import/export compatibility for existing `preOp` radiograph fields.
- Keep shared readiness opening the radiograph readiness surface.

## Deferred Work

- Dedicated embedded radiology workflow runner.
- Image attachment management or image viewer integration.
- Clinic-owned radiology documentation catalogs.
- Source-backed imaging rules.
- Migration that removes or hides the current pre-op radiograph case fields.

## Open Decisions

- Should the first UI record one review event with multiple modalities or one event per modality?
- Should `imageDate` be a free-text documentation field first, or a strict date field?
- Should prior-visit radiographs remain a prior-visit field or become compatibility input to `shared.radiology` summaries?
- What is the minimum scope required before emitting `radiographs.reviewed` for operative surface workflows?
