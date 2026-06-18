---
status: implemented
created_on: 2026-06-17
completed_on: 2026-06-18
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
- `routeLabel`
- `agentLabel`
- `technique`
- `applicationType`
- `site`
- `dose`
- `doseUnit`
- `administeredAt`
- `vasoconstrictor`
- `vasoconstrictorDose`
- `response`
- `notes`
- `reason`
- `tooth`
- `teeth`
- `regionLabel`

The app may record route, agent, technique, application type, dose, timing, and response as documentation fields. These fields are not interpreted as clinical recommendations.

`route` should be optional during import and early model-only usage, but the first runner should make it explicit before showing route-specific fields. Initial route labels can stay free-text or narrow enums until the product has enough real workflows to justify a shared catalog.

`response` should distinguish explicit adequacy documentation from other assessment text. An adequacy response is the only response type that can satisfy `anesthesia.adequate`.

Assessment capture should be silent by default. The app should not append a neutral assessment event simply because the user opened the anesthesia panel or recorded administration. It should append an assessment event only when the clinician explicitly records an assessment state, especially adequate or inadequate.

## Phase 1 Typed Values

Initial `route` values:

- `injection`
- `topical`
- `other`

`route` may be absent on legacy imports and early model-only events. New typed UI should require a route before showing route-specific fields.

When `route === "other"`, the UI should provide a free-text route/application field. This keeps the model open for less common routes, including routes that may not be available in the current market.

Initial adequacy `response` values:

- `adequate`
- `partial`
- `notAdequate`
- `notAssessed`

Only `adequate` can satisfy `anesthesia.adequate`. `partial`, `notAdequate`, and `notAssessed` are documentation states and should not satisfy adequacy. `anesthesia.needsReassessment` remains a separate event because it invalidates prior matching adequacy; it should not be collapsed into `response`.

These values are machine values, not user-facing labels. UI copy may render them as `Injection`, `Topical`, `Other`, `Adequate`, `Partial`, `Not adequate`, and `Not assessed`.

## Entry Shape For The First Runner

The first UI should use repeatable local-anesthesia entries rather than a single flat anesthesia form.

An anesthesia entry means one structured administration or top-up event. Each entry action should create one event immediately. Batching multiple entries into a draft list and submitting them together is deferred.

Recommended entry shape:

```ts
type AnesthesiaEntry = {
  route?: string;
  routeLabel?: string;
  agentLabel?: string;
  technique?: string;
  applicationType?: string;
  site?: string;
  dose?: string;
  doseUnit?: string;
  administeredAt?: string;
  vasoconstrictor?: string;
  vasoconstrictorDose?: string;
  response?: string;
  notes?: string;
};
```

Runner behavior:

- Label the route selector area `Local anesthesia route`.
- Default administration capture to `anesthesia.administered`.
- Use `anesthesia.topUpGiven` only when the user explicitly selects a top-up action.
- A future implementation may default to top-up after enough time has elapsed from the most recent injection entry, such as more than 5 minutes, because initial injected doses are typically charted within about a minute of each other. Do not add this heuristic until the UI can make the assumption visible and reversible.
- Prefer separate `Injection` and `Topical` route controls once the UI supports those routes.
- If the first pass uses one `Add entry` action, require a route field before route-specific controls become active.
- Filter option lists by route only to prevent inconsistent documentation. Do not present filtered products, techniques, or dose values as recommendations.
- Keep adequacy confirmation as a separate explicit action or field, even when administration details are complete.
- Do not default assessment to `notAssessed`; absence of an assessment event is enough to represent no explicit assessment.
- Offer a reassessment/top-up path that appends a supplemental event and returns the parent workflow to its current node.

Route-specific visibility means the UI shows only fields that fit the selected route. For example, injection entries can show injection technique and vasoconstrictor fields, while topical entries can show application type. This is an information-architecture rule, not clinical decision support: it should not suggest which route, agent, technique, or dose to use.

## Catalog Shape

The first `anesthesiaCatalog` should follow [ADR 0005: Support Seeded Customizable Clinical Documentation Catalogs](../adr/0005-support-seeded-customizable-documentation-catalogs.md). It is a documentation-suggestion layer, not clinical decision support. Catalog values can speed up charting and prevent mismatched fields, but every catalog-backed field must continue to accept custom text.

Potential long-term catalog ownership options:

- NodeDent core: stable documentation vocabulary, such as route labels, field labels, and non-prescriptive technique/application terms.
- User preferences: clinic-specific products, spelling, abbreviations, favorites, and local note phrasing.
- Template/config layer: organization-managed product catalogs, market availability, localization, and import/export mappings.

For anesthesia, app core may own stable non-prescriptive values such as route values, event types, field names, and broad categories. Product names, brands, systems, agent labels, concentration text, vasoconstrictor/adrenaline phrasing, and clinic-specific shortcuts should be seed/user/clinic/template-owned.

### Seeded Customizable Catalog Decision

The anesthesia catalog is the anesthesia-specific slice of ADR 0005. It may ship seeded documentation suggestions for anesthesia charting, but those suggestions are editable shortcuts rather than clinical recommendations.

Ownership should follow the shared catalog layers:

- `appCore`: stable non-prescriptive anesthesia vocabulary, such as route values, event types, field names, and broad field categories.
- `seed`: starter anesthesia documentation shortcuts shipped by NodeDent.
- `user`: user-owned anesthesia shortcuts, aliases, and favorites.
- `clinic`: clinic-owned anesthetic/product labels, phrasing, and preferred documentation vocabulary.
- `template`: template-owned anesthesia configuration, localization, or import/export mappings.

Catalog-backed anesthesia fields must stay editable/free-text through datalist or autocomplete behavior. Selecting a catalog suggestion must snapshot the selected label/text into the anesthesia event details so historical notes do not depend on live catalog item names.

Seeded anesthesia suggestions must not infer adequacy, dose, timing, expiry, safety, or treatment recommendations. They also must not add automatic dose or amount defaults.

Potential catalog item fields:

- Stable id, user-facing label, route, and target field.
- Optional synonyms, abbreviations, locale labels, and sort/favorite metadata.
- Optional market or clinic availability metadata.
- Optional product metadata, such as active ingredient text, concentration text, vasoconstrictor/adrenaline text, package form, and manufacturer text.
- Optional documentation constraints, such as which route or field can show the value.
- Optional source/owner metadata so user-defined, clinic-defined, and app-defined entries can be audited separately.
- Optional deprecation/replacement metadata for renamed products or templates.

Catalog values must not include dose defaults, timing thresholds, adequacy rules, expiry rules, safety rules, treatment recommendations, or agent recommendations unless those rules are source-backed and documented in a future ADR or active spec. Even then, generated rules should be visible and reversible before they affect an event.

When recording anesthesia events, snapshot selected or typed catalog labels into event details. Historical notes must not depend on live catalog item names.

## Capability Rules

`anesthesia.adequate` should be scoped to the recorded target, such as tooth, quadrant, sextant, arch segment, or custom scope.

The capability should be emitted by:

- `anesthesia.adequacyConfirmed`
- `anesthesia.topUpGiven` only when `details.response === "adequate"`

The capability should not be emitted by plain `anesthesia.administered` unless an explicit adequacy response is recorded.

`anesthesia.needsReassessment` should make later selectors report that the relevant scope needs reassessment, even if an earlier adequacy event exists.

If a top-up is recorded without `response: "adequate"`, the event remains useful documentation but should not satisfy `anesthesia.adequate`.

Phase 2 should not make every `anesthesia.topUpGiven` event a fallback adequacy event by type. It should use a single capability-output helper that checks event type and response. Selectors may still read explicit `capabilitiesSatisfied` records, but fallback derivation should only treat top-up as satisfying when the same helper says it satisfies adequacy.

No automatic adequacy expiry should be calculated from anesthetic type, dose, vasoconstrictor/adrenaline, timing, or response until source-backed timing rules exist. Until then, adequacy remains valid for the matching scope unless a later matching reassessment event invalidates it, or an explicit clinician-entered `expiresAt` is recorded.

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

Status: implemented as route-aware Case Setup & Status entries.
Reasoning level: medium.

- Refine the existing Case Setup & Status anesthesia panel rather than adding the embedded runner.
- Keep the two primary user-facing actions from Phase 3: `Record administration` and `Record assessment`.
- Treat each entry action as one immediate event append; do not build a multi-entry batch editor in Phase 4A.
- Default route-aware administration entries to `anesthesia.administered`; make `anesthesia.topUpGiven` explicit.
- Within `Record administration`, replace the generic route-first form with clearer entry actions:
  - `Injection`
  - `Topical`
  - `Other` only if a non-injection, non-topical route must be documented.
- Show route-specific fields only when they apply:
  - Injection entries: technique, site, agent, dose, dose unit, vasoconstrictor, vasoconstrictor dose, and time administered.
  - Topical entries: application type, site, agent, time administered, and notes.
  - Other entries: free-text route/application/site/notes fields without forcing injection terminology.
- Keep time administered editable and clearable.
- Keep adequacy confirmation separate from administration entry completion.
- Keep assessment silent unless the clinician explicitly records adequate or inadequate.
- Continue appending structured events to the global event ledger.
- Preserve a future path for deep-linking directly to the anesthesia section from the launcher, readiness prompts, or chart-note cleanup workflows.
- Keep broader workspace-shell changes out of Phase 4A. When operative dentistry workflows become usable, revisit the status banner and canal selector so the workspace can show treated teeth and surfaces instead of endodontic-only canal context.

Implemented:

- Replaced the generic route selector with `Injection`, `Topical`, and `Other` controls in the Case Setup & Status anesthesia panel.
- Kept `Record administration` and `Record assessment` as the primary panel modes.
- Kept the default entry type as initial administration and required explicit selection of `Top-up`.
- Showed only route-relevant administration fields for injection, topical, and other entries.
- Added free-text `routeLabel` storage for `other` entries so non-injection and non-topical routes do not have to use injection terminology.
- Kept time administered editable and clearable for injection and topical entries.
- Kept assessment silent until the clinician explicitly selects `Adequate` or `Not adequate`.
- Continued appending one structured anesthesia event per recorded entry or assessment without moving the parent workflow node.

#### Phase 4B: Catalog And Filtering Follow-Up

Status: implemented narrowly as route-scoped documentation suggestions.
Reasoning level: medium-high.

- Add route-specific product and technique option lists only after catalog ownership is decided.
- Filter product and technique option lists by route only to prevent inconsistent documentation, not to recommend clinical choices.
- Decide whether these catalogs belong in NodeDent core, user preferences, or a future template/config layer.
- Keep all catalog choices non-prescriptive and avoid adding clinical dose recommendations.

Phase 4B ownership decision:

- Use a small app-owned interim catalog for documentation vocabulary only.
- Keep product/agent lists empty until source, jurisdiction, and ownership are decided.
- Keep every catalog-backed field free-text through datalist suggestions rather than closed selects.
- Do not add dose defaults, product recommendations, timing rules, or adequacy inference.
- Treat future product and phrase catalogs as seeded customizable documentation catalogs under ADR 0005.

Implemented:

- Added an `anesthesiaCatalog` module with explicit metadata marking it as documentation suggestions only.
- Added route-scoped suggestions for injection technique, injection dose units, vasoconstrictor documentation text, vasoconstrictor dose text, topical application type, and other-route labels.
- Kept agent/product suggestions empty in the interim catalog.
- Added optional datalist suggestions to shared text inputs so clinicians can type custom values.
- Wired route-filtered suggestions into the Case Setup & Status anesthesia panel.
- Added tests for route filtering and non-prescriptive catalog guardrails.

### Phase 5: Embedded Module Runner

Status: implemented as a shared modal shell with module-specific runners.
Reasoning level: high.

- Add an embedded sidecar or modal runner only after the Case Setup & Status form and capability selectors are stable.
- Open the module from parent workflow nodes without forcing anesthesia as a hard stop.
- Return to the parent node after recording supplemental events.
- Preserve parent and child workflow context, including `workflowRunId`, `parentWorkflowRunId`, node ID, and scope.
- Reuse the same event contract as the Case Setup & Status form.

Implementation path:

- Do not force `SharedWorkflowRunnerModal` to become a fully generic form renderer in this phase.
- Keep a shared modal shell and dispatch to module-specific runners by `workflowId`.
- Move the existing isolation-specific runner behavior behind an `IsolationWorkflowRunner`.
- Add an `AnesthesiaWorkflowRunner` that reuses the same anesthesia event contract as Case Setup & Status.
- Extract shared anesthesia form helpers before enabling the embedded runner so Case Setup and the runner cannot drift on route fields, purpose, assessment behavior, or event detail construction.
- Keep module runners responsible for their own clinical form state; keep the shared shell responsible only for launch context, modal framing, and return-to-parent behavior.
- Enable the launcher only after embedded anesthesia events preserve `workflowRunId`, `parentWorkflowRunId`, module node ID, parent node ID, and scoped capability output.

Implemented:

- Replaced the isolation-specific `SharedWorkflowRunnerModal` internals with a shared modal shell that dispatches by `workflowId`.
- Moved existing embedded isolation behavior behind an `IsolationWorkflowRunner`.
- Added an `AnesthesiaWorkflowRunner` for `shared.anesthesia`.
- Extracted shared anesthesia form helpers and a reusable `AnesthesiaEventForm` so Case Setup & Status and the embedded runner share route, purpose, assessment, catalog-suggestion, and event-detail behavior.
- Extended anesthesia event recording to preserve embedded `workflowRunId`, `parentWorkflowRunId`, module node ID, parent node ID, and scoped capability output.
- Enabled the anesthesia module as `Ready` in the launcher.
- Added direct anesthesia launch paths from NodeDent Home and pre-access readiness prompts without moving the parent workflow node.

### Phase 6: Explicit Reassessment And Catalog Refinement

Reasoning level: high.

#### Phase 6A: Explicit Reassessment Time And Seeded Anesthesia Catalog

Status: implemented as explicit clinician-entered `Reassess after` capture and seeded documentation-suggestion metadata.
Reasoning level: medium-high.

- Add optional `expiresAt` / `Reassess after` capture.
- Treat it as clinician-entered documentation only.
- Add seeded anesthesia catalog suggestions as editable documentation shortcuts.
- Do not calculate expiry from agent, dose, vasoconstrictor/adrenaline, technique, route, response, or administered time.
- Do not add automatic dose or amount defaults.
- Snapshot selected catalog labels into event details.
- Add tests that separate explicit reassessment timing from administration timing context.

Implemented:

- Added optional `Reassess after` capture to explicit adequate anesthesia assessment.
- Stored `Reassess after` as top-level event `expiresAt` so existing capability selectors can treat the adequacy capability as needing reassessment after that clinician-entered time.
- Kept `expiresAt` clinician-entered only; no value is calculated from agent, dose, vasoconstrictor/adrenaline, technique, route, response, or administered time.
- Kept dose and amount fields free-text without automatic defaults.
- Marked the anesthesia catalog metadata as seeded documentation suggestions.
- Preserved selected or typed catalog labels in anesthesia event details.
- Added tests for explicit reassessment expiry, non-expiring administration timing, and catalog-label snapshotting.

#### Phase 6B: Source-Backed Rules And Broader Catalogs

Status: partially implemented for shared catalog item/query/merge infrastructure; source-backed timing rules remain deferred.
Reasoning level: high.

- Add automatic timing or expiry rules only after source-backed ADR/spec review.
- If source-backed expiry rules are added, record an explicit `expiresAt` and keep the rule traceable to the source-backed decision.
- Generalize seeded customizable catalogs across burs, files, materials, brands, shades, cements, and other product vocabularies.
- Keep source-backed rules separate from seed/user/clinic/template documentation shortcuts.
- Add tests that separate explicit reassessment, source-backed expiry, and non-rule catalog fields.

Implemented catalog infrastructure:

- Added a shared catalog item model with `appCore`, `seed`, `user`, `clinic`, and `template` owner layers.
- Added catalog applicability metadata for route and field filtering.
- Added shared catalog merge, filter, alias, favorite, active/hidden, and sort-order helpers.
- Converted the anesthesia catalog from route-specific string arrays to seeded catalog items consumed through the shared helper layer.
- Preserved the existing anesthesia form behavior and free-text datalist suggestions.
- Added tests for owner precedence, route/field filtering, active/hidden overrides, aliases, favorites, sort order, and non-prescriptive anesthesia guardrails.

Deferred:

- Clinic/template catalog storage and management UI.
- Import/export or synchronization of user/clinic/template catalog layers.
- Source-backed timing or expiry rules.

#### Phase 6C: Local User Catalog Persistence For Anesthesia

Status: implemented narrowly for local user-owned anesthesia catalog storage.
Reasoning level: medium.

- Add localStorage persistence for user-owned anesthesia catalog items only.
- Use the versioned storage key `nodedent.userCatalog.sharedAnesthesia.v1`.
- Add load/save helpers with validation and safe fallback when stored JSON is missing, malformed, or incompatible.
- Persist only `user`-owned anesthesia catalog items; do not persist `appCore`, `seed`, `clinic`, or `template` items in this phase.
- Pass loaded user catalog items into the shared catalog merge/filter layer used by `getAnesthesiaCatalogOptions`.
- Preserve free-text datalist behavior for catalog-backed fields.
- Preserve non-prescriptive behavior: catalog selections must not infer adequacy, dose, timing, expiry, safety, or treatment recommendations.
- Preserve selected catalog labels as snapshotted anesthesia event detail text.

Implemented:

- Added versioned local user anesthesia catalog load/save helpers.
- Added validation that accepts only `owner: "user"` and `category: "anesthesia"` items with valid route/field applicability.
- Added safe fallback for missing, malformed, or incompatible stored data.
- Wired loaded user anesthesia catalog items into Case Setup and embedded anesthesia runner suggestions.
- Added tests for missing storage, malformed storage, valid user items, seed/user merging, route-filtered options, hidden/inactive exclusion, favorite/sort order, and non-prescriptive product-selection behavior.

Deferred:

- Catalog management UI.
- Clinic/template catalog storage.
- Import/export.
- Sync.
- Source-backed expiry or timing rules.
- Dose or amount defaults.

#### Phase 6D: Catalog Management UI

Status: implemented narrowly in Case Setup for user-owned anesthesia shortcuts.
Reasoning level: medium-high.

- Add UI for adding, hiding, favoriting, sorting, and editing user-owned catalog items.
- Keep every catalog-backed field editable/free-text.
- Keep source-backed rules and clinical recommendations out of catalog management.

Implemented:

- Added a compact anesthesia shortcut manager inside the Case Setup anesthesia section.
- Supports route and field selection for anesthesia shortcut context.
- Supports adding user-owned anesthesia shortcuts.
- Supports saving shortcut values directly from a filled administration entry without recording an event.
- Supports favoriting and hiding catalog rows through user-owned overrides, including seed-item overrides.
- Supports editing and deleting user-owned shortcuts.
- Explains that favorites appear first in the selected field's suggestions.
- Persists changes through the Phase 6C local user anesthesia catalog storage helper.
- Keeps seed catalog entries read-only; user changes are stored as user-owned entries or overrides.
- Preserves free-text datalist entry behavior and non-prescriptive catalog behavior.
- Saves only route-appropriate catalog-backed fields from entries:
  - Injection: agent, technique, dose unit, vasoconstrictor, and vasoconstrictor dose.
  - Topical: agent and application type.
  - Other: route label and application type.
- Does not save dose amount, administered time, response, reassessment time, notes, teeth, or region as shortcuts.

Deferred:

- Full settings screen or global catalog management workspace.
- Editing clinic/template catalog layers.
- Import/export or sync of catalogs.
- Source-backed timing, expiry, safety, or treatment recommendation rules.

Cross-module catalog boundary:

- Keep narrow shortcut management contextual to anesthesia capture UI, such as Case Setup & Status and the embedded anesthesia runner.
- Keep event-recording actions separate from shortcut-management actions.
- Defer bulk catalog editing, import/export, sync, clinic/template ownership, and global catalog management to a later settings/catalog workspace shared across modules.

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
- Explicit `expiresAt` / `Reassess after` documentation may be captured only as clinician-entered event detail unless source-backed expiry rules are approved later.
- Catalog ownership is resolved conceptually by ADR 0005: `appCore` owns stable non-prescriptive vocabulary, while product names, brands, systems, agent labels, phrases, aliases, and favorites belong to `seed`, `user`, `clinic`, or `template` catalogs.
- The first UI should be a Case Setup & Status panel form. An embedded runner can follow after the event contract and selectors are stable.
- Case Setup & Status and the embedded anesthesia runner should share form helpers and the reusable `AnesthesiaEventForm` so event construction does not drift.
- Post-administration assessment should remain event-detail text initially. Add separate event types beyond adequacy and reassessment only when they affect status, alerts, follow-up, or note generation.
- Do not add an anesthesia-specific visit identity model. Keep anesthesia events compatible with a future `visitId` or case/visit model.
- Treat prior-visit anesthesia as historical context unless a future same-visit/current-visit model explicitly marks it reusable.
- Keep operative treatment intent, surfaces, restorative materials, shades, bonding/cementation details, and restoration targets out of shared anesthesia events; future operative workflows should compare their treatment targets against scoped anesthesia status instead of making anesthesia own operative target data.

## Open Decisions

- Whether additional route or adequacy-response values are needed after the first typed UI is tested.
