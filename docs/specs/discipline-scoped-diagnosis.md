---
status: active
created_on: 2026-08-24
---

# Discipline-Scoped Diagnosis

## Goal

Provide an obvious place to record and review diagnosis without treating two related fields as an executable workflow, while establishing a safe extension boundary for future disciplines.

This specification defines product and implementation structure. It does not add diagnosis terminology or clinical guidance.

## Confirmed Architecture

Diagnosis is shared clinical context presented through a standalone panel. It is not a workflow merely because another workflow consumes its readiness status.

The architecture has four layers:

1. a discipline-scoped diagnosis-section registry;
2. storage adapters owned by each registered section;
3. readiness selectors with explicit capability and target scope; and
4. presentation surfaces that render the registry without owning diagnosis rules.

The current registry contains one section, **Endodontic diagnosis**, with the existing **Pulpal diagnosis** and **Apical diagnosis** fields. It uses the existing `caseData.diagnosis` record so current persistence, import, export, and note output remain compatible.

## Presentation And Navigation

### Diagnosis panel

The full-page Diagnosis panel:

- identifies the active case target;
- groups fields under their discipline;
- shows recorded or not-recorded status independently from action styling;
- explains that changes autosave to the protected case draft;
- uses explicit return actions at the top and bottom; and
- does not show steps, progress, completion, or workflow-run controls.

When opened from Case Setup, closing the panel returns to Case Setup. When opened from shared readiness or NodeDent Home, closing returns to the workspace.

### Case Setup & Status

Case Setup does not render the editable diagnosis fields. It shows a compact diagnosis status, target summary, and **Review diagnosis** action. Diagnosis therefore remains discoverable in Case Setup without making that page the owner of discipline-specific clinical forms.

Diagnosis, Radiographs, Anesthesia, and Isolation are presented as one responsive two-column readiness grid. Each card uses the same title, status, summary, and primary-action hierarchy. Case Setup does not repeat those statuses in a second aggregate panel. Radiograph modality controls belong to the radiology workflow; Case Setup may display legacy field values and event summaries but does not edit them inline.

### Shared readiness and NodeDent Home

The Diagnosis item opens the Diagnosis panel directly. An item must not route through Case Setup merely because the legacy fields were once rendered there.

## Registry Contract

Every diagnosis section must declare:

- a stable section identifier;
- a visible discipline label and section label;
- its field definitions;
- its capture surface, initially `panel` or `workflow`;
- its readiness capability name;
- its target scope kind;
- its completion policy; and
- an explicit storage adapter before it becomes editable.

Adding a card alone is not sufficient. A new section must not read or write another discipline's record and must not satisfy another discipline's readiness capability by default.

The current `diagnosis.recorded` capability is a compatibility capability backed only by the existing endodontic fields. It must not be interpreted as proof that any future caries, operative, prosthodontic, or treatment-planning diagnosis has been recorded. A future discipline must introduce its own reviewed field model and capability contract before it is added to the registry.

## Future Sections

The registry can eventually host additional diagnosis sections when the corresponding clinical vocabulary, storage shape, readiness meaning, note output, and source grounding have been reviewed.

Candidate areas such as caries assessment, prosthodontics, or treatment planning are not automatically equivalent kinds of diagnosis. They may require separate assessment, findings, risk, problem-list, or plan domains rather than new free-text diagnosis fields. Product naming must follow the reviewed domain model rather than the visual convenience of placing every item on the Diagnosis page.

## Panel-To-Workflow Promotion Rule

A diagnosis section stays a panel while it is a grouped context record. It may be promoted to a workflow only when the implemented capture has at least one material workflow need, such as:

- a clinically meaningful ordered sequence;
- resumable progress, branching, validation gates, or repeated actions; or
- auditable events or outputs that downstream workflows consume.

Promotion requires its own workflow definition, entry and completion semantics, event model, persistence behavior, note behavior, and tests. A multi-section form, conditional field visibility, or a dependency from another workflow is not enough by itself.

## Compatibility And Migration

This tranche deliberately preserves:

- `EndoCase.diagnosis.pulpal` and `EndoCase.diagnosis.apical`;
- the existing import schema and initial-case shape;
- full and compact note output;
- JSON and printable exports; and
- the existing field-completion rule that either current field records diagnosis content.

Readiness additionally requires the default tooth that scopes the compatibility record. Content entered without a default tooth remains stored and visible, but its capability status stays pending until the target is set.

The registry is the compatibility boundary. If a later schema introduces discipline-keyed records or immutable target snapshots, migration logic should be added behind the registry adapters before presentation code changes.

## Non-Goals

- Inventing caries, prosthodontic, or treatment-planning terminology.
- Turning every shared-readiness item into a workflow.
- Adding clinical decision support or inferred diagnoses.
- Changing current note or export wording.
- Claiming that a diagnosis recorded for one discipline satisfies another discipline.

## Implemented First Tranche

- The diagnosis registry and endodontic adapter are implemented.
- The full-page Diagnosis panel is implemented.
- Shared readiness and NodeDent Home open the panel directly.
- Case Setup now contains compact diagnosis status and navigation rather than editable diagnosis fields.
- Existing selector, note, export, and persistence behavior remains compatible.
- Tests cover registry ownership, panel presentation, navigation callbacks, and Case Setup separation.
