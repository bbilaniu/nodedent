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

## Implementation Progress

The durable model and compatibility boundary are implemented:

- cases persist workflow instance IDs, workflow IDs and types, targets, lifecycle status, workflow-run IDs, timestamps, and source-event IDs;
- normalization migrates compatible legacy state, reconciles partial collections, and remains idempotent;
- endodontic and operative event writers attach workflow-run and workflow-instance identity;
- operative events and instance lifecycle derivation are filtered to the matching instance;
- shared capabilities use explicit scope overlap instead of appointment membership;
- neutral cases remain workflow-neutral; and
- JSON export/import and regression tests preserve instance identity and target state.

This spec remains active because the user-facing appointment map does not yet expose each durable instance independently or allow explicit creation and navigation of multiple same-type instances. The compatibility fallbacks also remain within their documented support window.

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

## Confirmed Case Setup Direction

Decision confirmed on 2026-07-24:

- Case Setup & Status becomes a full-page clinical workspace rather than a modal.
- A neutral case may select no primary workflow.
- Endodontic RCT and operative direct restoration can both be selected for the same case.
- Each selected workflow keeps its own durable instance identity, workflow-run identity, target scope, status, and source-event identities.
- Workflow-specific controls remain separate: canals stay endodontic and surfaces stay operative.
- Extraction, hygiene, and other future disciplines remain unavailable until their clinical runners are separately specified and implemented.
- Filling-note quality changes remain deferred to [Clinical note generator QA](codex-verification-outputs.md).

## Compatibility Sunset

Compatibility is intentionally bounded rather than permanent. The current implementation may read the legacy scalar `procedureType`, untagged endodontic events, and operative events created before workflow-instance identity in order to recover supported protected cases and explicit JSON exports.

These fallbacks must not become a second durable model. They may be removed in a future major release after:

- the supported migration/export window is documented;
- retained clinical cases can be re-saved or explicitly exported in the instance-aware format;
- release notes identify the compatibility removal; and
- current instance-aware fixtures no longer require the fallback.

New compatibility branches require an explicit migration reason. Do not preserve obsolete shapes indefinitely when doing so keeps duplicate state, routing, or note logic alive.

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
