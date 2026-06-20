# NodeDent Workflow Development Guide

NodeDent started as an endodontic decision guide, but the app now supports reusable shared modules and non-endodontic primary workflows such as operative direct restoration. This guide describes the current development structure for workflow data, decision logic, event-backed documentation, notes, exports, and UI rendering.

This is living contributor guidance, not a lifecycle-tracked product spec. Keep it current when NodeDent workflow architecture, shared modules, or extension patterns change.

## Module Map

- `src/nodedent/protocol/nodes.ts` contains the endodontic protocol nodes and decision options.
- `src/nodedent/protocol/phases.ts` contains phase ordering and phase-progress rules.
- `src/nodedent/protocol/guards.ts` evaluates structured guard metadata attached to decision options.
- `src/nodedent/protocol/continuation.ts` maps canal status to canal-aware continuation targets.
- `src/nodedent/workflow/` contains generalized workflow definitions, shared module definitions, operative workflow helpers, capability queries, and workflow-launcher registration.
- `src/nodedent/engine/applyDecision.ts` contains the pure decision transition function. It has no React, DOM, localStorage, or browser API dependency.
- `src/nodedent/engine/validateDecision.ts` centralizes required-field and branch-consistency validation.
- `src/nodedent/engine/deriveCanalStatus.ts` and `src/nodedent/engine/deriveCaseStatus.ts` derive workflow status from recorded data and events.
- `src/nodedent/schemas/` contains Zod schemas for case, canal, event, closure, option, guard, and protocol-node data.
- `src/nodedent/notes/` contains compact note, full note, patient summary, JSON export, and event-fragment builders.
- `src/nodedent/components/` renders UI panels and modals. Components should receive state and callbacks rather than duplicating clinical branching logic.
- `src/nodedent/state/persistence.ts` contains storage keys, blank/default case data, canal event hydration, and import normalization.

## Endodontic Protocol Nodes

1. Add the node to `protocol/nodes.ts` with a stable `id`, `phase`, user-facing text, and options.
2. Point each option at an existing `nextNodeId` or add the target node in the same change.
3. Add a `noteEvent.type` when the decision should produce documentation.
4. Add guard metadata for structured numeric or required-field checks when possible.
5. Add an event fragment in `notes/fragments.ts` if the new event should render in notes.
6. Add or update tests for the transition, validation, note output, and status derivation.

## Workflow And Shared Module Changes

1. Prefer existing workflow helpers, event types, capability selectors, and launcher registration patterns in `src/nodedent/workflow/`.
2. Keep workflow-specific treatment targets in their owning workflow. For example, endodontic canals, operative surfaces, and shared anesthesia or isolation scopes should not be collapsed into a generic clinical target unless a spec or ADR defines that mapping.
3. Use event-backed state for durable workflow setup and output. Derived summaries should remain traceable to structured events.
4. Keep shared modules reusable. Diagnosis, radiographs, anesthesia, and isolation may satisfy readiness checks when scope-compatible, but their records should not store workflow-owned treatment details such as operative surfaces or restorative materials.
5. Do not infer clinical guidance from documentation shortcuts, free-text fields, or similarly named capabilities. Capability compatibility must be explicit.
6. Add or update tests for launcher visibility, capability matching, note/export output, and UI routing when a workflow crosses endodontic, operative, or shared-module boundaries.

## Adding A Validation Guard

1. Prefer guard metadata on `DecisionOption.guards` for simple required or numeric comparisons.
2. Add custom guard IDs in `protocol/guards.ts` only when the rule cannot be represented as a required or numeric comparison.
3. Keep UI components out of guard logic. Components should call `getMissingRequirements` and display the returned messages.
4. Add tests that cover allowed and blocked branches.

## Canal-Aware Continuation

Canal continuation is centralized in `protocol/continuation.ts`. The mapping is based on `getCanalStatus`:

- `notStarted` -> `estimate-wl`
- `scouted` -> `open-orifice`
- `wlEstablished` -> `patency-10c`
- `glidePath` -> `gauge-final-shape`
- `shaped` / `disinfected` -> `ready-for-obturation`
- `medicated` / `paused` -> `endodontic-pathway-complete`
- `complete` / `referred` -> disabled continuation

Checkpoint events can override the default mapping when a canal already has a more specific recorded workflow position.

## Verification Commands

Run these before opening or updating a refactor verification PR:

```bash
npm run typecheck
npm run test
npm run build
git diff --check
```

There is no lint script configured at the time of this note.
