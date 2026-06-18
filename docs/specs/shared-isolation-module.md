---
status: active
created_on: 2026-06-18
---

# Shared Isolation Module

This spec defines the next shared-module slice after anesthesia: a reusable isolation documentation module with catalog-backed shortcuts. It starts from the existing `shared.isolation` workflow instead of introducing a new workflow identity.

The goal is to make isolation documentation faster and more reusable across endodontic and future operative workflows without turning isolation methods, clamp codes, or local phrasing into clinical recommendations.

## Goals

- Preserve the existing `shared.isolation` workflow, event vocabulary, scoped capability output, and reassessment behavior.
- Add an isolation-specific catalog shape that follows [ADR 0005: Support Seeded Customizable Clinical Documentation Catalogs](../adr/0005-support-seeded-customizable-documentation-catalogs.md).
- Support editable documentation shortcuts for isolation methods, user- or clinic-owned clamp codes, supports, region labels, reason phrases, and note phrases.
- Keep rubber dam, split dam, cotton roll, Isovac, and other isolation documentation available without implying one method is recommended.
- Keep isolation status reusable by parent workflows through event-backed `isolation.established` capability output.
- Prepare isolation scope and summaries for future operative dentistry workflows that treat teeth and surfaces, not canals.

## Non-Goals

- Do not recommend isolation method, clamp selection, support technique, or operative workflow sequencing.
- Do not infer safety, adequacy, treatment readiness, or clinical quality from a catalog value.
- Do not force every workflow through rubber dam when alternative isolation has been explicitly documented.
- Do not build clinic/template catalog storage, import/export, sync, or full catalog management UI in the first pass.
- Do not implement the operative dentistry workflow or its teeth/surfaces treatment-target UI in this spec.
- Do not add source-backed isolation rules unless they are covered by a separate ADR or active spec.

## Current Implementation Baseline

`shared.isolation` already exists as a shared workflow module.

Current workflow identity:

- workflow id: `shared.isolation`
- workflow version: `0.1.0`
- supported scopes: `tooth`, `quadrant`, `sextant`, `archSegment`, and `custom`

Current event types:

- `isolation.rubberDamPlaced`
- `isolation.alternativeIsolationUsed`
- `isolation.compromised`
- `isolation.removed`
- `isolation.replaced`

Current typed method values:

- `rubberDam`
- `splitDam`
- `cottonRoll`
- `isovac`
- `other`

Current region values:

- `quadrant`
- `sextant`
- `archSegment`
- `custom`

Current event details:

- `method`
- `regionKind`
- `regionLabel`
- `exposedTeeth`
- `supports`
- `clampCode`
- `clampTooth`
- `notes`
- `reason`

These details describe isolation coverage and documentation context only. Shared isolation events should not store operative treatment intent, surfaces, restorative materials, shades, bonding/cementation details, or restoration targets.

Current support details:

```ts
type IsolationSupport = {
  type: "clamp" | "wedge" | "ligature" | "other";
  tooth?: string;
  clampCode?: string;
  notes?: string;
};
```

The current implementation also includes note-fragment formatting, scope extraction, coverage summaries, and `isolation.established` capability derivation. This spec should refine that implementation rather than replace it.

## Event Model

The existing event model remains the source of record.

Isolation-establishing events:

- `isolation.rubberDamPlaced`
- `isolation.alternativeIsolationUsed`
- `isolation.replaced`

Isolation-invalidating events:

- `isolation.compromised`
- `isolation.removed`

`isolation.compromised` should mean the previous matching isolation status needs reassessment. `isolation.removed` should mean the prior matching isolation status is no longer current. Parent workflows may decide whether they require current isolation before allowing a step, but the shared module itself should only record and summarize the event-backed status.

`isolation.replaced` should establish a new current isolation state for the recorded scope.

## Capability Rules

`isolation.established` should be scoped to the recorded target, such as a tooth, quadrant, sextant, arch segment, exposed teeth list, or custom region.

The capability should be emitted by:

- `isolation.rubberDamPlaced`
- `isolation.alternativeIsolationUsed`
- `isolation.replaced`

The capability should be invalidated by later matching:

- `isolation.compromised`
- `isolation.removed`

Catalog values must not affect capability output. For example, selecting a clamp code, support shortcut, or method label should not infer quality, safety, adequacy, or whether a parent workflow should proceed.

## Catalog Shape

The isolation catalog should follow ADR 0005. It is a documentation-suggestion layer, not clinical decision support.

For isolation, app core may own stable non-prescriptive values such as:

- event types
- method values
- support type values
- region kind values
- field names
- capability identifiers

Seed, user, clinic, and template catalogs should own variable documentation values such as:

- user-facing method labels
- support note phrases
- region labels
- reason phrases
- local abbreviations
- clinic-specific documentation shortcuts

Clamp-code shortcuts are variable documentation values, but the first isolation catalog pass should not ship app-owned seeded clamp-code shortcuts. Clamp codes should start as user-owned or clinic-owned shortcuts because they are product/clinician-specific and could be misread as clamp-selection guidance. Seed values should be limited to non-prescriptive documentation vocabulary such as method labels, support types, reason phrases, and note phrases.

Catalog-backed isolation fields must remain editable/free-text through datalist or autocomplete behavior. Selecting a suggestion must snapshot the selected label or typed text into the isolation event details so historical notes do not depend on live catalog item names.

Seeded isolation suggestions must not infer method choice, safety, adequacy, timing, replacement need, operative readiness, or treatment recommendations.

Potential catalog item fields:

- stable id
- owner: `appCore`, `seed`, `user`, `clinic`, or `template`
- category, such as `method`, `clampCode`, `support`, `regionLabel`, `reason`, or `note`
- user-facing label
- optional aliases and abbreviations
- optional method, support type, or field applicability
- optional active/hidden state
- optional favorite state
- optional sort order
- optional source/version metadata

## Phase 1: Baseline Audit And Tests

Status: implemented as the current `shared.isolation` baseline with focused selector and note-fragment tests.
Reasoning level: low.

Tasks:

- Verify the current shared workflow events, capability output, invalidation behavior, and coverage summaries.
- Add or extend tests around isolation status derivation if existing coverage is thin.
- Confirm that compromised and removed isolation events do not accidentally leave a matching scope as currently established.
- Confirm that rubber dam, alternative isolation, and replacement all establish `isolation.established` for their recorded scope.
- Confirm that note fragments remain clear when clamp fields or exposed teeth are omitted.

Implemented:

- Verified the existing `shared.isolation` workflow identity, event vocabulary, supported scopes, completion nodes, event details, capability output, and coverage summary behavior.
- Added focused tests for rubber dam isolation coverage by exposed tooth, unrelated-tooth non-matching, compromised isolation invalidation, removal invalidation, and replacement re-establishment.
- Added focused tests confirming alternative isolation establishes `isolation.established` for the recorded region.
- Added note-fragment coverage for rubber dam, compromised, removed, replaced, and alternative isolation events, including cases where optional clamp fields or exposed teeth are omitted.

## Phase 2: Isolation Catalog Model

Status: implemented as a narrow shared catalog model with non-prescriptive seed suggestions and user-owned clamp-code support.
Reasoning level: medium.

Add a narrow isolation catalog layer using the shared catalog infrastructure.

Tasks:

- Add an `isolationCatalog` model that can return options for method labels, clamp codes, support phrases, region labels, reason phrases, and note phrases.
- Keep typed app-core values separate from seed/user/clinic/template-owned shortcut labels.
- Use editable/free-text fields with suggestions, not closed selects for variable documentation values.
- Snapshot selected or typed labels into event details.
- Add tests for merging seed and user items, route/field-style filtering where relevant, hidden item exclusion, favorite ordering, and label snapshot behavior.

Seed values should be intentionally small and non-prescriptive. Do not seed clamp-code shortcuts in the first isolation catalog pass; allow user-owned entries first and leave clinic-owned clamp-code shortcuts for the later clinic catalog layer.

Implemented:

- Added `src/endo-guide/workflow/isolationCatalog.ts` as the narrow isolation catalog model.
- Added `isolationCatalogFields` and `IsolationCatalogField` for `methodLabels`, `supportTypes`, `supportPhrases`, `regionLabels`, `reasons`, `notes`, and `clampCodes`.
- Added seeded non-prescriptive suggestions for method labels, support types, support phrases, region labels, reason phrases, and note phrases.
- Kept seeded clamp-code suggestions empty; clamp-code shortcuts are supported only through user/custom catalog items in this phase.
- Added `createUserIsolationCatalogItem`, `createUserIsolationCatalogOverride`, `getIsolationCatalogItems`, and `getIsolationCatalogOptions`.
- Reused the shared catalog merge/filter/label helpers for owner precedence, active/hidden filtering, favorite ordering, sort order, aliases, and field applicability.
- Added tests for non-prescriptive catalog metadata, no seeded clamp codes, user-owned clamp-code entries, seed hiding/favoriting through user overrides, alias inclusion, and event label snapshot behavior.

## Phase 3: Local User Isolation Catalog Persistence

Status: implemented narrowly for local user-owned isolation catalog storage.
Reasoning level: medium.

Add local persistence for user-owned isolation shortcuts only.

Tasks:

- Use a versioned storage key, such as `nodedent.userCatalog.sharedIsolation.v1`.
- Add load/save helpers with schema validation and safe fallback for missing, malformed, or incompatible stored JSON.
- Persist only user-owned catalog items.
- Do not persist app-core or seed items.
- Pass loaded user catalog items into the shared catalog merge/filter layer.
- Preserve editable/free-text behavior.
- Preserve the rule that catalog selections do not infer safety, adequacy, treatment readiness, replacement need, or recommendations.

Implemented:

- Added `src/endo-guide/state/isolationCatalogPersistence.ts`.
- Added the versioned local storage key `nodedent.userCatalog.sharedIsolation.v1`.
- Added `loadUserIsolationCatalogItems` and `saveUserIsolationCatalogItems` with safe fallback for missing storage, malformed JSON, and incompatible payload versions.
- Added validation that persists only `owner: "user"` and `category: "isolation"` catalog items.
- Added validation that accepts only isolation catalog fields and rejects route-scoped items, app-core/seed/clinic/template-owned items, and wrong-category items.
- Preserved user-owned seed overrides, including active/hidden and favorite metadata.
- Added tests for missing storage, malformed storage, incompatible versions, valid user items, invalid item exclusion, seed/user merging, hidden item exclusion, favorite ordering, and the rule that catalog selections do not establish isolation capability.

Deferred from this phase:

- clinic/template storage
- import/export
- sync
- full settings/catalog management UI

## Phase 4: Narrow Isolation Shortcut UI

Status: implemented narrowly in Case Setup and the embedded isolation runner for user-owned isolation shortcuts.
Reasoning level: medium-high.

Add a narrow UI surface for saving and maintaining isolation shortcuts without building the full catalog management workspace.

Tasks:

- Allow entered isolation documentation values to be saved as future shortcuts from the isolation runner.
- Support user-owned edit, hide/unhide, favorite/unfavorite, and delete behavior where the shared catalog model supports it.
- Keep the action language clear that saving a shortcut does not record a clinical event.
- Keep event-recording actions separate from shortcut-management actions.
- Defer bulk catalog editing, import/export, sync, clinic/template ownership, and global catalog management to a later settings/catalog workspace.

Implemented:

- Loaded user-owned isolation catalog items at the app root and persisted updates through `nodedent.userCatalog.sharedIsolation.v1`.
- Passed user isolation catalog items into Case Setup & Status and the embedded isolation workflow runner.
- Added datalist suggestions for isolation region labels, clamp codes, reason phrases, and note phrases.
- Added contextual `Save shortcuts` actions in both isolation capture surfaces. Saving shortcuts updates the user catalog only and does not record a clinical event.
- Added a compact isolation shortcut manager in Case Setup & Status for field-specific add, favorite/unfavorite, hide/unhide, edit, delete, and seed-override reset behavior.
- Kept shortcut management local to user-owned isolation catalog items. Clinic/template storage, global settings, import/export, and sync remain deferred.
- Added tests for shortcut item extraction from isolation forms, including note versus reason field routing and exclusion of blank values.

## Phase 5: Operative Workflow Readiness

Status: implemented as selector compatibility and test coverage for operative surface targets.
Reasoning level: high.

Prepare isolation documentation for the next primary workflow area: operative dentistry.

Tasks:

- Ensure isolation scope and summaries describe coverage in terms that future operative workflows can compare against treated teeth and surfaces.
- Record isolation coverage, not operative treatment intent. Shared isolation events should capture method, region kind, region label, exposed teeth, clamp tooth, clamp code, supports, reason, and notes.
- Keep surfaces, materials, shades, bonding/cementation details, and restoration targets in the future operative dentistry workflow.
- Allow future operative selectors to compare operative treatment targets against current isolation coverage without making isolation own operative surfaces.
- Avoid canal-oriented UI assumptions in shared isolation surfaces.
- Keep isolation reusable by endodontic and operative workflows through event-backed capability lookup.
- Record enough structured context for future timeline/history views, including method, broad region, exposed teeth, clamp code, anchor tooth, supports, compromised isolation, replacement, and removal.

This phase should not implement the operative workflow itself. It should only keep the shared isolation module compatible with that future workflow.

Implemented:

- Updated capability scope matching so shared context and coverage capabilities can satisfy an operative surface query when the recorded event covers the same tooth without owning surface-level treatment data.
- Kept final restoration output stricter: tooth-scoped or canal-scoped restoration capability does not satisfy a surface-scoped operative restoration query.
- Added tests confirming exposed-tooth isolation coverage satisfies an operative surface target on the same tooth.
- Added tests confirming unrelated operative surface targets are not satisfied and matching compromised isolation invalidates the surface-target readiness check.
- Confirmed isolation event details remain coverage-only and do not store operative surfaces.

## Decisions

- Reuse `shared.isolation`; do not create a new workflow id.
- Treat rubber dam and alternative isolation as valid isolation-establishing documentation events.
- Treat compromised and removed isolation as reassessment/removal events that invalidate matching current isolation status.
- Keep isolation catalogs as documentation shortcuts, not clinical recommendations.
- Keep catalog-backed fields editable/free-text.
- Snapshot selected or typed catalog labels into event details.
- Defer source-backed isolation rules to a separate ADR or active spec.
- Do not ship app-owned seeded clamp-code shortcuts in the first isolation catalog pass.
- Allow narrow contextual shortcut actions in the isolation runner, such as save-as-shortcut, favorite/unfavorite, hide/unhide, and delete for user-owned items.
- Defer bulk catalog editing, import/export, sync, clinic/template ownership, and global catalog management to a later settings/catalog workspace.
- Keep event-recording actions separate from shortcut-management actions.
- Record isolation coverage in shared isolation events; do not store operative treatment intent, surfaces, materials, shades, bonding/cementation details, or restoration targets there.
- Do not add an isolation-specific visit identity model now.
- Keep isolation events compatible with a future `visitId` or case/visit model.
- Treat prior-visit isolation as historical context unless a future same-visit/current-visit model explicitly marks it reusable.

## Deferred Ideas

- Clinic and template isolation catalogs.
- Import/export and sync for isolation shortcuts.
- Source-backed isolation recommendations or requirements.
- Full global catalog management UI.
- Operative dentistry workflow implementation.
- Timeline/history visualization of isolation changes across visits.
