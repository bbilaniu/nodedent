---
status: active
created_on: 2026-06-15
---

# Generalized Workflow Nodes

This spec turns issue #5 into a concrete plan for making NodeDent nodes reusable across procedures and disciplines.

## Problem

The current app has a strong endodontic workflow model:

- `protocolNodes` defines the clinical graph.
- `DecisionOption` advances to another node and can emit a note event.
- `ClinicalEvent` records what happened.
- Canal-aware continuation can resume other canals at appropriate endodontic checkpoints.

That model is useful, but it is not yet general enough for shared clinical work. Anesthesia, isolation, diagnosis, radiographs, temporization, referral, and restoration can be their own workflows, but they can also be subsections inside endodontic or operative workflows.

The product needs a way to reuse those subsections without making clinicians answer the same questions repeatedly.

## Goals

- Preserve the current data-driven node graph pattern.
- Let a reusable clinical workflow run standalone or embedded inside another workflow.
- Record shared events so one workflow can recognize work completed by another workflow.
- Support supplemental events, such as topping up anesthesia, without forcing the user to leave the active workflow.
- Keep note generation event-based.
- Add the model gradually without breaking the current endodontic workflow.

## Non-Goals

- Do not rewrite the endodontic guide in the first implementation pass.
- Do not introduce user accounts, server sync, or multi-device state as part of node generalization.
- Do not make every clinical concept generic at once.
- Do not replace the event ledger with simple checklist booleans.

## Proposed Model

### Workflow Definition

A workflow definition describes a reusable graph:

- `workflowId`: stable identifier, such as `endo.rct`, `shared.anesthesia`, or `operative.direct-restoration`.
- `version`: workflow version used for migrations and note traceability.
- `discipline`: broad category, such as `endo`, `operative`, or `shared`.
- `title`: user-facing workflow name.
- `entryNodeIds`: allowed entry points.
- `completionNodeIds`: nodes that represent completed or stopped workflow states.
- `supportedScopes`: scopes the workflow can run against, such as `patient`, `tooth`, `canal`, `surface`, `visit`, or `procedure`.
- `nodes`: node map using the current node shape plus workflow metadata.

### Node Definition

The current `ProtocolNode` should evolve toward a generic clinical node:

- `id`
- `workflowId`
- `phase`
- `title`
- `chairsideInstruction`
- `instruments`
- `materials`
- `requiredInputs`
- `safetyNotes`
- `options`
- `moduleCalls`, optional embedded workflow calls offered from the node
- `capabilityRequirements`, optional capabilities needed before the node can proceed

The current endodontic `ProtocolNode` can remain as a compatibility type until the shared model is introduced.

### Event Ledger

`ClinicalEvent` should gain structured context instead of relying only on string event types:

- `workflowId`
- `workflowVersion`
- `nodeId`
- `parentWorkflowRunId`
- `workflowRunId`
- `scope`
- `capabilitiesSatisfied`
- `expiresAt`, optional for time-sensitive capabilities
- `details`

The existing `type` field should remain because note fragments and status derivation already depend on it.

### Capabilities

A capability is a clinically meaningful state that other workflows can reuse.

Examples:

- `diagnosis.recorded`
- `radiographs.reviewed`
- `anesthesia.adequate`
- `isolation.established`
- `temporaryClosure.placed`
- `referral.recommended`
- `finalRestoration.placed`

Capabilities are not substitutes for events. They are queryable outputs of events. The event remains the audit trail and note source.

### Embedded Workflow Calls

Parent workflows should be able to call shared workflows from a decision node.

Example module calls from an endodontic access node:

- Check or establish anesthesia.
- Check or establish isolation.
- Add an anesthesia top-up event.

When a module call completes, the app returns to the parent workflow and records the module event with a parent-child relationship.

## Reuse Rules

### Avoid Re-Prompting

Before showing an embedded workflow, the app should query whether the required capability is already satisfied for the current scope.

If it is satisfied, the parent workflow should show a concise acknowledgment such as:

`Isolation already recorded for tooth 36 this visit.`

The user should still have a way to revise or add a supplemental event when clinically needed.

### Scope Matters

Capabilities must be scoped. Anesthesia for one tooth should not automatically satisfy another tooth unless explicitly recorded as applicable. Isolation for a tooth may satisfy multiple procedures on that tooth during the same visit. Canal-specific endodontic progress should not satisfy tooth-level operative restoration requirements unless the workflow explicitly maps it.

### Time-Sensitive Events

Some capabilities can expire or need refresh:

- anesthesia
- isolation integrity
- temporary restoration status
- medication status

Those capabilities should support supplemental events, such as `anesthesia.topUpGiven`, that refresh or extend the relevant capability without resetting the parent workflow.

## Candidate Shared Modules

### Diagnosis

Standalone use:
- pulp diagnosis
- apical diagnosis
- tooth prognosis
- treatment plan

Embedded use:
- endodontic pre-op
- operative caries/restoration planning
- emergency visit triage

### Anesthesia

Standalone use:
- record anesthetic, dose, technique, and response

Embedded use:
- endodontic access
- operative treatment
- extraction

Special behavior:
- supports top-up events
- may expire or need reassessment

### Isolation

Standalone use:
- rubber dam or alternative isolation workflow

Embedded use:
- endodontic access
- adhesive dentistry
- operative restoration

Special behavior:
- should be reusable across procedures on the same tooth during the same visit
- may need a replacement or compromised-isolation event

### Closure And Restoration

Standalone use:
- temporary restoration
- final restoration

Embedded use:
- endodontic temporary closure
- endodontic final access restoration
- operative dentistry

Special behavior:
- may complete an endodontic visit or become the main operative workflow

## Migration Plan

### Phase 1 - Document And Type The Shared Model

- Add generic workflow definition types alongside the current endodontic types.
- Add explicit workflow and scope fields to new events while preserving import compatibility.
- Define capability names and scope rules for diagnosis, anesthesia, isolation, and restoration.
- Keep the current endodontic UI behavior unchanged.

### Phase 2 - Add Query Helpers

- Add selectors that answer questions such as:
  - Is anesthesia adequate for this tooth and visit?
  - Is isolation established for this tooth?
  - Has diagnosis been recorded?
  - Does this capability need reassessment?
- Use selectors in validation and decision-card messaging before building embedded workflow UI.

### Phase 3 - Extract The First Shared Module

Recommended first module: isolation.

Reason:
- It is clinically important.
- It has clear complete/incomplete states.
- It is reused by endodontic and operative workflows.
- It has less dose/timing complexity than anesthesia.

Deliverables:
- `shared.isolation` workflow definition.
- Events such as `isolation.rubberDamPlaced`, `isolation.alternativeIsolationUsed`, and `isolation.compromised`.
- Capability output `isolation.established`.
- Note fragments for each event.
- A parent workflow prompt that acknowledges existing isolation and allows revision.

### Phase 4 - Add Embedded Module UI

- Add a sidecar/modal workflow runner that can open from the current decision card.
- Preserve the parent `currentNodeId`.
- Record child workflow events with parent workflow context.
- Return to the parent decision card after module completion.

### Phase 5 - Generalize Beyond Endodontics

- Add operative workflow definitions that reuse diagnosis, anesthesia, isolation, and restoration modules.
- Introduce surface-level scope where operative workflows need it.
- Keep endodontic canal scope separate from operative surface scope.

## Open Decisions

- Whether `workflowRunId` should be generated for every workflow session or only embedded module sessions.
- Whether capabilities should be stored directly on case state or derived entirely from events.
- How long anesthesia should remain valid before reassessment is suggested.
- Whether isolation should be scoped to tooth, quadrant, arch, or procedure.
- How much module UI should be shown inline versus in a modal.
- Whether procedure names should remain strings initially or become typed workflow definitions.

## Acceptance Criteria

- ADR 0004 defines the product-level direction for reusable workflow modules.
- This spec defines the shared concepts, migration phases, and first candidate module.
- The current endodontic workflow remains unchanged until implementation starts.
- Future work can be split into small PRs for types, selectors, one shared module, and embedded UI.

## Related Files

- `docs/adr/0001-create-decision-guide-and-note-generator.md`
- `docs/adr/0004-generalize-clinical-workflow-nodes.md`
- `src/endo-guide/types.ts`
- `src/endo-guide/protocol/nodes.ts`
- `src/endo-guide/protocol/continuation.ts`
- `src/endo-guide/engine/applyDecision.ts`
- `src/endo-guide/engine/validateDecision.ts`
- `src/endo-guide/notes/fragments.ts`
