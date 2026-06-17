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
- Do not automatically expire anesthesia adequacy until source-backed timing rules exist.
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

## Phase 1 Typed Values

Initial `route` values:

- `injection`
- `topical`
- `other`

`route` may be absent on legacy imports and early model-only events. New typed UI should require a route before showing route-specific fields.

Initial adequacy `response` values:

- `adequate`
- `partial`
- `notAdequate`
- `notAssessed`

Only `adequate` can satisfy `anesthesia.adequate`. `partial`, `notAdequate`, and `notAssessed` are documentation states and should not satisfy adequacy. `anesthesia.needsReassessment` remains a separate event because it invalidates prior matching adequacy; it should not be collapsed into `response`.

These values are machine values, not user-facing labels. UI copy may render them as `Injection`, `Topical`, `Other`, `Adequate`, `Partial`, `Not adequate`, and `Not assessed`.

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
- `anesthesia.topUpGiven` only when `details.response === "adequate"`

The capability should not be emitted by plain `anesthesia.administered` unless an explicit adequacy response is recorded.

`anesthesia.needsReassessment` should make later selectors report that the relevant scope needs reassessment, even if an earlier adequacy event exists.

If a top-up is recorded without `response: "adequate"`, the event remains useful documentation but should not satisfy `anesthesia.adequate`.

Phase 2 should not make every `anesthesia.topUpGiven` event a fallback adequacy event by type. It should use a single capability-output helper that checks event type and response. Selectors may still read explicit `capabilitiesSatisfied` records, but fallback derivation should only treat top-up as satisfying when the same helper says it satisfies adequacy.

No automatic adequacy expiry should be calculated from anesthetic type, dose, vasoconstrictor/adrenaline, timing, or response until source-backed timing rules exist. Until then, adequacy remains valid for the matching scope unless a later matching reassessment event invalidates it, or a future explicit `expiresAt` is recorded from a source-backed rule.

## Initial Implementation

- Add `shared.anesthesia` workflow and event vocabulary.
- Add helper functions for event detail parsing, note fragments, scope extraction, and `anesthesia.adequate` capability output.
- Add selector fallback so reassessment events can invalidate the latest matching anesthesia adequacy status.
- Add the module to the workflow launcher registry as `Model only` until a UI runner exists.
- Keep existing endodontic workflow behavior unchanged.

## Implementation Plan

Reasoning levels:

- Low: mostly mechanical implementation from existing NodeDent patterns.
- Medium: requires cross-module design judgment, but should be implementable without settling major product decisions.
- High: requires careful architecture or clinical workflow reasoning before implementation.

### Phase 1: Model Contract And Tests

Status: implemented as typed model contract and focused test coverage.
Reasoning level: medium.

- Keep the typed core small: event types, `route`, scope, and explicit adequacy response.
- Keep `agentLabel`, `technique`, `applicationType`, `site`, `dose`, `doseUnit`, `vasoconstrictor`, `notes`, and `reason` as free text or catalog-backed strings.
- Add or update tests for event detail parsing, scope extraction, route preservation, and note fragment output.
- Confirm legacy events without `route` still import and summarize safely.
- Do not add UI, product catalogs, or route-specific option filtering in Phase 1.

Implemented:

- Added typed `anesthesiaRoutes` values for `injection`, `topical`, and `other`.
- Added typed `anesthesiaAdequacyResponses` values for `adequate`, `partial`, `notAdequate`, and `notAssessed`.
- Added route and adequacy-response type guards, including a helper for the satisfying `adequate` response.
- Extended anesthesia event detail parsing for `route`, `applicationType`, `administeredAt`, and typed `response`.
- Preserved legacy event compatibility when route or response values are absent or not in the Phase 1 typed vocabulary.
- Included route, application type, and administered time in anesthesia note context when those values are present.
- Added focused tests for typed values, parser behavior, custom scope extraction, legacy event handling, and note fragments.

### Phase 2: Capability Semantics

Status: implemented as guarded adequacy capability fallback and tests.
Reasoning level: medium.

- Emit `anesthesia.adequate` from `anesthesia.adequacyConfirmed`.
- Emit `anesthesia.adequate` from `anesthesia.topUpGiven` only when `details.response === "adequate"`.
- Do not emit adequacy from administration-only events.
- Add a single helper for anesthesia adequacy capability output so event generation, fallback selectors, and tests do not drift.
- Ensure `anesthesia.needsReassessment` invalidates the latest matching adequacy status for the same scope.
- Add tests for administration-only, adequacy confirmed, top-up without refreshed adequacy, top-up with refreshed adequacy, and reassessment invalidation.
- Preserve no-automatic-expiry behavior unless an explicit `expiresAt` is already present.

Implemented:

- Added a guarded anesthesia adequacy capability-output helper.
- Kept `anesthesia.adequacyConfirmed` as an adequacy-satisfying event.
- Made `anesthesia.topUpGiven` satisfy `anesthesia.adequate` only when `details.response === "adequate"`.
- Kept administration-only events from satisfying adequacy.
- Updated fallback selectors to use the guarded helper instead of treating every top-up event as adequate by type.
- Preserved explicit `capabilitiesSatisfied` handling for imported or already-materialized capability records.
- Preserved reassessment invalidation for the latest matching scope.
- Added tests for administration-only events, adequacy confirmation, partial top-up, adequate top-up, and reassessment invalidation.

### Phase 3: Case Setup And Status Form

Status: implemented as non-blocking Case Setup & Status anesthesia capture.
Reasoning level: medium.

- Add the first anesthesia UI as a Case Setup & Status panel form rather than a full embedded runner.
- Show the current derived anesthesia status for the active tooth/scope.
- Split the UI into administration capture and assessment capture without leaving the current parent workflow node.
- Append structured events instead of overwriting prior anesthesia history.
- Keep endodontic workflow progression non-blocking.

Implemented:

- Added an Anesthesia section to Case Setup & Status.
- Shows derived anesthesia capability status and the latest anesthesia event when present.
- Uses two user-facing actions: `Record administration` and `Record assessment`.
- Administration records initial administration or top-up using the same detail fields.
- Assessment records adequate, partial, not adequate, or needs-reassessment outcomes without requiring anesthesia detail fields.
- Appends anesthesia events to the global event ledger with `shared.anesthesia` workflow context and active-tooth scope.
- Uses the guarded Phase 2 capability helper so assessment with `response: "adequate"` can satisfy `anesthesia.adequate`.
- Keeps administration-only, top-up-only, and non-adequate assessment events from satisfying adequacy.
- Keeps the active endodontic decision-card position unchanged.

### Phase 4: Route-Aware Local Anesthesia Entries

Reasoning level: medium.

#### Phase 4A: Route-Aware Case Setup Entries

Reasoning level: medium.

- Refine the existing Case Setup & Status anesthesia panel rather than adding the embedded runner.
- Keep the two primary user-facing actions from Phase 3: `Record administration` and `Record assessment`.
- Within `Record administration`, replace the generic route-first form with clearer entry actions:
  - `Add injection entry`
  - `Add topical entry`
  - `Add other entry` only if a non-injection, non-topical route must be documented.
- Show route-specific fields only when they apply:
  - Injection entries: technique, site, agent, dose, dose unit, vasoconstrictor, and time administered.
  - Topical entries: application type, site, agent, time administered, and notes.
  - Other entries: generic route/application/site/notes fields without forcing injection terminology.
- Keep time administered editable and clearable.
- Keep adequacy confirmation separate from administration entry completion.
- Continue appending structured events to the global event ledger.

#### Phase 4B: Catalog And Filtering Follow-Up

Reasoning level: medium-high.

- Add route-specific product and technique option lists only after catalog ownership is decided.
- Filter product and technique option lists by route only to prevent inconsistent documentation, not to recommend clinical choices.
- Decide whether these catalogs belong in NodeDent core, user preferences, or a future template/config layer.
- Keep all catalog choices non-prescriptive and avoid adding clinical dose recommendations.

### Phase 5: Embedded Module Runner

Reasoning level: high.

- Add an embedded sidecar or modal runner only after the Case Setup & Status form and capability selectors are stable.
- Open the module from parent workflow nodes without forcing anesthesia as a hard stop.
- Return to the parent node after recording supplemental events.
- Preserve parent and child workflow context, including `workflowRunId`, `parentWorkflowRunId`, node ID, and scope.
- Reuse the same event contract as the Case Setup & Status form.

### Phase 6: Source-Backed Expiry And Catalog Refinement

Reasoning level: high.

- Add automatic expiry only after source-backed timing rules are documented in active specs or ADRs.
- Decide whether agent, vasoconstrictor/adrenaline, technique, and dose should become typed catalogs based on real product needs and source material.
- If expiry rules are added, record an explicit `expiresAt` and keep the rule traceable to the source-backed decision.
- Add tests that separate explicit reassessment, explicit expiry, and administration timing context.

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

## Decisions

- Typed core now: event types, `route`, scope, and adequacy response. Other anesthesia details stay free text or catalog-backed strings until product needs justify typed enums.
- No automatic expiry until source-backed timing rules exist.
- The first UI should be a Case Setup & Status panel form. An embedded runner can follow after the event contract and selectors are stable.
- Post-administration assessment should remain event-detail text initially. Add separate event types beyond adequacy and reassessment only when they affect status, alerts, follow-up, or note generation.

## Open Decisions

- Whether additional route or adequacy-response values are needed after the first typed UI is tested.
- Whether route-specific product catalogs belong in NodeDent core, user preferences, or a future template/config layer.
- Whether the Case Setup & Status form and future embedded runner should share a single component or use separate wrappers around shared event helpers.
