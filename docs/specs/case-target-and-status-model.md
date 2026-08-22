---
status: active
created_on: 2026-07-24
---

# Case Target And Status Model

## Proposal Status

This document records design ideas for discussion. It does not authorize implementation or establish new clinical guidance.

The proposal separates appointment-level defaults, workflow-owned treatment targets, workflow progress, clinical outcomes, and visit disposition so that future disciplines do not extend the current free-text fields indefinitely.

## Confirmed Decisions

Confirmed on 2026-07-24:

- a mixture of complete and not-started workflows is displayed as **In progress** in the appointment-level aggregate;
- the existing `Visit status` replacement is deferred until a visit-disposition vocabulary has been reviewed;
- the existing scalar is labelled **Default tooth** and seeds a workflow target only when that workflow instance is created;
- an existing workflow instance retains its authoritative target when the appointment default changes;
- generic lifecycle remains limited to **Not started**, **In progress**, and **Complete** and is derived from instance-specific workflow and event evidence where possible;
- existing `caseStatus`, note wording, import, and export behavior remain compatibility concerns during this tranche; and
- a structured default target and non-tooth appointment default remain deferred until an implemented workflow requires them.

## Context

The full-page Case Setup currently includes:

- a `Tooth` field under **Chart and default treatment area**;
- one or more selected primary workflows;
- a workflow-owned target on each durable workflow instance;
- a growing `Visit status` menu that combines procedure, progress, outcome, and disposition; and
- a free-text next-visit plan.

The underlying `WorkflowScope` model already supports a tooth, multiple teeth, surfaces, a quadrant, a sextant, an arch segment, a procedure, or a custom region. The current appointment-level `tooth` string does not safely represent all of those scopes.

The current `caseStatus` vocabulary also mixes several concepts:

- procedure, such as RCT or direct restoration;
- lifecycle, such as planned, initiated, or completed;
- clinical outcome, such as medicated and temporized; and
- disposition, such as referral or continuation at another visit.

This becomes ambiguous when one case contains workflows from multiple disciplines with different targets and different progress states.

## Design Principles

- A label change must not imply structured behavior that the stored value cannot provide.
- Each primary workflow instance owns its definitive treatment target.
- Appointment-level target information is a convenience default, not a replacement for workflow-specific scope.
- Discipline comes from selected workflow instances rather than a single case-level discipline value.
- Workflow progress should be derived from durable workflow and event state when possible.
- Clinical outcomes should remain owned by their workflow events and source material.
- Appointment disposition should not overwrite or contradict workflow progress.
- Compatibility fields should have an explicit migration purpose and sunset rather than becoming permanent parallel models.

## Default Treatment Target

### Immediate terminology

Do not rename the existing single-value `Tooth` field to `Area / Tooth`.

`Area / Tooth` would invite values such as `36, 37`, `upper right`, or `full arch` in a scalar that is currently used as a tooth fallback. That could weaken target matching, shared-module scope, validation, exports, filenames, and legacy behavior.

While the implemented primary workflows remain tooth-based, the accurate label is:

> **Default tooth**

Helper text should explain that the value is used as the starting target for new workflow selections and that each workflow retains its own target.

### Future structured control

When a supported workflow needs multiple teeth or a non-tooth target, replace the scalar input with a structured **Default target** control:

1. **Target type**
   - Tooth
   - Multiple teeth
   - Quadrant
   - Sextant
   - Arch segment
   - Other defined region
2. **Target value**
   - A validated tooth selector, multi-tooth selector, or region input appropriate to the selected type.

The resulting value should use `WorkflowScope`, not a delimiter-based string.

### Relationship to workflow instances

The appointment default should seed a new workflow target only when that target kind is supported by the workflow.

The workflow instance remains authoritative after selection. For example:

- an endodontic instance owns its tooth and canal context;
- an operative direct-restoration instance owns its tooth and surfaces; and
- a future hygiene or surgical workflow would own only the region types defined by that workflow.

Multiple independent treatments should normally be represented by separate workflow instances rather than by placing several unrelated targets in one text field. The repeatable-instance design must determine when one multi-target instance is appropriate and when separate instances are required.

## Workflow Progress And Visit Status

### Do not add a case-level discipline menu

A single **Discipline** menu would conflict with multidisciplinary cases. Discipline is already represented by the selected workflow cards and should remain attached to each workflow instance.

If future UI needs a selector, it should select a specific workflow instance, not collapse the case to one discipline.

### Per-workflow lifecycle

Each workflow card should display a derived lifecycle status:

- **Not started**
- **In progress**
- **Complete**

These labels map to the durable workflow-instance status model. They should not be freely editable when event or workflow state can establish the answer.

Procedure-specific outcomes do not belong in this generic lifecycle. For example, an endodontic outcome such as medication and temporization remains an endodontic event-backed outcome even when the workflow lifecycle is `In progress`.

### Overall progress

Case Setup may show a read-only aggregate summary while retaining the individual workflow rows.

Tentative aggregation:

- no selected workflows: **No workflow selected**;
- every selected workflow is not started: **Not started**;
- any selected workflow is in progress: **In progress**;
- complete and not-started workflows coexist: **In progress**; and
- every selected workflow is complete: **Complete**.

The aggregate must never hide the individual workflow states.

### Visit disposition

If an appointment-level manual control is still useful, it should be named **Visit disposition**, not `Visit status`.

Disposition is separate from lifecycle and may describe what happens after the current visit, such as continuation at another visit or referral. Its vocabulary must be reviewed against existing workflow outputs and clinic usage before implementation.

`Continue` should not be used alone as a stored state because it reads as an action. A label such as **Continue next visit** is clearer when that disposition is supported.

The existing free-text **Next visit / plan** field remains separate and can provide detail without expanding a status menu.

### Appointment end and treatment end

An appointment ending is not the same event as a treatment workflow completing.

Every attended appointment reaches an end, but its selected workflow instances may finish in different states. One workflow may complete during the appointment while another remains not started or in progress. A multi-appointment treatment may also end the current appointment with the same workflow still in progress.

The future model should therefore keep these questions separate:

1. **What is the state of each treatment?**
   - answered by the durable workflow-instance lifecycle and workflow-owned outcome events;
2. **Why or how did this appointment end?**
   - answered, if needed, by a narrowly defined appointment disposition;
3. **What should happen next?**
   - answered by structured follow-up information where supported and by `Next visit / plan` for free-text detail.

Completing an appointment must not automatically complete its workflows. Completing every selected workflow also does not by itself establish why the appointment ended or whether review, referral, or other follow-up is planned.

### Candidate future visit dispositions

The following are design candidates for clinic and source-material review, not approved clinical vocabulary:

- **Continue next appointment** — planned treatment remains for a later appointment;
- **Referred / transferred** — responsibility or next action moves outside the current workflow or clinic context;
- **Review or follow-up planned** — active treatment may be complete, but another appointment is expected for review;
- **No further appointment planned** — the current appointment closes without a planned return in this treatment context;
- **Care deferred or interrupted** — intended appointment work did not proceed or did not reach its planned endpoint.

Before implementation, each candidate must answer:

- whether it describes appointment disposition, treatment outcome, scheduling intent, or more than one of these;
- whether an existing workflow event already records the same fact more precisely;
- whether it applies to the whole appointment or only to one workflow instance;
- whether the term can be supported without adding new clinical guidance;
- whether a reason or provenance is required; and
- how it should appear in notes and exports.

Candidates that cannot be kept distinct from workflow lifecycle or clinical outcome should not become appointment-level values. The final stored values should be stable codes with separately controlled display labels.

### Appointment note and longitudinal export boundaries

Future note work should distinguish at least two artifacts:

- an **appointment note**, representing facts and events recorded during one appointment; and
- a **longitudinal treatment summary**, representing selected workflow history across multiple appointments.

An appointment note should:

- identify the appointment or encounter independently from the longer-running treatment;
- include the workflows addressed during that appointment and their targets;
- report workflow status as of the appointment boundary without allowing later activity to rewrite the historical note;
- include appointment-specific clinical events, outcomes, disposition when implemented, and next-visit planning;
- retain workflow-instance and workflow-run identifiers in structured exports; and
- include shared-module events once at the appointment level while preserving their scope and linkage to relevant workflows.

A longitudinal summary may show progress across appointments, but it should not replace or silently regenerate the note for an earlier appointment. If the same durable treatment instance continues across visits, future persistence will need an explicit appointment identifier on events or an equivalent immutable event boundary. The current case object should not be assumed to provide that boundary merely because it has an `encounterId`.

For a multidisciplinary appointment, the default should be one canonical appointment note with clearly separated workflow sections rather than independent notes that could omit shared context or contradict each other. Workflow-specific exports may still be useful as secondary artifacts, but they should reference the same appointment and event identities.

## Proposed Case Setup Presentation

### Case identity

- Patient chart number
- Default tooth initially
- Future structured default target when supported

### Treatment plan

Each selected workflow row shows:

- discipline and procedure;
- definitive workflow target;
- derived lifecycle badge;
- clinical outcome or relevant disposition summary when recorded; and
- an action to open the workflow.

Example:

```text
Endodontic RCT       Tooth 36       In progress
Operative restoration Tooth 35 MO   Not started
```

### Visit

- Overall progress: derived and read-only
- Visit disposition: optional, narrowly defined manual control
- Next visit / plan: free text

## Data-Model Implications

Potential future changes include:

- adding an appointment-level `defaultTarget: WorkflowScope`;
- retaining the legacy `tooth` value only during a documented migration/export window;
- deriving aggregate progress from `workflowInstances`;
- separating visit disposition from the legacy `caseStatus` string; and
- treating `caseStatus` as a bounded compatibility field once replacements are implemented.

New code should not add more combined procedure-and-status strings to `caseStatus`. Export and import changes must preserve supported existing cases until the relevant compatibility window closes.

## Compatibility And Note Output

This proposal does not include filling-note improvements.

Any migration must:

- preserve supported protected cases and explicit JSON exports;
- keep workflow targets deterministic;
- avoid silently converting a comma-separated tooth string into structured clinical scope;
- preserve clinically equivalent note and export status until the note-output specification authorizes a change; and
- document when legacy `tooth` and `caseStatus` fallbacks can be removed.

## Suggested Implementation Sequence

1. Rename the current UI label from `Tooth` to `Default tooth` and retain its existing scalar behavior.
2. Display the existing derived lifecycle status on each workflow card.
3. Replace the long case-level status menu with a read-only aggregate plus an optional, separately modeled visit disposition.
4. Add a structured default-target editor only when an implemented workflow needs multiple teeth or a non-tooth scope.
5. Complete repeatable same-type workflow instances before assuming that one workflow instance can safely represent several independent treatment targets.
6. Plan and document removal of superseded compatibility fields after supported migration and export windows.

## Open Decisions

- Which target kinds should the first structured default-target editor support?
- Should multiple teeth create one multi-target workflow instance or several independently auditable instances for each implemented workflow?
- Is a manual visit disposition required, or can workflow events and the next-visit plan represent every current use case?
- Which candidate dispositions describe genuine appointment-level state after review against clinic usage, source material, and note requirements?
- What creates the immutable appointment boundary for events and appointment-note exports when one treatment spans multiple appointments?
- Which existing `caseStatus` values must remain importable, and for how long?

## Related Specifications

- [Repeatable workflow instances](repeatable-workflow-instances.md)
- [Workspace cross-workflow consistency](workspace-cross-workflow-consistency.md)
- [NodeDent vision](nodedent-vision.md)
- [Clinical note generator QA](codex-verification-outputs.md)
