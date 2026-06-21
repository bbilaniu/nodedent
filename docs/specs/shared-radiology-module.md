---
status: active
created_on: 2026-06-19
---

# Shared Radiology Module

This spec defines the first shared radiology/radiographs module boundary for NodeDent. It follows the case setup and shared readiness refactor and keeps the first implementation limited to clinician-entered documentation of image review.

The current app records pre-op radiograph review as case setup fields and now also supports explicit `shared.radiology` review events from Case Setup & Status. The legacy fields remain visible as a compatibility surface while event-backed radiology review becomes the preferred shared-module boundary.

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

Default behavior:

- New cases must initialize PA, BW, CBCT, legacy all-radiographs review, and prior-radiographs availability as not reviewed / unchecked.
- Radiograph readiness should become satisfied only after a clinician explicitly checks a current case setup field, records a future `radiology.reviewed` event, or documents prior radiographs in prior-visit history.
- Compatibility with older saved cases may still read legacy true values, but new case defaults should not imply image review.

Current readiness behavior:

- `radiographs.reviewed` is derived from explicit `radiology.reviewed` events or those case fields.
- Shared readiness can focus the radiograph readiness section in Case Setup & Status.
- Radiograph review is event-backed for new shared radiology captures.

The implementation should continue reading the existing fields so older saved cases and imports remain valid.

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

Status: implemented as the initial Case Setup & Status capture slice.

- Added a typed radiology event model and formatter.
- Added a compact Case Setup & Status capture surface for `radiology.reviewed`.
- Kept the existing PA, BW, and CBCT checkboxes visible during the transition.
- Updated capability selectors so explicit `radiology.reviewed` events satisfy `radiographs.reviewed`.
- Preserved saved-case import/export compatibility for existing `preOp` radiograph fields and global events.
- Kept shared readiness opening the radiograph readiness surface.

## Recommended Next Step

Implement the first slice above before starting another primary workflow family. This is the smallest active spec that improves cross-workflow shared readiness without adding clinical interpretation rules.

## Deferred Work

- Dedicated embedded radiology workflow runner.
- Image attachment management or image viewer integration.
- Clinic-owned radiology documentation catalogs.
- Source-backed imaging rules.
- Migration that removes or hides the current pre-op radiograph case fields.

## Open Decisions

- Should the first UI record one review event with multiple modalities or one event per modality?
- Answered for the first slice: one `radiology.reviewed` event can record multiple modalities.
- Should `imageDate` be a free-text documentation field first, or a strict date field?
- Answered for the first slice: use a date input in the UI while storing the value as an optional event detail string.
- *My input* It should be a strict date field like in my other projects
- Should prior-visit radiographs remain a prior-visit field or become compatibility input to `shared.radiology` summaries?
- *My input* for endodontics it should be part of the inputs, but it should be clear that it was taken during a previous appointment, until a new one is take if needed.
- What is the minimum scope required before emitting `radiographs.reviewed` for operative surface workflows? if the xrays are checked (can be old ones), it counts as reviewed (reviewed previous xrays), if new it's also reviewed (reviewed new xrays/new xrays taken).
