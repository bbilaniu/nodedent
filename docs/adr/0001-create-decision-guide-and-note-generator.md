# ADR 0001: Create an Endodontic Decision Guide and Note Generator

## Status

Accepted

## Context

NodeDent needs a chairside endodontic workflow tool based on the systematic endodontics protocol. The source protocol is detailed and sequential, but displaying it as a long checklist would make chairside use slower and would not capture the clinical meaning of each decision.

The app also needs to produce useful clinical documentation. If note generation is treated as a separate form filled out after treatment, the clinician must duplicate work and the note can drift from what actually happened.

## Decision

Build the feature as an interactive decision guide plus structured note generator.

The app will model the protocol as data-driven nodes, route through those nodes with a decision engine, show the clinician one relevant decision card at a time, and record structured clinical events as decisions are made. Those events, measurements, canal records, difficulty flags, medication/referral pathways, and closure details will drive the generated note outputs.

Every chairside click should do at least one of the following:

- Advance the clinical state.
- Record a clinically meaningful fact.
- Trigger a safety, difficulty, medication, temporization, or referral pathway.
- Add a structured event to the clinical note.

The app should avoid generic workflow labels such as "Next", "Continue", or "Done" when a clinically meaningful option can be shown instead.

## Rationale

A state-machine model keeps the current clinical action visible without overwhelming the user with the full protocol. Clinically meaningful decision labels improve both chairside guidance and generated notes because the same interaction can record what happened and why the workflow moved forward.

Keeping protocol data, decision logic, UI components, case state, and note generation separate makes the system easier to expand from MVP coverage to the full protocol without rewriting the product.

## Consequences

- Protocol steps should live in data structures such as `src/endo-guide/protocol/nodes.ts`, not as hardcoded branch logic inside React JSX.
- Decision application should remain centralized in the engine layer.
- Case data should remain tooth-based globally and canal-based after access.
- Notes should be generated from structured case/event data, not manually assembled from UI state.
- Future workflow additions should add protocol nodes, event fragments, validation rules, and note behavior together.

## Alternatives Considered

- Static checklist: simpler to build, but poor for branching, difficulty escalation, canal-specific progress, and note generation.
- Standalone note generator form: useful for documentation, but it would not guide treatment and would duplicate chairside data entry.
- Hardcoded React flow: fast for a prototype, but difficult to expand safely as the clinical protocol grows.

## Follow-Up

When adding new clinical pathways, update the protocol nodes, validation rules, event fragments, and note builders as one coherent change.
