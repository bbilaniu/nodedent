Refactor the current endodontic chairside guide Canvas/JSX MVP into production-ready modules while preserving existing behavior.

Context:
The current JSX file now represents the true MVP for the interactive endodontic chairside decision guide. It includes multi-canal workflow, decision-card navigation, canal-aware continuation, measurements, validation, case management, phase/canal map, event log, note outputs, JSON import/export, local persistence, and responsive layouts.

The previously provided file `codex_endo_guide_mvp_instructions.md` described the original MVP architecture. The current Canvas exceeds the user-facing MVP scope, but it still needs a productionization/refactor pass.

Primary goal:
Refactor the current implementation into maintainable TypeScript modules without changing the user-visible behavior.

Do not redesign the UI in this task unless required to preserve behavior after refactoring.

Preserve these existing features:

* Decision card workflow
* Current phase display as `Phase : ...`
* Canal selector
* Canal controls directly under canal selector
* Case management modal opened from the top card
* Phase / canal map modal opened from the status card
* Required-field validation
* Branch consistency validation
* Canal-aware continuation options
* Event log
* Compact note
* Full note
* Patient-friendly summary
* JSON export/import
* Local persistence/autosave
* Responsive 1-, 2-, 3-, and 4-column layouts
* Chamber depth as a case-level measurement in the Measurements card
* WL PA and Cone fit PA fields
* The distinction between blank radiograph status and `not taken`

Recommended folder structure:

```text
src/
  endo-guide/
    protocol/
      nodes.ts
      phases.ts
      continuation.ts
      guards.ts
    schemas/
      EndoCase.schema.ts
      CanalRecord.schema.ts
      ClinicalEvent.schema.ts
    engine/
      applyDecision.ts
      getCurrentNode.ts
      validateDecision.ts
      deriveDifficulty.ts
      deriveCanalStatus.ts
      deriveCaseStatus.ts
    notes/
      buildCompactNote.ts
      buildFullNote.ts
      buildPatientSummary.ts
      buildJsonExport.ts
      fragments.ts
    components/
      DecisionCard.tsx
      CanalSelector.tsx
      CanalControls.tsx
      MeasurementPanel.tsx
      NotePreview.tsx
      EventLog.tsx
      CaseManagementModal.tsx
      PhaseCanalMapModal.tsx
      DifficultyBanner.tsx
    state/
      useEndoCaseStore.ts
      persistence.ts
    EndoChairsideGuide.tsx
```

Adjust paths to match project conventions, but preserve the separation of responsibilities.

Detailed tasks:

1. Extract protocol data

Move protocol node definitions out of the React component and into:

```text
protocol/nodes.ts
protocol/phases.ts
```

The protocol should remain data-driven.

Do not hardcode clinical branch logic inside JSX.

2. Extract canal status and case status logic

Move helpers such as:

```ts
getCanalStatus()
getCaseStatus()
deriveSuggestedCaseStatus()
getNextRecommendedNodeForCanal()
```

into engine/protocol helper files.

The canal-aware continuation logic should remain centralized.

Expected continuation mapping:

```text
notStarted     -> estimate-wl
scouted        -> open-orifice or dry-canal, depending on current implementation
wlEstablished  -> patency-10c
glidePath      -> gauge-final-shape
shaped         -> ready-for-obturation-gauging
medicated      -> resume/medication pathway
referred       -> disabled or no continuation
```

3. Replace label-parsing validation with structured guards where practical

The current MVP may validate some branches by reading button label text. Refactor toward structured validation.

For example, instead of relying only on:

```ts
label.includes(">16")
```

add an optional guard structure to decision options:

```ts
type DecisionGuard =
  | {
      type: "numericComparison";
      scope: "activeCanal" | "case";
      field: string;
      operator: ">" | ">=" | "<" | "<=" | "=";
      value: number;
      message: string;
    }
  | {
      type: "required";
      scope: "activeCanal" | "case";
      field: string;
      message: string;
    }
  | {
      type: "custom";
      id: string;
      message: string;
    };
```

Then decision options can include:

```ts
guards: [
  {
    type: "numericComparison",
    scope: "activeCanal",
    field: "availableTreatmentSpace",
    operator: ">",
    value: 16,
    message: "Available treatment space must be >16 mm for this option."
  }
]
```

Preserve all current validation behavior.

Important validation rules to preserve or implement:

```text
- Pre-op review requires chamber depth and estimated WL.
- Access chamber requires chamber depth.
- 10C stopped short requires 10C terminal length.
- If 10C terminal length is shorter than estimated WL, block “10C reached estimated WL.”
- If 10C terminal length is equal to or greater than estimated WL, block “10C stopped short.”
- Available treatment space >16 option requires numeric ATS >16.
- Available treatment space ≤16 option requires numeric ATS ≤16.
- EAL 0 recorded requires EAL 0, patency length, shaping length, reference point, and WL PA status.
- WL PA status must not be blank, but `not taken` is allowed.
- Final shape achieved requires a plausible shape such as 30/.04.
```

4. Add or update Zod schemas

Create schemas for:

```text
EndoCase
CanalRecord
ClinicalEvent
ClosureRecord
DecisionOption
ProtocolNode
```

Include fields currently present in the MVP, including:

```text
patientNumber
tooth
procedureType
caseStatus
difficulty
diagnosis
preOp.estimatedChamberDepth
currentCanal
canals
events
estimatedWorkingLength
fileTerminalLength
availableTreatmentSpace
referencePoint
eal0
patencyLength
shapingLength
wlRadiographStatus
finalShape
obturationGauge
masterCone
coneFitRadiograph
dryingStatus
closure
nextVisitPlan
autosavedAt
```

Radiograph statuses should allow:

```text
acceptable
short
long
not taken
blank/undefined before entry
```

5. Extract pure decision engine

Create a pure function:

```ts
type ApplyDecisionInput = {
  currentNodeId: string;
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  caseData: EndoCase;
  activeCanalName: string;
};

type ApplyDecisionOutput = {
  nextNodeId: string;
  updatedCaseData: EndoCase;
  generatedEvent?: ClinicalEvent;
  warnings: string[];
  errors: string[];
};

function applyDecision(input: ApplyDecisionInput): ApplyDecisionOutput
```

Requirements:

* No React dependency.
* No DOM dependency.
* No localStorage dependency.
* Deterministic.
* Unit-testable.
* Handles invalid node IDs and invalid option IDs gracefully.
* Does not mutate input case data.

6. Extract note generation

Move note generation into:

```text
notes/buildCompactNote.ts
notes/buildFullNote.ts
notes/buildPatientSummary.ts
notes/buildJsonExport.ts
notes/fragments.ts
```

Preserve current output behavior initially.

Then improve only where safe:

* Include WL PA status in working length note fragments.
* Include canal switching events in the full note/event narrative.
* Preserve compact note brevity.
* Preserve patient-friendly summary simplicity.

7. Extract UI components

Split the current JSX into components:

```text
DecisionCard
CanalSelector
CanalControls
MeasurementPanel
NotePreview
EventLog
CaseManagementModal
PhaseCanalMapModal
DifficultyBanner
```

Do not change the visual behavior except to fix obvious breakage caused by refactoring.

8. Preserve responsive layout

Keep the current responsive layout behavior:

```text
Small:
1 column

Large / 2-column:
Row 1: Canal selector   | Canal controls
Row 2: Decision card    | Measurements
Row 3: Event log        | Live note preview

XL / 3-column:
Row 1: Canal selector   | Canal controls   | Live note preview
Row 2: Decision card    | Measurements     | Recent event log

2XL / 4-column:
Column 1: Canal selector + Canal controls
Column 2: Decision card + Event log
Column 3: Measurements
Column 4: Live note preview
```

Ensure cards do not stretch vertically due to neighboring tall cards.

9. Preserve modal behavior

Top header:

* Not clickable as a whole.
* Contains a pill-shaped dark button labeled `Case management`.
* Button opens the Case management modal.

Status card:

* Not clickable as a whole.
* Contains a pill-shaped dark button labeled `Phase / canal map`.
* Button opens the Phase / canal map modal.

Both modals should share a consistent centered modal style.

10. Add tests

Use the project’s existing test tooling. Do not introduce a new test framework unless necessary.

Add tests for:

Decision engine:

* Valid transition produces next node and event.
* Invalid node ID returns an error.
* Invalid option returns an error.
* Difficulty flag is applied.
* Input case data is not mutated.

Validation:

* ATS 15 blocks `>16`.
* ATS 17 blocks `≤16`.
* ATS 16 allows `≤16`.
* Terminal length shorter than estimated WL blocks “10C reached estimated WL.”
* Terminal length equal to estimated WL blocks “10C stopped short.”
* Blank WL PA blocks EAL 0 completion.
* WL PA `not taken` does not block EAL 0 completion.
* Final shape validation accepts `30/.04`.

Canal continuation:

* Not started canal maps to estimated WL / initial scouting.
* WL established canal maps to glide path.
* Shaped canal maps to obturation gauging.
* Referred canal is disabled or has no continuation node.
* Switching canals preserves measurements.
* Switching canals logs `workflow.switchedCanal`.

Notes:

* Compact note includes canal measurements.
* Full note includes event fragments.
* Working length fragment includes WL PA status.
* JSON export preserves canal status and radiograph statuses.

Persistence:

* Exported JSON can be imported without losing canals, events, measurements, or current canal.

11. Avoid clinical expansion in this task

Do not encode additional 99-step protocol content in this refactor unless needed to preserve the current MVP.

Specifically do not expand into:

* full downpack/backfill logic
* complete cone short/long loops beyond current MVP
* full restorative closure customization
* backend integration
* EMR export
* PDF export

This task is about making the true MVP maintainable and testable.

Acceptance criteria:

* Existing Canvas behavior is preserved.
* The main guide component is much smaller and mostly composes extracted components.
* Protocol data is outside React JSX.
* Decision validation is centralized and testable.
* Note generation is outside React JSX.
* Zod schemas cover current case/canal/event data.
* Tests cover the important decision, validation, continuation, note, and export behaviors.
* The app still runs with the current responsive layout and modals.
