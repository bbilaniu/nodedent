---
status: active
created_on: 2026-07-20
---

# Repeatable Workflow Instances

## Goal

Allow one appointment to contain multiple durable, independently targeted workflow instances while preserving NodeDent's workflow-neutral new-case behavior.

This spec owns the workflow-instance and appointment-map work preserved only on `codex/2026-06-24-hardening`. It is related to DATA-03 in the [2026-07-11 website review](../reviews/2026-07-11-website-review.md), but it does not solve encounter-ID collisions.

## Recovery Provenance

The unmerged branch contains a tested prototype across commits `8d4d9a7`, `19dbb79`, and `d815aa8`. It must be selectively ported, not merged wholesale, because current `main` subsequently made new cases workflow-neutral and changed launcher/status behavior.

The branch's clinical-note commits are out of scope here and remain owned by [Clinical note generator QA](codex-verification-outputs.md). The ancestor branch `note-artifacts-and-treatment-plan-model` must not be integrated separately.

## Required Model

Each durable instance needs:

- an immutable instance ID;
- workflow type and executable workflow ID where applicable;
- an explicit target scope;
- status and created/updated timestamps;
- workflow-run identity;
- source-event identities; and
- persistence through import/export and autosave normalization.

Multiple instances may share a workflow type. For example, two operative direct-restoration instances may target different teeth or surfaces in the same appointment.

## Required Behavior

- A neutral case must not acquire an endodontic instance merely because a tooth is selected.
- Starting endodontic or operative treatment creates/selects the appropriate instance and assigns procedure context intentionally.
- Opening operative setup without an instance ID must not silently create duplicates.
- Existing saved/imported cases migrate deterministically without duplicating instances on repeated normalization.
- Partially populated instance collections reconcile missing compatible legacy state rather than skipping all backfill.
- Operative setup and restoration events carry explicit workflow-instance and workflow-run identity.
- Shared-module links are derived only from explicit overlapping scope; appointment membership alone must not imply sharing.
- Anesthesia scoped to teeth 45 and 46 can link to those operative instances without linking to unrelated tooth 36.
- Extraction and hygiene remain model-only until their clinical runners are separately specified and implemented.
- JSON export round-trips instance IDs, targets, status, run IDs, and source-event IDs.

## Appointment Workflow Map

Preserve the branch's typed map model and scope-overlap logic as design input. Adapt the map UI to current `main` rather than copying the old launcher implementation.

The map should:

- show each durable instance and target;
- distinguish primary workflows, shared modules, model-only definitions, and output aggregation;
- enter an existing instance without creating another;
- offer explicit creation of another supported instance; and
- keep shared-module linkage explainable from scope.

## Architectural Boundary

Storing instances directly on the current case object is acceptable only as an explicit transitional boundary. Before introducing multi-appointment or multi-visit persistence, decide whether instances belong to a dedicated appointment/encounter model.

## Validation

- Migration from cases without instances.
- Repeated normalization without duplication.
- Partial-collection reconciliation.
- Multiple same-type instances with separate targets.
- Scope-aware shared-module linkage.
- Neutral-case behavior.
- Existing-instance navigation versus explicit creation.
- Import/export round trip.
- Current note output remains clinically equivalent unless changed under its owning note QA spec.
- `npm run typecheck`, `npm test`, `npm run build`, and `npm run docs:check`.

## Completion

Archive this spec only after current `main` contains the corrected durable-instance model, adapted appointment map, migration/export coverage, and workflow-neutral regression tests. Delete the recovery branches only after the note and workflow-instance work has been accounted for.
