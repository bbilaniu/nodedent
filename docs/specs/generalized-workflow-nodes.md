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

The current pre-op decision card also carries case setup fields such as patient number, tooth, procedure type, diagnosis, pre-op radiographs, chamber depth, and estimated WL. That is useful for the first screen, but those fields are broader than one protocol node. As the product adds reusable clinical modules, the app needs a persistent case setup/status surface where shared context can be viewed and updated without losing the active decision-card position.

The product needs a way to reuse those subsections without making clinicians answer the same questions repeatedly.

## Goals

- Preserve the current data-driven node graph pattern.
- Let a reusable clinical workflow run standalone or embedded inside another workflow.
- Record shared events so one workflow can recognize work completed by another workflow.
- Support supplemental events, such as topping up anesthesia, without forcing the user to leave the active workflow.
- Keep note generation event-based.
- Provide a persistent case setup/status surface for shared case context, including case identity, diagnosis, radiographs, prior visit state, anesthesia/sedation, isolation, and case status.
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

Initial implementation recommendation: generate a `workflowRunId` for every workflow session, including the root endodontic workflow. Root workflows should use `parentWorkflowRunId: null`; embedded modules should set `parentWorkflowRunId` to the parent run that opened them. Keep `workflowId` and `workflowRunId` separate: `workflowId` identifies the workflow definition, such as `endo.rct` or `shared.isolation`, while `workflowRunId` identifies a specific execution of that workflow.

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

Initial implementation recommendation: derive capabilities from the event ledger rather than storing a second capability state on the case. If performance or cross-screen synchronization later requires cached capability summaries, treat those summaries as rebuildable derived data with the event ledger as the source of truth.

### Embedded Workflow Calls

Parent workflows should be able to call shared workflows from a decision node.

Example module calls from an endodontic access node:

- Check or establish anesthesia.
- Check or establish isolation.
- Add an anesthesia top-up event.

When a module call completes, the app returns to the parent workflow and records the module event with a parent-child relationship.

### Case Setup And Status Surface

The app should introduce a persistent Case Setup & Status card or panel that is separate from the active decision card.

The decision card should remain focused on the current clinical step. The setup/status surface should hold shared case context and status summaries, including:

- patient number
- tooth
- procedure type
- diagnosis
- pre-op radiographs
- prior visit state
- anesthesia/sedation status
- isolation status
- overall case status

This surface is a UI and workflow entry point, not a replacement for the event ledger. It should display current status derived from case fields and clinical events. When the user records anesthesia, sedation, isolation, or other reusable clinical work, the app should append structured events rather than silently rewriting historical events. True data-entry corrections can be supported separately as correction/edit actions.

The current express setup form should eventually move into this surface. During migration, the pre-op decision card can keep a compact setup summary and incomplete-setup prompt that routes the user to Case Setup & Status. Required setup validation should remain visible before the user advances from pre-op.

Initial implementation recommendation: expose Case Setup & Status through the existing case panel or a modal/panel first. A persistent right-side card can be added later on wider screens after the content, status summaries, and event-backed update actions settle.

### NodeDent Home And Workflow Launcher

The app currently lands directly in the endodontic protocol. That is acceptable while endodontics is the only primary workflow, but it should not be the permanent root once NodeDent supports standalone modules and multiple procedure workflows.

The product should eventually introduce an operational home screen or workflow launcher. This should not be a marketing landing page. It should be the first clinical workspace surface for:

- starting or resuming a case
- opening the last active case and workflow
- choosing a primary workflow, such as endodontic RCT or future operative workflows
- opening standalone shared modules, such as anesthesia/sedation or isolation
- opening Case Setup & Status before entering a procedure workflow
- opening notes/export or a future clinical timeline view

Direct-to-endo can remain the default route until there is enough non-endodontic functionality to justify an extra step. When the launcher is introduced, it should still allow fast resume into the active endodontic workflow.

## Reuse Rules

### Avoid Re-Prompting

Before showing an embedded workflow, the app should query whether the required capability is already satisfied for the current scope.

If it is satisfied, the parent workflow should show a concise acknowledgment such as:

`Isolation already recorded for tooth 36 this visit.`

The user should still have a way to revise or add a supplemental event when clinically needed.

### Scope Matters

Capabilities must be scoped. Anesthesia for one tooth should not automatically satisfy another tooth unless explicitly recorded as applicable. Isolation for a tooth may satisfy multiple procedures on that tooth during the same visit. Canal-specific endodontic progress should not satisfy tooth-level operative restoration requirements unless the workflow explicitly maps it.

Isolation should support richer scope than a single tooth. In practice, rubber dam isolation may apply to a quadrant, sextant, arch segment, or custom set of teeth. The app should record both the broad isolation region and the specific teeth exposed by the dam so endodontic and operative workflows can determine whether the active tooth is covered.

### Time-Sensitive Events

Some capabilities can expire or need refresh:

- anesthesia
- isolation integrity
- temporary restoration status
- medication status

Those capabilities should support supplemental events, such as `anesthesia.topUpGiven`, that refresh or extend the relevant capability without resetting the parent workflow.

### Status Views Are Derived

Case Setup & Status should summarize capabilities and case fields, but it should not become a parallel checklist that competes with events.

Examples:

- Anesthesia status should be derived from anesthesia/sedation events, dose/time details, scope, and adequacy response.
- Isolation status should be derived from isolation events, scope, and any compromise/replacement/removal events.
- Radiograph and diagnosis status can initially read from existing case fields, then move toward event-backed modules when those modules are extracted.

If the user needs to update a status that was already recorded, the default action should be supplemental event capture, such as top-up anesthesia, isolation compromised, isolation replaced, or diagnosis revised.

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
- record sedation provided, if applicable

Embedded use:
- endodontic access
- operative treatment
- extraction
- Case Setup & Status

Special behavior:
- supports top-up events
- may expire or need reassessment
- reassessment timing should eventually consider whether the anesthetic included vasoconstrictor/adrenaline, but this can be implemented after the first shared-module pass
- should separate event-backed clinical updates from correction/edit actions

### Isolation

Standalone use:
- rubber dam or alternative isolation workflow

Embedded use:
- endodontic access
- adhesive dentistry
- operative restoration
- Case Setup & Status

Special behavior:
- should be reusable across procedures on the same tooth during the same visit
- should support quadrant, sextant, arch segment, single-tooth, and custom exposed-teeth documentation
- should document which teeth are exposed by the dam
- should document isolation supports, including clamp code and anchor tooth when clamps are used
- may need a replacement or compromised-isolation event

Recommended event details for rubber dam isolation:

```ts
type IsolationRegionKind = "tooth" | "quadrant" | "sextant" | "archSegment" | "custom";

type IsolationSupportType =
  | "clamp"
  | "second_clamp"
  | "floss_ligature"
  | "rubber_dam_corner"
  | "other";

type IsolationSupport = {
  id: string;
  type: IsolationSupportType;
  clampCode?: string;
  tooth?: string;
  note?: string;
};

type IsolationEventDetails = {
  technique: "rubber_dam" | "cotton_roll" | "dry_angle" | "isodry" | "other";
  regionKind?: IsolationRegionKind;
  regionLabel?: string;
  exposedTeeth?: string[];
  supports?: IsolationSupport[];
  integrity?: "intact" | "compromised" | "replaced" | "removed";
};
```

For example, a rubber dam event can record `regionKind: "quadrant"`, `regionLabel: "Q3"`, `exposedTeeth: ["34", "35", "36", "37"]`, and a clamp support such as `clampCode: "W8A"` on tooth `37`. The `isolation.established` capability should satisfy workflows for teeth included in `exposedTeeth`, or for a queried tooth that clearly belongs to the recorded region when explicit exposed teeth are not available.

The initial region vocabulary and clamp catalog can draw from the existing `pulp-app` operative dentistry template, but NodeDent should not be bound to that vocabulary if the reusable workflow model needs cleaner identifiers or a different user experience.

Clamp recommendations would be useful as reference content near clamp selection. Existing recommendation table content from `pulp-app` can be reused as prior art, but the first isolation module does not need to decide whether recommendations are bundled data, static reference UI, or a later helper.

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

Reasoning levels:

- Low: mostly mechanical implementation from existing patterns.
- Medium: requires cross-module design judgment, but should be implementable without settling major product decisions.
- High: requires careful architecture or clinical workflow reasoning before implementation.

### Phase 1 - Document And Type The Shared Model

Status: implemented as model/schema scaffolding.
Reasoning level: medium.

- Add generic workflow definition types alongside the current endodontic types.
- Add explicit workflow and scope fields to new events while preserving import compatibility.
- Define capability names and scope rules for diagnosis, anesthesia, isolation, and restoration.
- Keep the current endodontic UI behavior unchanged.

Implemented:

- Added generic workflow, node, module-call, scope, capability requirement, and capability satisfaction types alongside the existing endodontic types.
- Added optional workflow context fields to `ClinicalEvent`, including workflow identifiers, run identifiers, node ID, scope, satisfied capabilities, and expiry.
- Updated event schemas so legacy events remain valid while future workflow-scoped events can be imported/exported.
- Added initial capability scope rules for diagnosis, radiograph review, anesthesia, isolation, temporary closure, referral, and final restoration.
- Left the current endodontic UI behavior unchanged.

### Phase 2 - Add Query Helpers

Status: implemented for derived capability status selectors and conservative UI summaries.
Reasoning level: medium.

- Add selectors that answer questions such as:
  - Is anesthesia adequate for this tooth and visit?
  - Is isolation established for this tooth?
  - Has diagnosis been recorded?
  - Does this capability need reassessment?
- Derive those answers from the event ledger and current case fields instead of storing mutable capability flags on the case.
- Use selectors in validation and decision-card messaging before building embedded workflow UI.

Implemented:

- Added derived selectors for known capability satisfaction, reassessment status, and Case Setup & Status summaries.
- Derived diagnosis and radiograph readiness from existing case fields.
- Derived future anesthesia status from explicit capability events, including expiry-based reassessment.
- Derived future isolation status from explicit capability events or initial isolation events, with compromise/removal events triggering reassessment.
- Added capability-requirement evaluation to decision validation without changing current endodontic node behavior.
- Added compact shared-status messaging to the pre-op decision card and fuller status summaries to Case Setup & Status.

Remaining:

- Attach capability requirements to concrete nodes after anesthesia/isolation module events are defined.
- Refine anesthesia reassessment once anesthetic type, vasoconstrictor/adrenaline, dose, timing, and clinical response are modeled.
- Refine isolation region matching once the final quadrant/sextant/arch-segment vocabulary exists.

### Phase 2A - Extract Case Setup And Status UI

Status: first UI extraction implemented.
Reasoning level: low for the completed extraction; medium for future event-backed status summaries.

- Extract the current pre-op express setup fields into a reusable setup/status component.
- Render the component from the existing case panel or a modal/panel first.
- Keep the decision card focused on the current protocol node.
- Replace the inline pre-op setup block with a compact setup status summary and a clear action to open Case Setup & Status.
- Preserve pre-op validation so missing required setup remains obvious before the user advances.
- Add status summaries for anesthesia/sedation and isolation before those modules become fully embedded workflows, using conservative event-backed or field-backed placeholders as needed.
- Defer a persistent right-side setup/status card until the panel content and responsive layout needs are clearer.

Implemented:

- Added a reusable `CaseSetupStatusPanel` component for case identity, case status, diagnosis, pre-op radiographs, chamber depth, and active-canal estimated WL.
- Rendered the setup/status component from the existing case modal.
- Replaced the pre-op inline express setup form with a compact summary and an action that opens Case Setup & Status.
- Preserved pre-op missing-requirement validation on the decision action.

Remaining:

- Add event-backed anesthesia/sedation and isolation summaries after those shared module events exist.
- Reassess whether a persistent right-side setup/status card is useful after the modal/panel content stabilizes.

### Phase 3 - Extract The First Shared Module

Reasoning level: high.

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

Reasoning level: high.

- Add a sidecar/modal workflow runner that can open from the current decision card or Case Setup & Status.
- Preserve the parent `currentNodeId`.
- Record child workflow events with parent workflow context.
- Return to the parent decision card after module completion.

### Phase 5 - Generalize Beyond Endodontics

Reasoning level: high.

- Add operative workflow definitions that reuse diagnosis, anesthesia, isolation, and restoration modules.
- Introduce surface-level scope where operative workflows need it.
- Keep endodontic canal scope separate from operative surface scope.

### Phase 6 - Add NodeDent Home And Workflow Launcher

Reasoning level: medium.

- Add an operational home screen for starting, choosing, and resuming workflows.
- Preserve a fast path to the active or most recent endodontic workflow.
- Expose standalone shared modules only after their event/capability model is ready.
- Let users open Case Setup & Status before launching a procedure workflow.
- Keep the launcher focused on clinical work, not marketing content.
- Defer timeline/evolution graphs until the event ledger can support meaningful longitudinal views.

## Recommended Defaults

- Generate a `workflowRunId` for every workflow session, including the root workflow. Use `parentWorkflowRunId: null` for root workflows and a parent run ID for embedded modules.
- Derive capabilities from events initially. Do not store mutable capability state directly on the case unless it is a rebuildable cache.
- Implement Case Setup & Status as a modal/panel first. Consider a persistent right-side card later for wide screens.
- Model isolation as a visit-scoped event with a region, explicit exposed teeth when available, and structured isolation supports. Use exposed teeth as the most precise scope for reuse checks.
- Keep procedure names as strings during the first shared-module pass. Move toward typed workflow definitions when NodeDent has multiple primary procedures and localization pressure.

## Open Decisions

- How anesthesia reassessment timing should account for anesthetic type, vasoconstrictor/adrenaline presence, dose, timing, and clinical response.
- The exact initial region vocabulary for isolation, such as quadrant, sextant, arch segment, and custom exposed-tooth sets.
- Whether clamp recommendation data should be bundled into NodeDent or kept as reference-only content during the first isolation module pass.
- How much module UI should be shown inline versus in a modal.
- When NodeDent should stop launching directly into endodontics and start on a workflow launcher.
- Which workflows or modules must exist before the launcher is worth the extra screen.
- Which setup fields should remain editable as current case fields versus becoming correction events after workflow progress begins.

## Acceptance Criteria

- ADR 0004 defines the product-level direction for reusable workflow modules.
- This spec defines the shared concepts, migration phases, and first candidate module.
- The spec defines Case Setup & Status as the durable UI surface for shared case context.
- The spec captures a future NodeDent Home / Workflow Launcher once multiple workflows or standalone modules exist.
- The current endodontic workflow remains unchanged until implementation starts.
- Future work can be split into small PRs for types, selectors, setup/status UI extraction, one shared module, embedded UI, and a later workflow launcher.

## Related Files

- `docs/adr/0001-create-decision-guide-and-note-generator.md`
- `docs/adr/0004-generalize-clinical-workflow-nodes.md`
- `docs/specs/nodedent-long-term-product-roadmap.md`
- `src/endo-guide/types.ts`
- `src/endo-guide/protocol/nodes.ts`
- `src/endo-guide/protocol/continuation.ts`
- `src/endo-guide/engine/applyDecision.ts`
- `src/endo-guide/engine/validateDecision.ts`
- `src/endo-guide/notes/fragments.ts`
