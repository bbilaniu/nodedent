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
- Support editable documentation shortcuts for isolation methods, clamp codes, supports, region labels, reason phrases, and note phrases.
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
- clamp codes
- support note phrases
- region labels
- reason phrases
- local abbreviations
- clinic-specific documentation shortcuts

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

Status: mostly implemented as the current `shared.isolation` baseline.

Tasks:

- Verify the current shared workflow events, capability output, invalidation behavior, and coverage summaries.
- Add or extend tests around isolation status derivation if existing coverage is thin.
- Confirm that compromised and removed isolation events do not accidentally leave a matching scope as currently established.
- Confirm that rubber dam, alternative isolation, and replacement all establish `isolation.established` for their recorded scope.
- Confirm that note fragments remain clear when clamp fields or exposed teeth are omitted.

## Phase 2: Isolation Catalog Model

Add a narrow isolation catalog layer using the shared catalog infrastructure.

Tasks:

- Add an `isolationCatalog` model that can return options for method labels, clamp codes, support phrases, region labels, reason phrases, and note phrases.
- Keep typed app-core values separate from seed/user/clinic/template-owned shortcut labels.
- Use editable/free-text fields with suggestions, not closed selects for variable documentation values.
- Snapshot selected or typed labels into event details.
- Add tests for merging seed and user items, route/field-style filtering where relevant, hidden item exclusion, favorite ordering, and label snapshot behavior.

Seed values should be intentionally small and non-prescriptive. If clamp-code seeds are uncertain, start with no seeded clamp-code list and allow user-owned entries first.

## Phase 3: Local User Isolation Catalog Persistence

Add local persistence for user-owned isolation shortcuts only.

Tasks:

- Use a versioned storage key, such as `nodedent.userCatalog.sharedIsolation.v1`.
- Add load/save helpers with schema validation and safe fallback for missing, malformed, or incompatible stored JSON.
- Persist only user-owned catalog items.
- Do not persist app-core or seed items.
- Pass loaded user catalog items into the shared catalog merge/filter layer.
- Preserve editable/free-text behavior.
- Preserve the rule that catalog selections do not infer safety, adequacy, treatment readiness, replacement need, or recommendations.

Deferred from this phase:

- clinic/template storage
- import/export
- sync
- full settings/catalog management UI

## Phase 4: Narrow Isolation Shortcut UI

Add a narrow UI surface for saving and maintaining isolation shortcuts without building the full catalog management workspace.

Tasks:

- Allow entered isolation documentation values to be saved as future shortcuts from the isolation runner.
- Support user-owned edit, hide/unhide, favorite/unfavorite, and delete behavior where the shared catalog model supports it.
- Keep the action language clear that saving a shortcut does not record a clinical event.
- Keep event-recording actions separate from shortcut-management actions.

## Phase 5: Operative Workflow Readiness

Prepare isolation documentation for the next primary workflow area: operative dentistry.

Tasks:

- Ensure isolation scope and summaries can describe teeth and surfaces being treated once the operative dentistry workflow exists.
- Avoid canal-oriented UI assumptions in shared isolation surfaces.
- Keep isolation reusable by endodontic and operative workflows through event-backed capability lookup.
- Record enough structured context for future timeline/history views, including method, broad region, exposed teeth, clamp code, anchor tooth, supports, compromised isolation, replacement, and removal.

This phase should not implement the operative workflow itself. It should only keep the shared isolation module compatible with that future workflow.

## Decisions

- Reuse `shared.isolation`; do not create a new workflow id.
- Treat rubber dam and alternative isolation as valid isolation-establishing documentation events.
- Treat compromised and removed isolation as reassessment/removal events that invalidate matching current isolation status.
- Keep isolation catalogs as documentation shortcuts, not clinical recommendations.
- Keep catalog-backed fields editable/free-text.
- Snapshot selected or typed catalog labels into event details.
- Defer source-backed isolation rules to a separate ADR or active spec.

## Open Decisions

- Whether NodeDent should ship any seeded clamp-code shortcuts or leave clamp codes user/clinic-owned at first.
- Which isolation shortcuts belong in the runner versus a future global catalog settings surface.
- How much operative target context, such as surfaces, should live in shared isolation events versus operative workflow events.
- Whether future isolation summaries need visit identity once multi-visit continuity is modeled.

## Deferred Ideas

- Clinic and template isolation catalogs.
- Import/export and sync for isolation shortcuts.
- Source-backed isolation recommendations or requirements.
- Full global catalog management UI.
- Operative dentistry workflow implementation.
- Timeline/history visualization of isolation changes across visits.
