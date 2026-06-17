---
status: active
created_on: 2026-06-17
---

# Shared Anesthesia Module

This spec starts the shared anesthesia module after the generalized workflow-node migration. It defines the first reusable model for recording anesthesia status without adding clinical dose recommendations or forcing parent workflows through a linear anesthesia path.

## Goals

- Add a `shared.anesthesia` workflow definition that can run standalone or as an embedded module later.
- Record anesthesia events with workflow context, scope, optional timing, optional agent/dose details, and an explicit adequacy response.
- Emit `anesthesia.adequate` only when adequacy is explicitly recorded or refreshed.
- Support supplemental events, especially top-up and reassessment, without moving the parent workflow away from its current decision card.
- Keep endodontic and operative workflows non-blocking: they may reuse anesthesia status or open the module when needed, but they should not force anesthesia as a hard stop.

## Non-Goals

- Do not recommend anesthetic agents, techniques, doses, vasoconstrictor/adrenaline use, or timing thresholds.
- Do not infer adequacy from administration alone.
- Do not add a full embedded UI runner in the first pass.
- Do not replace clinician judgment about whether anesthesia is required for a given operative or endodontic workflow.

## Event Model

Initial event types:

- `anesthesia.administered`
- `anesthesia.adequacyConfirmed`
- `anesthesia.topUpGiven`
- `anesthesia.needsReassessment`

Initial event details:

- `agentLabel`
- `technique`
- `site`
- `dose`
- `doseUnit`
- `vasoconstrictor`
- `response`
- `notes`
- `reason`

The app may record agent, technique, dose, and response as documentation fields. These fields are not interpreted as clinical recommendations.

## Capability Rules

`anesthesia.adequate` should be scoped to the recorded target, such as tooth, quadrant, sextant, arch segment, or custom scope.

The capability should be emitted by:

- `anesthesia.adequacyConfirmed`
- `anesthesia.topUpGiven` when adequacy is explicitly refreshed

The capability should not be emitted by plain `anesthesia.administered` unless an explicit adequacy response is recorded.

`anesthesia.needsReassessment` should make later selectors report that the relevant scope needs reassessment, even if an earlier adequacy event exists.

## Initial Implementation

- Add `shared.anesthesia` workflow and event vocabulary.
- Add helper functions for event detail parsing, note fragments, scope extraction, and `anesthesia.adequate` capability output.
- Add selector fallback so reassessment events can invalidate the latest matching anesthesia adequacy status.
- Add the module to the workflow launcher registry as `Model only` until a UI runner exists.
- Keep existing endodontic workflow behavior unchanged.

## Open Decisions

- Which anesthesia details should become typed enumerations versus free-text documentation fields.
- How adequacy expiry should be calculated once anesthetic type, dose, vasoconstrictor/adrenaline, timing, and response are modeled.
- Whether the first UI should be a Case Setup & Status panel form, an embedded workflow runner, or both.
