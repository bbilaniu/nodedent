# Track sheet for nodedent.com workflow

This document tracks workflow observations and proposed fixes for future implementation.

PO = problem or observation  
PS = possibility or solution

## Implementation Priorities

### P0 - Confirmed Workflow Blockers

| Area | Current behavior | Proposed behavior | Acceptance criteria | Likely files |
| --- | --- | --- | --- | --- |
| Obturation gauging: next larger NiTi | On "Gauge with next larger NiTi file", the app requires an obturation gauge before the user can press either option. This blocks the user from choosing "Larger NiTi continues to advance beyond", even though the final gauge is not known yet. | Only require an obturation gauge when the user selects an option that records or confirms the final stopping gauge. The "continues to advance beyond" option should remain available without a gauge. | A user can press "Larger NiTi continues to advance beyond" without entering obturation gauge. "Larger NiTi size stops at shaping length" still requires obturation gauge. "Record obturation gauge" still requires obturation gauge. Engine tests cover both allowed and blocked paths. | `src/endo-guide/engine/validateDecision.ts`, `src/endo-guide/protocol/nodes.ts`, `src/endo-guide/__tests__/engine.test.ts` |
| Obturation gauging: self-loop feedback | Pressing "Larger NiTi continues to advance beyond" returns to the same card with no clear visual feedback. Users may click repeatedly without realizing the action was recorded. | Show a visible confirmation or recent-action message after self-loop decisions. | After selecting the self-loop option, the card clearly shows that the event was recorded and instructs the user to try the next larger file. The event log still receives the corresponding event. | `src/endo-guide/EndoChairsideGuide.tsx`, `src/endo-guide/components/DecisionCard.tsx`, `src/endo-guide/protocol/nodes.ts` |

## P1 - Focused UX Fixes

### Pre-op setup and canal naming

PO: Only one canal is shown at the bottom of the setup card.

PS: Keep the current data model with one default canal, but make the setup behavior clearer.

Proposed changes:
- Add short helper text near the pre-op estimated WL field: "This is for the active canal. Add or rename canals in the canal selector before working on additional canals."
- In the canal selector, make it clearer that more canals can be added and that the active canal needs its own estimated WL before pre-op can be marked complete.
- Keep the default canal named `Main` for now. Starting with zero canals would be a larger schema/workflow change because the app currently assumes at least one canal.

Acceptance criteria:
- New users can understand why only one estimated WL field appears during pre-op.
- Users can find the add/rename canal controls before access.
- Pre-op validation remains active-canal based.
- No schema migration is required.

Likely files:
- `src/endo-guide/components/DecisionCard.tsx`
- `src/endo-guide/components/CanalSelector.tsx`
- `src/endo-guide/state/persistence.ts`

Open question:
- Should `Main` be renamed to a more tooth-neutral placeholder such as `Canal 1`, or should it remain `Main` until the clinician renames it?

### Attach EAL to 10C: measurement explanation

PO: The values for `10C terminal length` and `Available treatment space` are not explained.

PS: Add concise help text or a tooltip near those fields.

Suggested help copy:

**Available treatment space and terminal length**

These measurements are used when a reliable EAL endpoint cannot be established.

- `10C terminal length`: how far the 10C scouting file advanced when it stopped short of the expected endpoint.
- `Available treatment space`: the measured canal space available for instrumentation from the selected reference point.

When EAL 0 is established, EAL-derived patency and shaping lengths take precedence. When EAL 0 cannot be established, these values help document limited access and guide safer planning.

Acceptance criteria:
- Help is available without crowding the measurement panel.
- The copy explains when the fields matter and when EAL takes precedence.
- The fields remain editable in the same place.

Likely files:
- `src/endo-guide/components/MeasurementPanel.tsx`
- `src/endo-guide/components/FormControls.tsx` if a reusable help/tooltip API is added.

### EAL measurement touch input

PO: Measurement input is difficult on touchscreen devices.

PS: First pass should improve numeric entry before adding larger controls.

Proposed changes:
- Add numeric keyboard hints for measurement fields, such as `inputMode="decimal"`.
- Consider a reusable `measurement` input variant instead of changing every field ad hoc.
- Defer +/- steppers until after testing; they add UI weight and need clear increment rules.

Acceptance criteria:
- On mobile/tablet, measurement fields open a numeric/decimal keyboard where supported.
- Placeholder text still appears when the field is empty.
- Existing text fields that are not measurements, such as reference point or master cone, are not forced into numeric input.

Likely files:
- `src/endo-guide/components/FormControls.tsx`
- `src/endo-guide/components/MeasurementPanel.tsx`
- `src/endo-guide/components/DecisionCard.tsx`

### EAL-derived patency and shaping suggestions

PO: Patency and shaping calculated values are currently shown in a separate hint/button, not beside the individual fields.

PS: Show suggested values directly near the Patency and Shaping fields when EAL 0 is entered.

Proposed changes:
- Show "Suggested: X mm" near the Patency field.
- Show "Suggested: Y mm" near the Shaping field.
- Keep the existing "Use EAL +/-1" action for users who want to apply both values.
- Use "patency", not "potency".

Acceptance criteria:
- Entering a valid EAL 0 immediately previews suggested patency and shaping values.
- The user can still type different values manually.
- The "Use EAL +/-1" button fills both fields with the suggested values.
- Validation still requires actual recorded values before continuing from EAL 0.

Likely files:
- `src/endo-guide/components/MeasurementPanel.tsx`
- `src/endo-guide/engine/measurements.ts`

## P2 - Product Backlog / Larger Design Work

### Static instruments on every card

PO: Instruments are static and cannot be customized.

PS: Add instrument preferences so offices can adjust instruments/materials while preserving the workflow logic.

Notes for future implementation:
- Treat this as a preferences feature, not a bug fix.
- Decide whether preferences are global, per device, per user, or per workflow version.
- Preserve default protocol instruments for a fresh install.
- Avoid changing historical notes if preferences change later.

Likely files:
- `src/endo-guide/protocol/nodes.ts`
- New preferences state/storage module.
- UI entry point in case/settings management.

### Workflow visualization

PO: Developers or curious users cannot visualize the workflow as a flow chart, idea tree, or spider web.

PS: Generate a protocol visualization from the node graph.

Notes for future implementation:
- Start with a developer-facing export or static diagram.
- Use `protocolNodes` as the source of truth.
- Include node id, title, phase, options, next node, and difficulty flags.
- Later, consider an in-app visual map if it helps clinicians navigate.

Likely files:
- `src/endo-guide/protocol/nodes.ts`
- New script under `scripts/` or a docs generation command.
- Existing `PhaseCanalMapModal` may be relevant for in-app display, but this is not the same as a full graph visualization.

## Deferred / Needs Decision

### Starting with no canals

PO: The default canal is called `Main`.

PS considered: Start with no canals, then suggest `Main` only if the user enters no name.

Recommendation:
- Do not include this in the bug-fix pass.
- The app currently requires at least one canal in the case schema and uses the active canal for pre-op validation, measurements, notes, and workflow state.
- A zero-canal start would require broader changes to validation, persistence, UI empty states, and note generation.

Decision needed:
- Keep `Main`, rename default to `Canal 1`, or introduce a guided canal setup step after access.

## Attachments

Original sketch reference:

`Attachments/B6553EA8-A5BA-412C-BAA0-AEE3DEC48B0F.png`

Status: this file is currently missing from the repo path referenced by the markdown. Add the image or update the link before relying on it for implementation.
