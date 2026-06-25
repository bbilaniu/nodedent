---
status: active
created_on: 2026-06-25
---

# Repeatable Workflow Instances

This spec defines the next implementation slice after the actionable appointment workflow map.

The goal is to let one appointment contain multiple durable workflow instances of the same or different workflow types, each with its own explicit target scope.

## Context

The current workflow map can derive an appointment composition from existing endodontic, operative, and shared-module state.

Current limitations:

- Endodontic RCT is still represented as the current case-level endodontic workflow.
- Operative direct restoration is derived from the latest operative setup or restoration event.
- A second operative target in the same appointment cannot be represented as a separate durable workflow instance.
- Model-only workflow types such as extraction and hygiene are visible but cannot create real instances.

The next slice should introduce repeatable workflow-instance state without replacing the existing workflow runners.

## Product Outcome

NodeDent should be able to represent an appointment like:

```text
Appointment
  - Endodontic RCT instance targeting tooth 36
  - Operative direct restoration instance targeting tooth 45 surfaces MOD
  - Operative direct restoration instance targeting tooth 46 surface O
  - Shared anesthesia event scoped to teeth 45 and 46
  - Shared radiology event scoped to tooth 36
```

The user should be able to see, enter, and return to each workflow instance without the app implying that unrelated targets share the same tooth, surfaces, or clinical state.

## Non-Goals

- Do not build extraction or hygiene clinical runners in this slice.
- Do not implement a generic workflow engine.
- Do not change endodontic protocol logic, operative restoration semantics, or generated note clinical wording.
- Do not infer target sharing from same-appointment membership.
- Do not treat model-only workflow types as executable.
- Do not edit clinical source material in `docs/source/`.

## Proposed Data Model

Add a durable appointment-level workflow-instance collection.

Candidate shape:

```ts
type AppointmentWorkflowInstanceState = {
  id: string;
  workflowType: string;
  workflowId?: string;
  label: string;
  target: WorkflowMapTargetScope;
  status: "notStarted" | "inProgress" | "complete" | "modelOnly";
  createdAt: string;
  updatedAt: string;
  workflowRunId?: string;
  sourceEventIds?: string[];
};
```

Candidate location:

```ts
type EndoCase = {
  // existing fields
  workflowInstances?: AppointmentWorkflowInstanceState[];
  activeWorkflowInstanceId?: string;
};
```

This keeps the first implementation close to current persistence. A later visit/appointment model can move this state to an appointment object when visit identity is introduced.

## Instance Rules

### Explicit Target Scope

Every workflow instance must have a target.

Examples:

- Endodontic RCT: tooth 36
- Operative direct restoration: tooth 45, surfaces MOD
- Operative direct restoration: tooth 46, surface O

### Repeatable Workflow Type

Multiple instances may share a workflow type.

Example:

```text
operative.direct-restoration on tooth 45 MOD
operative.direct-restoration on tooth 46 O
```

These must remain separate instances, even if they occur during the same appointment.

### Shared Modules Link By Scope

Shared modules do not belong to every workflow instance automatically.

They should appear linked only when their recorded scope overlaps the workflow target.

Example:

```text
shared.anesthesia scoped to teeth 45 and 46
  -> usable by operative tooth 45 MOD
  -> usable by operative tooth 46 O
  -> not usable by endodontic tooth 36
```

### Current Runners Stay Workflow-Specific

The first implementation should adapt the current endodontic and operative runners to launch from an instance, but not make them generic.

## UI Slice

Update the appointment workflow map so it can:

- show each durable workflow instance,
- show its target scope,
- show status,
- enter the existing runner for ready workflow types,
- create another operative direct restoration instance,
- keep extraction and hygiene disabled/model-only.

Initial creation flow:

1. User selects `Add operative instance`.
2. App creates a new `operative.direct-restoration` instance with a new id.
3. User enters or edits tooth and surface scope in the existing operative setup surface.
4. Operative setup and restoration events reference the active workflow instance/run.

Endodontic behavior can remain a single case-backed instance in this slice, but it should be represented in the instance collection so the map no longer needs to derive it from scattered state.

## Persistence And Migration

Existing saved cases should continue to load.

Migration rules:

- If `workflowInstances` is missing, derive a baseline endodontic instance when existing endodontic case state is present.
- If operative setup or restoration events exist, create one operative instance from the latest compatible event.
- Do not create extraction, hygiene, treatment planning, or consent instances during migration.
- Preserve existing event ids and workflow run ids.
- Avoid duplicating migrated instances on repeated import/autosave cycles.

## Note And Export Behavior

Notes and JSON export should include workflow instance identity only as structure.

Do not change clinical wording in this slice except where needed to group existing facts by instance.

Acceptance criteria:

- JSON export preserves workflow instance ids, workflow types, targets, status, and source event ids.
- Compact and full notes remain clinically equivalent to the current output.
- Event-backed operative and shared-module notes still render from existing event details.

## Testing Plan

Add focused tests for:

- multiple operative instances in one appointment,
- separate targets for same workflow type,
- shared anesthesia scoped to two operative teeth but not an unrelated endodontic tooth,
- import/export round trip preserving workflow instances,
- migration from older saved cases with no `workflowInstances`,
- model-only extraction and hygiene remaining disabled,
- active workflow map actions routing to the selected instance.

Run:

```bash
npm test
npm run build
npm run docs:check
```

## Implementation Order

1. Add typed workflow-instance state and normalization helpers.
2. Migrate current derived map logic to prefer durable instances.
3. Add operative instance creation and active-instance selection.
4. Attach operative setup/restoration events to the active instance/run.
5. Add import/export persistence.
6. Add tests for migration, instance separation, scope matching, and UI routing.

## Open Questions

- Should endodontic RCT remain one case-backed instance until visit identity exists, or should it immediately receive the same active-instance controls as operative?
- Should `workflowInstances` live directly on `EndoCase` for now, or should a lightweight appointment object be introduced first?
- Should operative setup fields be per-instance immediately, or should they continue to hydrate from latest event until a second operative instance exists?
