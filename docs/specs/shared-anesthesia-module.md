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
- Do not copy sibling-project product defaults into NodeDent as clinical recommendations.
- Do not infer adequacy from administration alone.
- Do not add a full embedded UI runner in the first pass.
- Do not replace clinician judgment about whether anesthesia is required for a given operative or endodontic workflow.

## Cross-Project Inputs

This spec was checked against `pulp-app` and `perionote` examples for workflow and documentation patterns only. NodeDent's event ledger, active specs, ADRs, and clinical source material remain authoritative.

Useful patterns from those projects:

- Use `Local anesthesia entries` language rather than injection-only language so topical, injected, and future routes are not forced into the wrong charting shape.
- Store route per entry instead of using one section-wide route, because a visit may include more than one anesthesia route.
- Show route-specific fields only when relevant. For example, injection technique belongs to injected entries, while application type belongs to topical entries.
- Keep product catalogs and amount defaults separate from clinical decision support. Catalog filtering can prevent mismatched documentation fields, but it should not imply what should be used.
- Keep time administered editable and clearable. It is documentation context, not an automatic adequacy rule.
- When anesthesia activity is recorded, make post-administration assessment explicit instead of assuming adequacy or absence of adverse reaction.

## Event Model

Initial event types:

- `anesthesia.administered`
- `anesthesia.adequacyConfirmed`
- `anesthesia.topUpGiven`
- `anesthesia.needsReassessment`

Initial event details:

- `route`
- `agentLabel`
- `technique`
- `applicationType`
- `site`
- `dose`
- `doseUnit`
- `administeredAt`
- `vasoconstrictor`
- `response`
- `notes`
- `reason`
- `tooth`
- `teeth`
- `regionLabel`

The app may record route, agent, technique, application type, dose, timing, and response as documentation fields. These fields are not interpreted as clinical recommendations.

`route` should be optional during import and early model-only usage, but the first runner should make it explicit before showing route-specific fields. Initial route labels can stay free-text or narrow enums until the product has enough real workflows to justify a shared catalog.

`response` should distinguish explicit adequacy documentation from other assessment text. An adequacy response is the only response type that can satisfy `anesthesia.adequate`.

## Entry Shape For The First Runner

The first UI should use repeatable local-anesthesia entries rather than a single flat anesthesia form.

Recommended entry shape:

```ts
type AnesthesiaEntry = {
  route?: string;
  agentLabel?: string;
  technique?: string;
  applicationType?: string;
  site?: string;
  dose?: string;
  doseUnit?: string;
  administeredAt?: string;
  vasoconstrictor?: string;
  response?: string;
  notes?: string;
};
```

Runner behavior:

- Label the area `Local anesthesia entries`.
- Prefer separate `Add injection entry` and `Add topical entry` actions once the UI supports those routes.
- If the first pass uses one `Add entry` action, require a route field before route-specific controls become active.
- Filter option lists by route only to prevent inconsistent documentation. Do not present filtered products, techniques, or dose values as recommendations.
- Keep adequacy confirmation as a separate explicit action or field, even when administration details are complete.
- Offer a reassessment/top-up path that appends a supplemental event and returns the parent workflow to its current node.

## Capability Rules

`anesthesia.adequate` should be scoped to the recorded target, such as tooth, quadrant, sextant, arch segment, or custom scope.

The capability should be emitted by:

- `anesthesia.adequacyConfirmed`
- `anesthesia.topUpGiven` when adequacy is explicitly refreshed

The capability should not be emitted by plain `anesthesia.administered` unless an explicit adequacy response is recorded.

`anesthesia.needsReassessment` should make later selectors report that the relevant scope needs reassessment, even if an earlier adequacy event exists.

If a top-up is recorded without a refreshed adequacy response, the event remains useful documentation but should not satisfy `anesthesia.adequate`.

## Initial Implementation

- Add `shared.anesthesia` workflow and event vocabulary.
- Add helper functions for event detail parsing, note fragments, scope extraction, and `anesthesia.adequate` capability output.
- Add selector fallback so reassessment events can invalidate the latest matching anesthesia adequacy status.
- Add the module to the workflow launcher registry as `Model only` until a UI runner exists.
- Keep existing endodontic workflow behavior unchanged.

## Later Runner Acceptance Criteria

- Users can record multiple local-anesthesia entries for the same visit.
- Injected and topical entries can coexist without forcing topical entries through injection terminology.
- Route-specific fields are hidden or inactive when they do not apply.
- Administration alone does not mark anesthesia adequate.
- Adequacy can be confirmed only through an explicit response or explicit adequacy event.
- Top-up without refreshed adequacy does not satisfy `anesthesia.adequate`.
- Reassessment invalidates the latest matching adequacy status for the same scope.
- Generated note fragments distinguish administration, adequacy confirmation, top-up, and reassessment events.
- Tests cover route-aware entry parsing, capability emission, top-up without adequacy, top-up with refreshed adequacy, and reassessment invalidation.

## Open Decisions

- Which anesthesia details should become typed enumerations versus free-text documentation fields.
- How adequacy expiry should be calculated once anesthetic type, dose, vasoconstrictor/adrenaline, timing, and response are modeled.
- Whether the first UI should be a Case Setup & Status panel form, an embedded workflow runner, or both.
- Whether post-administration assessment should remain event-detail text or become separate event types beyond adequacy and reassessment.
