---
status: active
created_on: 2026-06-15
---

# Track Sheet For nodedent.com Workflow

This document tracks workflow observations, implemented fixes, and remaining product backlog for the NodeDent endodontic chairside workflow.

PO = problem or observation  
PS = possibility or solution

## Current Status

The first P0/P1 implementation pass was completed in commit `575deaf` (`Fix endo workflow loop feedback and guards`).

Verification completed for that implementation:

```bash
npm run test
npm run build
```

The developer-facing workflow graph export was implemented after that pass in commit `9adbb1a` (`Add generated endo workflow graph`). Run it with:

```bash
npm run docs:workflow-graph
```

Verification completed for the workflow graph export:

```bash
npm run docs:workflow-graph
npm run docs:check
npm run build
```

## Implemented

### P0 - Obturation Gauging Guard And Self-Loop Feedback

PO: On "Gauge with next larger NiTi file", the app required an obturation gauge before the user could press either option. This blocked "Larger NiTi continues to advance beyond", even though the final gauge was not known yet.

PS implemented:
- "Larger NiTi continues to advance beyond" can be selected without an obturation gauge.
- "Larger NiTi size stops at shaping length" still requires an obturation gauge.
- "Record obturation gauge" still requires an obturation gauge.
- Returning to the same card after the self-loop now shows a confirmation message that the larger NiTi advanced beyond and instructs the user to try the next larger file.
- Engine tests cover the allowed and blocked branches.

Implemented files:
- `src/nodedent/engine/validateDecision.ts`
- `src/nodedent/protocol/nodes.ts`
- `src/nodedent/components/DecisionCard.tsx`
- `src/nodedent/__tests__/engine.test.ts`

### P0 - Shaping Gauge Self-Loop Feedback

PO: On "Increase NiTi hand-file gauge", pressing "Next larger NiTi reaches shaping length; continue gauging" returned to the same card with no visual feedback.

PS implemented:
- Returning to the same card after this self-loop now shows a confirmation message that the next larger NiTi reached shaping length and instructs the user to try the next ISO size.
- The card's required-input text now clarifies that final shaping file is needed when the next larger file binds or stops short, not while the user is still continuing the gauge loop.
- Validation now keys the final-shaping-file requirement off the option event type instead of matching visible label text.
- Engine tests cover that the continue-gauging loop does not require final shaping file, while final gauge selection does.

Implemented files:
- `src/nodedent/components/DecisionCard.tsx`
- `src/nodedent/protocol/nodes.ts`
- `src/nodedent/engine/validateDecision.ts`
- `src/nodedent/__tests__/engine.test.ts`

### P1 - Pre-op Setup And Canal Naming Clarity

PO: Only one canal is shown during setup, and it was not clear that the estimated WL field applies to the active canal.

PS implemented:
- Added helper text near the pre-op estimated WL field explaining that the field is for the active canal.
- Added canal selector helper text explaining that canals can be added or renamed there and that pre-op completion uses the active canal's estimated WL.
- Kept the current model with one default canal named `Main`; starting with zero canals remains deferred.

Implemented files:
- `src/nodedent/components/DecisionCard.tsx`
- `src/nodedent/components/CanalSelector.tsx`

### P1 - Attach EAL To 10C Measurement Explanation

PO: `10C terminal length` and `Available treatment space` were not explained.

PS implemented:
- Added a collapsible measurement-panel help block explaining when those measurements are used.
- Clarified that EAL-derived patency and shaping lengths take precedence when EAL 0 is established.

Implemented files:
- `src/nodedent/components/MeasurementPanel.tsx`

### P1 - Touch Input For Measurements

PO: Measurement entry was difficult on touchscreen devices.

PS implemented:
- Added reusable `inputMode` support to `TextInput`.
- Applied decimal keyboard hints to measurement fields such as chamber depth, estimated WL, terminal length, available treatment space, EAL 0, patency, shaping, and obturation gauge.
- Non-measurement text fields such as reference point and master cone remain normal text inputs.

Implemented files:
- `src/nodedent/components/FormControls.tsx`
- `src/nodedent/components/MeasurementPanel.tsx`
- `src/nodedent/components/DecisionCard.tsx`

### P1 - EAL-Derived Patency And Shaping Suggestions

PO: Calculated patency and shaping values were shown only in a separate hint/button, not next to the individual fields.

PS implemented:
- Patency and shaping fields now show field-level suggested values when a valid EAL 0 is entered.
- The existing "Use EAL +/-1" action remains available to apply both suggested values.
- Users can still type different values manually.

Implemented files:
- `src/nodedent/components/FormControls.tsx`
- `src/nodedent/components/MeasurementPanel.tsx`
- `src/nodedent/engine/measurements.ts`

### P2 - Developer-Facing Workflow Visualization Export

PO: Developers or curious users could not visualize the workflow as a flow chart, idea tree, or spider web.

PS implemented:
- Added `npm run docs:workflow-graph`.
- Added a deterministic graph generator that reads `protocolNodes` as the source of truth.
- The generator validates that every option target exists before writing output.
- The generated Mermaid graph includes node id, title, phase groupings, option labels, target nodes, difficulty flags, note event types, and self-loop markers.
- Generated artifacts are written to `docs/generated/endo-workflow.md` and `docs/generated/endo-workflow.mmd`.
- `docs/generated/endo-workflow.md` includes a Mermaid code block for GitHub/Markdown preview.
- `docs/generated/endo-workflow.mmd` is the standalone Mermaid source for Mermaid Live Editor or future CLI exports.
- Current generated graph summary: 60 nodes, 121 edges, 5 self-loops, 58 difficulty edges, and 15 phases.
- `scripts/**/*.ts` is included in `tsconfig.json`, so the graph script is typechecked by `npm run build`.

Implemented files:
- `scripts/export-protocol-graph.ts`
- `package.json`
- `tsconfig.json`
- `docs/generated/endo-workflow.md`
- `docs/generated/endo-workflow.mmd`
- `docs/README.md`

How to inspect:
- Open `docs/generated/endo-workflow.md` in GitHub or a Markdown preview with Mermaid support.
- Copy `docs/generated/endo-workflow.mmd` into Mermaid Live Editor if local Markdown preview does not render Mermaid.

## Active Backlog

### Static Instruments On Every Card

PO: Instruments are static and cannot be customized.

PS: Add instrument preferences so offices can adjust instruments/materials while preserving workflow logic.

Notes for future implementation:
- Treat this as a preferences feature, not a bug fix.
- Decide whether preferences are global, per device, per user, or per workflow version.
- Preserve default protocol instruments for a fresh install.
- Avoid changing historical notes if preferences change later.

Likely files:
- `src/nodedent/protocol/nodes.ts`
- New preferences state/storage module.
- UI entry point in case/settings management.

### In-App Workflow Graph Viewer

PO: The developer-facing Mermaid export makes the graph inspectable in docs, but there is still no in-app full workflow graph.

PS: Consider an in-app workflow map only if users need graph navigation inside the chairside guide.

Notes for future implementation:
- Reuse the same graph-extraction rules as `scripts/export-protocol-graph.ts`.
- Keep `PhaseCanalMapModal` focused on per-canal phase progress; a full protocol graph is a separate view.
- Avoid adding a graph layout dependency until there is a concrete user-facing workflow for it.

### Touchscreen Measurement Steppers

PO: Decimal keyboard hints improve mobile entry, but some operators may still prefer +/- controls for precise chairside adjustment.

PS: Consider stepper controls only after hands-on testing.

Notes for future implementation:
- Define increment size before implementation, such as 0.5 mm or 1.0 mm.
- Keep placeholders visible when fields are empty.
- Avoid adding steppers to non-measurement fields.

## Deferred / Needs Decision

### Starting With No Canals

PO: The default canal is called `Main`.

PS considered: Start with no canals, then suggest `Main` only if the user enters no name.

Recommendation:
- Do not include this in the current bug-fix pass.
- The app currently requires at least one canal in the case schema and uses the active canal for pre-op validation, measurements, notes, and workflow state.
- A zero-canal start would require broader changes to validation, persistence, UI empty states, and note generation.

Decision needed:
- Keep `Main`, rename default to `Canal 1`, or introduce a guided canal setup step after access.

## Attachments

Original sketch reference:

`Attachments/B6553EA8-A5BA-412C-BAA0-AEE3DEC48B0F.png`

Status: this file is currently missing from the repo path referenced by the markdown. Add the image or update the link before relying on it for implementation.
