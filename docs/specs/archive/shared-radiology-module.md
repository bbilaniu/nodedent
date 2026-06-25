---
status: implemented
created_on: 2026-06-19
completed_on: 2026-06-25
---

# Shared Radiology Module

This spec defines the first shared radiology/radiographs module boundary for NodeDent. It follows the case setup and shared readiness refactor and keeps the first implementation limited to clinician-entered documentation of image review.

The current app records pre-op radiograph review as case setup fields and now also supports explicit `shared.radiology` review events from the shared radiology workflow. The legacy fields remain visible as a compatibility surface while event-backed radiology review becomes the preferred shared-module boundary.

## Goals

- Define `shared.radiology` as the preferred shared module identity for radiograph review documentation.
- Keep radiograph readiness reusable across endodontic and future operative workflows.
- Support clinician-entered review records for PA, BW, CBCT, and other image types.
- Scope radiology documentation to a tooth, teeth, quadrant, arch segment, procedure, or custom region.
- Preserve or emit the existing `radiographs.reviewed` capability when image review is explicitly documented.
- Keep current case setup radiograph fields as a compatibility surface during the shared-module migration.

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
- The current PA/BW/CBCT case fields should remain as compatibility inputs while `shared.radiology` owns new explicit review documentation.

## Current Compatibility Baseline

Current case setup fields:

- `preOp.paReviewed`
- `preOp.bwReviewed`
- `preOp.cbctReviewed`
- legacy `preOp.radiographsReviewed`
- `priorVisit.priorRadiographsAvailable`

Default behavior:

- New cases must initialize PA, BW, CBCT, legacy all-radiographs review, and prior-radiographs availability as not reviewed / unchecked.
- Radiograph readiness should become satisfied only after a clinician explicitly checks a current case setup field, records a `radiology.reviewed` event, or documents prior radiographs in prior-visit history.
- Compatibility with older saved cases may still read legacy true values, but new case defaults should not imply image review.

Current readiness behavior:

- `radiographs.reviewed` is derived from explicit `radiology.reviewed` events or those case fields.
- Shared readiness can open the shared radiology workflow directly.
- Radiograph review is event-backed for new shared radiology captures.
- Case Setup & Status still displays compatibility radiograph fields and latest radiology summaries, but no longer owns the primary shared radiology event form.

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

Operative surface workflows may use tooth-level radiograph review as sufficient shared readiness context for now. The clinician has either reviewed imaging for the tooth or explicitly decided current imaging review is not needed beyond the documented available images. Surface-specific radiology scope can be revisited if future workflows need tighter imaging provenance.

## First Implementation Slice

Status: implemented as the initial Case Setup & Status capture slice.

- Added a typed radiology event model and formatter.
- Added a compact Case Setup & Status capture surface for `radiology.reviewed`.
- Kept the existing PA, BW, and CBCT checkboxes visible during the transition.
- Updated capability selectors so explicit `radiology.reviewed` events satisfy `radiographs.reviewed`.
- Preserved saved-case import/export compatibility for existing `preOp` radiograph fields and global events.
- Kept shared readiness opening the radiograph readiness surface.

## Second Implementation Slice

Status: implemented as the Case Setup & Status display and operative-scope compatibility slice.

- Added latest `radiology.reviewed` event display to the Radiograph readiness section.
- Kept the event-backed radiology review surface visually distinct from legacy PA, BW, and CBCT compatibility checkboxes.
- Added regression coverage that tooth-level radiograph review satisfies operative surface readiness.
- Documented that tooth-level radiograph review is sufficient context for operative surface workflows in the current implementation.

## Third Implementation Slice

Status: implemented as the shared-module launcher and embedded-runner slice.

- Added `shared.radiology` to NodeDent Home alongside anesthesia and isolation shared modules.
- Added an embedded radiology workflow runner that records `radiology.reviewed` events and closes back to the parent workflow without advancing the parent step.
- Routed shared readiness radiograph actions to the radiology workflow instead of using Case Setup & Status as the primary event capture surface.
- Kept Case Setup & Status as a compatibility and summary surface for legacy PA, BW, CBCT, and prior-visit radiograph fields.
- Removed inline anesthesia, isolation, and radiology event forms from Case Setup & Status so shared modules use their dedicated workflow runners.
- Made prior-visit radiographs explicit in readiness summaries so older images do not read as newly reviewed current-visit imaging.

## Fourth Implementation Slice

Status: implemented as shared-radiology consumption by x-ray-dependent workflows.

- Updated endodontic pre-op validation to require the shared `radiographs.reviewed` capability at tooth scope instead of reading raw PA/BW/CBCT fields directly.
- Added shared radiology module calls to endodontic pre-op and access-reassessment nodes so x-ray-dependent workflow steps point to `shared.radiology`.
- Split operative readiness module calls so diagnosis and radiology are separate shared-module dependencies.
- Updated pre-op decision and full-note summaries to derive radiograph status from shared capability selectors, while keeping legacy checkbox values as compatibility context.
- Deferred radiology shortcut/catalog work; there is no shortcut catalog requirement for this slice.

## Deferred Work

- Image attachment management or image viewer integration.
- Intraoral photography or camera documentation as a future imaging-adjacent shared module or radiology-adjacent capability.
- Clinic-owned radiology documentation catalogs or shortcuts, if later needed.
- Source-backed imaging rules.
- Migration that removes or hides the current pre-op radiograph case fields after compatibility is no longer needed.

## Open Decisions

- Should the first UI record one review event with multiple modalities or one event per modality?
- Answered for the first slice: one `radiology.reviewed` event can record multiple modalities.
- Should `imageDate` be a free-text documentation field first, or a strict date field?
- Answered for the first slice: use a date input in the UI while storing the value as an optional event detail string.
- Answered by product input: it should remain a strict date field like related projects.
- Should prior-visit radiographs remain a prior-visit field or become compatibility input to `shared.radiology` summaries?
- Answered by product input: for endodontics it should remain part of the inputs, but it should be clear when the images were taken during a previous appointment until new imaging is taken if needed.
- What is the minimum scope required before emitting `radiographs.reviewed` for operative surface workflows?
- Answered by product input: tooth-level review is sufficient context for operative surface workflows. If radiographs are checked, including older images, the row counts as reviewed. New radiographs also count as reviewed when documented.
