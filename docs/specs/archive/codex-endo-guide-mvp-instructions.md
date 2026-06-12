---
status: implemented
created_on: 2026-05-27
completed_on: 2026-06-07
---

# Codex Implementation Instructions: Endodontic Chairside Decision Guide MVP

## Context

You are implementing an MVP web app feature for an interactive endodontic chairside decision guide with automatic clinical note generation.

There are two reference documents:

1. `docs/source/systematic-endodontics-99-step-algorithm.md`
   - This is the full source protocol.
   - Treat it as source material for clinical sequence, branch logic, instruments, measurements, warnings, and note-worthy events.
   - Do **not** display the whole 99-step protocol as a long checklist.

2. `docs/specs/endo-chairside-decision-guide-proposal.md`
   - This is the product and architecture proposal.
   - Use it to guide the implementation approach.
   - The app should be a decision engine plus note generator, not a static form and not a simple checklist.

If these filenames differ in the repository, locate the equivalent files and preserve the same intent.

---

## High-Level Goal

Create an MVP interactive endodontic chairside guide that:

1. Shows the clinician one relevant decision card at a time.
2. Tracks the current tooth, canal, phase, measurements, and difficulty status.
3. Branches through protocol nodes based on clinically meaningful decisions.
4. Records clinical events as the user progresses.
5. Generates a compact clinical note from the structured case data and event log.
6. Exports structured JSON for future EMR/API integration.

---

## Product Principle

Every chairside click should do at least one of the following:

- Advance the clinical state.
- Record a clinically meaningful fact.
- Trigger a safety, difficulty, medication, temporization, or referral pathway.
- Add a structured event to the clinical note.

Avoid generic buttons such as:

```text
Next
Continue
Done
```

Prefer clinically meaningful buttons such as:

```text
10C reached estimated working length
10C stopped short
EAL 0 established
Guide path file reached EAL 0
Final shape achieved
Paper point remains wet
Medicate and temporize
Refer
```

The button labels should help generate the clinical note.

---

## MVP Scope

Do **not** encode the entire 99-step algorithm yet.

For the MVP, implement the generic architecture and only the first useful subset of the protocol.

Implement protocol nodes for:

1. Pre-op setup
2. Estimate chamber depth
3. Access chamber
4. Confirm chamber access
5. Refine access
6. Identify canals
7. Estimate working length
8. Advance 10C hand file to passive resistance
9. Measure available treatment space
10. Assess available treatment space difficulty
11. Open canal orifice
12. Dry canal
13. Attach EAL
14. Establish EAL 0
15. Record EAL 0 / patency length / shaping length
16. 10C to patency length until super loose
17. Guide path file to EAL 0
18. Gauge with 25 NiTi hand file
19. Create final .04 shape
20. Irrigate and recapitulate
21. Persistent wet canal pathway
22. Calcium hydroxide placement
23. Temporary closure
24. Referral / stop pathway

The MVP should prove the model, not finish the whole clinical protocol.

---

## Required Architecture

Use a data-driven protocol model.

Do **not** hardcode clinical branch logic directly inside React JSX.

Suggested structure:

```text
src/
  endo-guide/
    protocol/
      nodes.ts
      phases.ts
      transitions.ts
      reusableModules.ts
    schemas/
      EndoCase.schema.ts
      CanalRecord.schema.ts
      ClinicalEvent.schema.ts
    engine/
      getCurrentNode.ts
      applyDecision.ts
      deriveDifficulty.ts
      validateRequiredInputs.ts
    notes/
      buildFullNote.ts
      buildCompactNote.ts
      buildPatientSummary.ts
      buildJsonExport.ts
      fragments.ts
    components/
      DecisionCard.tsx
      CanalTabs.tsx
      MeasurementPanel.tsx
      NotePreview.tsx
      PhaseMap.tsx
      DifficultyBanner.tsx
      TroubleshootingDrawer.tsx
      ExportPanel.tsx
    state/
      useEndoCaseStore.ts
      useProtocolNavigation.ts
```

Adjust the folder structure to match the existing project conventions if needed, but preserve the separation between:

- Protocol data
- Decision engine
- Schemas
- UI components
- Note generation
- State management

---

## Core Types

Create or adapt TypeScript types similar to the following.

```ts
export type DifficultyFlag = "none" | "caution" | "high" | "refer";

export type DecisionOption = {
  label: string;
  nextNodeId: string;
  noteEvent?: {
    type: string;
    details?: Record<string, unknown>;
  };
  difficultyFlag?: DifficultyFlag;
};

export type ProtocolNode = {
  id: string;
  phase: string;
  title: string;
  chairsideInstruction: string;
  instruments?: string[];
  materials?: string[];
  requiredInputs?: string[];
  safetyNotes?: string[];
  options: DecisionOption[];
};
```

Case data should be tooth-based globally and canal-based after access.

```ts
export type EndoCase = {
  tooth: string;
  procedureType: "RCT" | "RCT initiated" | "Retreatment" | "Emergency pulpectomy";
  diagnosis?: {
    pulpal?: string;
    apical?: string;
  };
  preOp?: {
    radiographsReviewed?: boolean;
    cbctReviewed?: boolean;
    estimatedChamberDepth?: number;
  };
  canals: CanalRecord[];
  globalEvents: ClinicalEvent[];
  closure?: ClosureRecord;
};

export type CanalRecord = {
  name: string;
  estimatedWorkingLength?: number;
  availableTreatmentSpace?: number;
  referencePoint?: string;
  eal0?: number;
  patencyLength?: number;
  shapingLength?: number;
  finalShape?: string;
  obturationGauge?: string;
  masterCone?: string;
  coneFitRadiograph?: "acceptable" | "short" | "long" | "not taken";
  dryingStatus?: "dry" | "slightly damp" | "wet" | "persistent wet";
  events: ClinicalEvent[];
};

export type ClinicalEvent = {
  id: string;
  timestamp: string;
  type: string;
  tooth?: string;
  canal?: string;
  details?: Record<string, unknown>;
};

export type ClosureRecord = {
  type: "temporary" | "orifice barrier and temporary" | "final restoration";
  material?: string;
  notes?: string;
};
```

---

## Zod Validation

Use Zod schemas for the clinical data.

At minimum, validate:

- Tooth
- Procedure type
- Canal names
- Positive numeric measurements
- Final shape strings
- Closure type
- Exportable JSON shape

Example:

```ts
import { z } from "zod";

export const CanalRecordSchema = z.object({
  name: z.string().min(1),
  estimatedWorkingLength: z.number().positive().optional(),
  availableTreatmentSpace: z.number().positive().optional(),
  referencePoint: z.string().optional(),
  eal0: z.number().positive().optional(),
  patencyLength: z.number().positive().optional(),
  shapingLength: z.number().positive().optional(),
  finalShape: z.string().optional(),
  obturationGauge: z.string().optional(),
  masterCone: z.string().optional(),
  coneFitRadiograph: z.enum(["acceptable", "short", "long", "not taken"]).optional(),
  dryingStatus: z.enum(["dry", "slightly damp", "wet", "persistent wet"]).optional()
});

export const EndoCaseSchema = z.object({
  tooth: z.string().min(1),
  procedureType: z.enum(["RCT", "RCT initiated", "Retreatment", "Emergency pulpectomy"]),
  canals: z.array(CanalRecordSchema),
  globalEvents: z.array(z.any()).default([])
});
```

---

## Decision Engine

Implement a pure decision engine.

React components should call this engine instead of embedding branch logic.

Suggested function:

```ts
type DecisionEngineInput = {
  currentNodeId: string;
  selectedOptionLabel: string;
  caseData: EndoCase;
};

type DecisionEngineOutput = {
  nextNodeId: string;
  updatedCaseData: EndoCase;
  generatedEvent?: ClinicalEvent;
  warnings?: string[];
};

export function applyDecision(input: DecisionEngineInput): DecisionEngineOutput {
  // 1. Find current protocol node.
  // 2. Find selected decision option.
  // 3. Generate an event if the option defines one.
  // 4. Add the event to the correct tooth/canal/global event log.
  // 5. Apply difficulty flags or warnings.
  // 6. Return the next node and updated case data.
}
```

Requirements:

- The engine should be deterministic.
- The engine should be unit-testable.
- The engine should not depend on React.
- The engine should not directly manipulate the DOM or browser storage.
- The engine should gracefully handle invalid node IDs or invalid option labels.

---

## Required UI Components

### `DecisionCard`

Displays:

- Phase
- Title
- Chairside instruction
- Instruments/materials
- Safety notes
- Required input fields, if any
- Decision buttons

The decision buttons should use clinically meaningful labels.

### `CanalTabs`

Allows switching between canals.

Should support common canal labels such as:

```text
MB
MB2
ML
DB
DL
P
B
L
M
D
```

Also allow custom canal names.

### `MeasurementPanel`

Displays and edits key values:

```text
Estimated working length
Available treatment space
Reference point
EAL 0
Patency length
Shaping length
Final shape
Master cone
Cone fit radiograph status
Drying status
```

### `DifficultyBanner`

Displays warnings when difficulty increases.

Example warning:

```text
Available treatment space is ≤16 mm. Case difficulty increases significantly. Proceed with extreme caution, medicate/temporize, or refer.
```

### `NotePreview`

Displays the note generated from case data and event log.

Should support at least:

- Compact clinical note
- Structured JSON export

Optional for MVP:

- Full clinical note
- Patient-friendly summary

### `ExportPanel`

Provides:

- Copy compact note
- Copy JSON
- Download JSON, if the project already supports downloads
- Future placeholder for EMR/API export

---

## Reusable Troubleshooting Modules

Create reusable protocol modules rather than duplicating repeated loops.

### Regain Patency Module

Use when the protocol requires return to patency work.

```text
Regain Patency

1. Irrigate.
2. Place lubricant or aqueous irrigation.
3. Measure 10C hand file to patency length.
4. Advance to reference point.
5. Work in filing / reciprocating / watch-winding motion.
6. Continue until 10C is super loose.
7. Reassess.

Outcomes:
[Patency regained]
[Still short]
[File stop]
[File resistance]
[Medicate and temporize]
[Refer]
```

### File Stop vs File Resistance Module

```text
Determine whether the file is encountering resistance or a stop.

Outcomes:
[File resistance]
[File stop]
[Uncertain]
[Difficulty exceeds comfort]
```

### Persistent Wet Canal Module

```text
Persistent wet canal

1. Repeat drying with measured paper points.
2. If still wet after several attempts, place calcium hydroxide.
3. Close access with sponge and temporary restorative material.
4. Resume at smear layer removal / disinfection pathway next visit if appropriate.

Outcomes:
[Canal dried]
[Persistent wet canal]
[Calcium hydroxide placed]
[Temporized]
[Refer]
```

---

## Note Generation Requirements

Generate notes from structured data and events, not directly from the currently visible UI.

At minimum, implement:

1. `buildCompactNote(caseData: EndoCase): string`
2. `buildJsonExport(caseData: EndoCase): object`

Optional but recommended:

1. `buildFullNote(caseData: EndoCase): string`
2. `buildPatientSummary(caseData: EndoCase): string`

Compact note example:

```text
36 RCT. RD isolation. Access completed, canals MB/ML/DB/DL located. WLs established with EAL/PA. NaOCl irrigation throughout, 17% EDTA smear layer removal, final NaOCl. Shaped to 30/.04. GP cone fit confirmed PA. Bioceramic sealer + GP obturation completed. Access temporized. POIG.
```

JSON export example:

```json
{
  "tooth": "36",
  "procedure": "RCT",
  "canals": [
    {
      "name": "MB",
      "eal0": 20.5,
      "patencyLength": 21.5,
      "shapingLength": 19.5,
      "finalShape": "30/.04",
      "masterCone": "30/.04"
    }
  ],
  "irrigants": ["NaOCl", "17% EDTA"],
  "sealer": "bioceramic sealer",
  "closure": "temporary restorative material"
}
```

---

## Safety and UX Requirements

The app is a clinical documentation and workflow aid. It should not present itself as replacing clinical judgment.

Include a small disclaimer in the guide UI or documentation:

```text
This guide is a workflow and documentation aid. It does not replace clinical judgment, diagnosis, informed consent, or referral when treatment exceeds the clinician's comfort or skill level.
```

Warnings should appear when:

```text
Available treatment space ≤16 mm
File remains >3 mm short of estimated working length
File stop cannot be bypassed
Repeated failure to regain patency
Guide path file cannot reach guide path length
Final shape cannot be created predictably
Canal remains wet after repeated drying
Clinician selects difficulty exceeds comfort
```

Whenever one of these warnings occurs, the user should be offered clinically meaningful options:

```text
Proceed with caution
Medicate and temporize
Refer
Document difficulty and continue
```

---

## State Management

Use the existing project state conventions if available.

If no convention exists, implement a lightweight local state store first.

Requirements:

- Track current node ID.
- Track current tooth.
- Track current canal.
- Track case data.
- Track event log.
- Support undoing the last decision if practical.
- Persist to local storage or IndexedDB only if consistent with the project.

Do not add a backend for the MVP unless the existing project already has one.

---

## Testing Requirements

Add tests for:

1. Protocol node lookup.
2. Valid decision transition.
3. Invalid decision transition.
4. Event generation.
5. Difficulty flag generation.
6. Compact note generation.
7. JSON export validation.
8. Zod schema validation for valid and invalid canal records.

Use the repository's existing test framework and commands.

Do not introduce a new test framework unless necessary.

---

## Acceptance Criteria

The MVP is complete when:

- A user can start an endodontic case for a tooth.
- A user can add canals.
- A user can move through decision cards for the MVP scope.
- A user can enter working length and shaping measurements.
- The app records clinical events as decisions are made.
- The app displays a live compact note preview.
- The app can copy or export JSON.
- Difficulty warnings appear for the major MVP triggers.
- Clinical flow is encoded as protocol data, not hardcoded into React components.
- TypeScript and Zod validation are used for core clinical data.
- Tests cover the decision engine and note generator.

---

## Out of Scope for This MVP

Do not implement these yet unless they already exist in the project:

```text
Full 99-step protocol encoding
Backend storage
User accounts
EMR integration
PDF export
Voice control
Full patient-friendly summary
Multi-visit case resumption
All obturation branches
All cone-fitting branches
Complete restorative closure customization
```

Leave clear TODOs where these later features should connect.

---

## Suggested First Implementation Order

1. Add TypeScript types and Zod schemas.
2. Add a small set of protocol nodes.
3. Add the pure decision engine.
4. Add event logging.
5. Add compact note generation.
6. Add JSON export.
7. Build the `DecisionCard` component.
8. Build basic canal and measurement panels.
9. Add difficulty warnings.
10. Add tests.
11. Wire the feature into the existing app route or template structure.

---

## Important Implementation Notes

- Keep clinical protocol content in data files.
- Keep note generation separate from protocol navigation.
- Keep the decision engine pure and testable.
- Do not make the UI a long checklist.
- Do not show all protocol steps at once.
- Prefer current action + current decision + persistent measurements.
- Use clinically meaningful button labels.
- Preserve the ability to expand this into the full 99-step protocol later.
- Preserve the ability to reuse the same engine for other chairside guides later.
