# Proposal: Add Phase-Aware Canal Switch Menus At Key Endodontic Handoff Nodes

## Context

The current endodontic chairside guide supports multi-canal workflow and already has a canal-aware continuation menu near the later handoff before final cleaning, disinfection, and obturation. That existing menu lets the user continue another existing canal instead of relying on a vague "Start another canal" action.

Generalize that pattern earlier in the workflow so the clinician can work phase-by-phase across canals when appropriate.

This is especially useful in molars. Clinically, a user may want to:

```text
Locate canals
-> Scout multiple canals
-> Establish WLs for multiple canals
-> Create glide paths
-> Shape systematically
-> Proceed to final cleaning / disinfection / obturation
```

instead of completing one canal all the way to shaping before finding WLs in the other canals.

## Goal

Add a phase-aware canal switch menu at key handoff nodes before final cleaning and obturation, using the same conceptual pattern already implemented near the final cleaning / obturation handoff.

The menu should let the clinician choose whether to:

1. Continue the active canal to the next phase.
2. Switch to another existing canal at the appropriate phase.
3. Add a new canal separately, without confusing that with switching to an existing canal.

## Important UX Principle

Do not use vague labels like:

```text
Start another canal
Continue
Next
```

Use canal-specific, phase-specific labels such as:

```text
Start ML at scouting / estimated WL
Establish WL for DB
Continue DL at glide path
Shape MB
Proceed with P to final cleaning / obturation
```

## Existing Behavior To Preserve

There is already a canal-aware continuation menu before final cleaning / obturation. Do not remove it.

Instead:

- Reuse its helper logic if possible.
- Generalize it so earlier nodes can render a similar menu.
- Keep behavior consistent across all canal handoff points.
- Preserve current clinical routing unless tests expose a routing bug.

## Current Project Baseline

The app already has the primitives needed for this PR:

```text
EndoCase.currentCanal
EndoCase.canals[]
CanalRecord.events[]
globalEvents[]
getCanalStatus()
getCanalCheckpointNodeId()
getNextRecommendedNodeForCanal()
getCanalContinuationTargets()
workflow.switchedCanal events
DecisionCard canal continuation rendering
```

The next implementation should extend these primitives rather than replace them. Do not add protocol business logic directly inside React components when it belongs in `protocol/`, `engine/`, or a focused helper module.

## Proposed Handoff Points

Add phase-aware canal switch menus at these key nodes or their current equivalent node IDs:

```text
After canals identified
After estimated WL / initial scouting
After EAL 0 / WL established
After glide path created
After final shaping completed
Before final cleaning / disinfection / obturation
```

Use the actual node IDs from the current refactored codebase.

Suggested current mapping:

```text
identify-canals
-> after canals are identified; allow starting estimated WL / scouting for canals

estimate-wl / advance-10c
-> estimated WL and initial 10C scouting area; allow switching to another canal for scouting

establish-eal0
-> WL established; allow switching to another canal for WL or continuing active canal to patency / glide path

guide-path
-> glide path completed; allow switching to another canal for glide path or continuing active canal to shaping

irrigate-recapitulate / shaping.completed event
-> final shaping completed; allow switching to another canal for shaping or proceeding to smear layer removal

ready-for-obturation
-> existing final cleaning / obturation canal-aware menu; preserve behavior

ready-for-sealer-cone-seating
-> existing sealer / cone seating handoff; preserve behavior
```

If a listed conceptual handoff maps better to a different current node after code inspection, use the current protocol node that represents the completed phase and document it in tests.

## Conceptual Handoff Behavior

```text
Canals identified
-> allow starting scouting / estimated WL for any canal

Estimated WL set / 10C scouting complete
-> allow switching to another canal for scouting
-> allow continuing active canal to working length / EAL

WL established
-> allow switching to another canal to establish WL
-> allow continuing active canal to patency / glide path

Glide path complete
-> allow switching to another canal for glide path
-> allow continuing active canal to shaping

Shaping complete
-> allow switching to another canal for shaping
-> allow proceeding to final cleaning / disinfection / obturation

Before final cleaning / obturation
-> preserve the existing canal-aware menu
```

## Suggested Implementation

Create or extend a helper such as:

```ts
type CanalPhaseTarget = {
  canalName: string;
  status: CanalStatus;
  phaseLabel: string;
  nextNodeId: string | null;
  buttonLabel: string;
  disabled?: boolean;
  reason?: string;
};

function getPhaseAwareCanalTargets(
  caseData: EndoCase,
  currentNodeId: string,
  activeCanalName: string
): CanalPhaseTarget[] {
  // Return canal-specific continuation targets for the current handoff node.
}
```

This should use existing helpers where possible:

```ts
getCanalStatus(canal)
getNextRecommendedNodeForCanal(canal)
getCanalContinuationTargets(caseData)
```

It may need additional context from `currentNodeId`, because the desired switch menu depends on the current phase.

Preferred placement:

```text
src/endo-guide/protocol/continuation.ts
```

or a small adjacent module imported by `continuation.ts`, if the helper becomes large enough to justify separation.

## Status-Based Target Behavior

Use the current status naming from the codebase. Current vocabulary includes:

```text
notStarted
estimated
scouted
wlEstablished
glidePath
shaped
disinfected
complete
paused
medicated
referred
```

Target labels should behave conceptually like:

```text
notStarted
-> Start [canal] at estimated WL / scouting

estimated
-> Start [canal] at scouting

scouted
-> Continue [canal] at working length / EAL

wlEstablished
-> Continue [canal] at patency / glide path

glidePath
-> Continue [canal] at final shaping

shaped
-> Proceed with [canal] to final cleaning / obturation

disinfected
-> Proceed with [canal] to obturation / cone fit path, according to current routing

complete
-> Disable or omit from active continuation options

medicated
-> Resume [canal] from medication / next-visit pathway if implemented

paused
-> Resume [canal] from documented pause if implemented

referred
-> Disable or omit from active continuation options
```

Do not collapse `estimated` into `scouted`. Estimated WL alone is not canal scouting.

Add new statuses only if the current vocabulary causes unsafe or misleading resume behavior. Possible future statuses, only if tests prove they are needed:

```text
coneFitReady
sealerStarted
obturationStarted
```

## Rendering

In `DecisionCard` or a related component, render a dynamic section only at handoff nodes:

```text
Work on another canal

[Start MB at scouting]
[Establish WL for ML]
[Continue DB at glide path]
[Shape DL]
```

Keep the active canal's normal protocol options above this section.

Example:

```text
Decision card
Phase : Working length
EAL 0 recorded and WL radiograph taken

Primary options:
[Continue active canal to patency / glide path]

Work on another canal:
[Establish WL for MB]
[Establish WL for DB]
[Start P at scouting]

Other:
[Add new canal]
```

## Add New Canal Behavior

Keep Add new canal separate from existing-canal continuation options.

Requirements:

- It should not duplicate an existing canal.
- It should not be labeled as "Start another canal."
- It should either open/focus the existing add-canal control or use the existing add-canal function.
- Existing-canal buttons should switch canals, not create canals.

## Canal Switch Behavior

When a user selects a canal switch option:

```ts
function continueCanalFromPhaseTarget(target: CanalPhaseTarget) {
  // Set active canal to target.canalName.
  // Navigate to target.nextNodeId.
  // Log workflow.switchedCanal.
}
```

The event should include:

```ts
{
  type: "workflow.switchedCanal",
  details: {
    previousCanal,
    nextCanal,
    previousNodeId,
    nextNodeId,
    reason: target.buttonLabel,
    phaseLabel: target.phaseLabel
  }
}
```

This should preserve existing data on all canals. Switching canals must not erase measurements, events, WL PA data, cone fit PA data, or canal status.

## Note Output

The compact note does not need to list every canal switch.

The full note / event narrative should include canal switch events, for example:

```text
Workflow switched from MB to ML; continued ML at working length.
```

If an event fragment already exists for `workflow.switchedCanal`, extend it only as needed to include the new `phaseLabel` detail cleanly.

## Validation

Switching canals should not bypass required validation for documenting completed work.

For example:

- If the user wants to document "EAL 0 recorded," required WL fields still apply.
- If the user switches away before completing a step, do not falsely mark that step complete.
- Switching canals should preserve all measurements and events already recorded for each canal.

Do not add a new multi-canal closure guard as part of this PR unless an existing test exposes a current workflow bug. Closure blocking is a separate workflow-hardening concern and should remain in the broader roadmap.

## Tests

Add or update tests for:

```text
- Handoff nodes create phase-aware canal targets.
- Existing final cleaning / obturation canal-aware menu still works.
- notStarted canal creates a "Start [canal] at estimated WL / scouting" target.
- estimated canal creates a "Start [canal] at scouting" target.
- wlEstablished canal creates a "Continue [canal] at glide path" target.
- glidePath canal creates a "Continue [canal] at shaping" target.
- shaped canal creates a "Proceed with [canal] to final cleaning / obturation" target.
- referred canal is disabled or omitted from active continuation.
- complete canal is disabled or omitted from active continuation.
- Selecting a target changes active canal and current node.
- Selecting a target logs workflow.switchedCanal with phaseLabel.
- Switching canals does not erase measurements, events, WL PA, cone fit PA, or canal status.
- Add new canal remains separate from existing-canal continuation.
```

Prefer focused helper tests for `getPhaseAwareCanalTargets()` first. Add UI tests only for rendering and callback wiring that cannot be covered at the helper level.

## Acceptance Criteria

- The existing canal-aware menu before final cleaning / obturation is preserved.
- Similar phase-aware canal switch menus appear at earlier key handoff nodes.
- The user can choose a phase-by-phase molar workflow without losing the ability to work canal-by-canal.
- Buttons are canal-specific and phase-specific.
- No vague "Start another canal" action remains at these handoff points.
- Switching canals preserves all case data.
- Canal switch events appear in the event log and full note narrative.
- Tests cover the new continuation helper and UI behavior.

## Out Of Scope

Do not implement these in this PR:

```text
- true multi-node simultaneous state machines
- drag-and-drop phase boards
- new generalized clinical-guide framework
- major note-template redesign
- final restoration workflow expansion
- new treatment protocols beyond the existing endodontic nodes
- sealer placement / downpack / backfill routing changes
- multi-canal closure blocking unless tests expose an existing bug
```

## Suggested PR Shape

Recommended commit sequence:

1. Add helper tests for phase-aware canal targets.
2. Implement or generalize the continuation helper.
3. Wire the helper into the decision card rendering at approved handoff nodes.
4. Extend `workflow.switchedCanal` details and note fragment if needed.
5. Add minimal UI tests for the rendered menu and switch action.

Keep the clinical routing stable unless a failing test proves the existing routing is wrong.
