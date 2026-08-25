---
status: implemented
created_on: 2026-08-23
completed_on: 2026-08-23
---

# Clinical Catalogue Management

## Goal

Create one discoverable, patient-independent catalogue workspace for reusable
clinical documentation values, then use endodontic sealer products as the first
new catalogue category delivered through it.

The workspace should let a user understand which values are application seeds
and which are locally saved preferences; add, edit, favorite, order, hide,
restore, and delete values where ownership permits; and import or export local
catalogue preferences without confusing preference management with recording
clinical care.

This spec turned the catalogue direction in [ADR 0005](../../adr/0005-support-seeded-customizable-documentation-catalogs.md)
and the remaining catalogue work in the [NodeDent long-term product roadmap](../nodedent-long-term-product-roadmap.md)
into an implementation plan. It also responds to the shared-module
usability feedback in issue 88: a clinical `Record ...` action and a
patient-independent catalogue action must not look like alternative ways to
save the same entry.

## Current State

NodeDent already has important catalogue foundations:

- a generic `CatalogItem` model with `appCore`, `seed`, `user`, `clinic`, and
  `template` owner layers;
- merge, query, active/hidden, favorite, alias, and ordering helpers;
- seeded anesthesia and isolation catalogue definitions;
- one browser-local user-catalogue store with migration from the earlier
  anesthesia and isolation storage keys;
- validated, additive catalogue export/import;
- catalogue-backed free-text suggestions in anesthesia and isolation forms;
- contextual `Save shortcuts` actions; and
- compact anesthesia and isolation manager components that support adding,
  editing, hiding, favoriting, deleting, and resetting seed overrides.

The current product surface is incomplete and internally inconsistent:

- `CatalogAdministrationPanel` is embedded in the Saved Cases modal even
  though catalogue preferences are not case data;
- that panel only imports and exports anesthesia and isolation preferences;
- `AnesthesiaCatalogManager` and `IsolationCatalogManager` exist but are not
  reachable from the current application;
- user-catalogue validation explicitly accepts only `anesthesia` and
  `isolation` categories;
- import-preview category counts are hard-coded to those two categories;
- there is no global catalogue navigation entry or full-page manager; and
- the endodontic workflow records only a generic bioceramic sealer description,
  not the product used.

The archived anesthesia and isolation specs remain implementation history, not
the owner of this cross-module workspace. This active spec supersedes their
deferred global-management work while preserving their event and catalogue
safety boundaries.

## Design Input From HygieneNote

The companion HygieneNote repository is useful design input, especially its
`lib/catalogues/catalogue.ts`, `components/catalogues/CatalogueManager.tsx`,
`components/catalogues/CatalogueProvider.tsx`, accessible catalogue comboboxes,
and catalogue browser tests. Useful patterns include:

- a registry of stable catalogue definitions rather than manager-local field
  lists;
- grouping definitions into human-readable sections;
- tabs for related catalogues with item counts and keyboard navigation;
- ownership-aware rows that distinguish starter suggestions from values saved
  in the current browser;
- explicit actions for adding or remembering values;
- editing, favoriting, ordering, hiding, unhiding, and deletion;
- storage error and recovery states;
- validated import preview before applying an import; and
- accessible editable comboboxes that still accept unlisted text.

NodeDent should adapt those interaction patterns, not copy HygieneNote's schema
or clinical metadata. In particular, NodeDent must not copy:

- product-linked amount, dose, duration, timing, or expiry defaults;
- provider-default behavior for clinical products;
- template lifecycle coupling;
- a schema that omits NodeDent's future `clinic` and `template` ownership
  layers; or
- replace-import behavior without a separate, explicit destructive
  confirmation design.

HygieneNote and NodeDent have different persistence and clinical-event models.
NodeDent's existing `CatalogItem` model and event ledger remain authoritative.

## Principles

- Catalogues are a documentation-suggestion layer, not a treatment-selection
  engine or validation whitelist.
- Every catalogue-backed clinical field remains editable free text.
- Typing a value does not silently add it to a reusable catalogue.
- Recording a clinical event does not silently save its fields as reusable
  preferences.
- Saving a reusable preference does not record a clinical event.
- Product selection must not infer adequacy, dose, quantity, timing, expiry,
  safety, suitability, outcome, or a treatment recommendation.
- Historical documentation snapshots the selected or typed label; it does not
  depend on a mutable live catalogue item.
- Catalogue storage must remain patient-independent and separate from the
  encrypted clinical vault.
- Seed values are application-distributed starter suggestions, not defaults or
  recommendations.
- Seed entries are immutable. Local preferences may hide, favorite, or reorder
  them through user-owned overrides.
- The same action and ownership language should be used across modules.
- Catalogue interactions must meet the active
  [Accessible interaction](../accessible-interaction.md) and
  [GUI consistency](../gui-consistency-and-design-system.md) specs.

## Goals

- Add a first-class Catalogue workspace reachable from NodeDent Home.
- Centralize catalogue definition metadata and validation.
- Restore and consolidate the currently unreachable anesthesia and isolation
  management capabilities.
- Move catalogue import/export out of case management.
- Make catalogue categories extensible without adding category-specific
  conditionals to the shared persistence layer.
- Add an endodontic sealer catalogue and record the sealer used in the
  endodontic workflow.
- Preserve existing anesthesia and isolation user preferences through a
  versioned migration.
- Keep old saved cases and imports valid when they contain no sealer field.
- Make record-versus-preference actions unmistakable in shared modules and
  endodontic forms.

## Non-Goals

- Clinic-shared or cloud-synchronized catalogue storage.
- Editing `clinic` or `template` catalogue layers in the first implementation.
- Remote product lookup or automatic product-list updates.
- Inventory, stock, lot, expiry-date, or purchasing management.
- Barcode scanning.
- Automatic learning from completed notes, event history, pasted text, or
  general form input.
- Automatic selection of a favorite product in a clinical field.
- Clinical rules derived from commercial product or material-class metadata.
- Replacing stable enums, protocol choices, event types, workflow identifiers,
  or other logic-bearing application vocabulary with editable catalogue text.
- Correcting historical clinical events through catalogue editing.

## Terminology

### Catalogue definition

A catalogue definition describes one allowlisted suggestion set and its UI
placement. It is application-owned configuration, not persisted preference
data.

Examples include:

- injection anesthetic agents;
- topical anesthetic agents;
- isolation clamp codes; and
- endodontic sealers.

### Catalogue item

A catalogue item is a reusable label plus ownership and applicability
metadata. A catalogue item may be a distributed seed or a local user value.

### Catalogue preference

A user-created item or a user-owned override of a seed. Preferences are stored
outside the clinical vault and may contain clinic-specific product or phrase
information, but must not contain patient information.

### Event snapshot

The text copied into a clinical event when care is recorded. Renaming, hiding,
or deleting the originating catalogue item must not change this text.

## Catalogue Definition Registry

Introduce one typed registry consumed by the global manager, persistence
validation, suggestion queries, import previews, and contextual catalogue
actions. Do not keep separate allowlists in manager components and the storage
normalizer.

A definition should contain at least:

```ts
type CatalogueDefinition = {
  key: string;
  section: "Shared modules" | "Endodontics" | "Operative" | "Other";
  title: string;
  description: string;
  fieldLabels: string[];
  category: string;
  field: string;
  route?: string;
  allowsCustomText: true;
  seedItems: CatalogItem[];
};
```

The exact TypeScript name may remain `CatalogDefinition` if the implementation
continues using American spelling internally. User-facing text and this spec
use `Catalogue` consistently.

Definition keys must be stable and unique. Suggested initial keys are:

- `anesthesia.injection.agents`
- `anesthesia.injection.techniques`
- `anesthesia.injection.dose-units`
- `anesthesia.injection.vasoconstrictors`
- `anesthesia.injection.vasoconstrictor-doses`
- `anesthesia.topical.agents`
- `anesthesia.topical.application-types`
- `anesthesia.other.route-labels`
- `anesthesia.other.application-types`
- `isolation.method-labels`
- `isolation.support-types`
- `isolation.support-phrases`
- `isolation.region-labels`
- `isolation.reasons`
- `isolation.notes`
- `isolation.clamp-codes`
- `endodontic.sealers`

The registry may map those stable keys onto the existing `category`,
`appliesTo.route`, and `appliesTo.field` representation. Adding the registry
does not require rewriting existing item identifiers or persisted items.

Registry validation must prove:

- definition keys are unique;
- every seed ID is unique;
- seed item category, route, and field match its definition;
- all definitions permit custom text;
- no patient-specific field is registered;
- persisted user items refer to a registered category/field/route combination;
  and
- unknown definitions are rejected during import with a clear message rather
  than silently discarded.

## Ownership And Item Behavior

The existing conceptual owner layers remain:

- `appCore`: stable, logic-bearing vocabulary; not managed as suggestions;
- `seed`: distributed starter suggestions;
- `user`: browser-local preferences and seed overrides;
- `clinic`: reserved for later clinic-owned storage; and
- `template`: reserved for later imported/configured template ownership.

The first global page manages `seed` and `user` behavior only. It must not show
empty clinic/template controls that imply those layers are already persisted or
shared.

Seed rows:

- display `Starter suggestion`;
- cannot have their label edited or be deleted;
- can be favorited or unfavorited;
- can be hidden or restored;
- can be reordered within their favorite/non-favorite group; and
- store those changes as user-owned overrides without mutating the shipped
  seed definition.

User rows:

- display `Saved in this browser`;
- can be edited;
- can be favorited or unfavorited;
- can be hidden or restored;
- can be reordered; and
- can be permanently deleted after explicit confirmation.

Deleting or hiding any item affects future suggestions only. Existing case
fields, clinical events, generated notes, and exported case data do not change.

Equivalent labels should be detected after trimming, Unicode normalization,
and case-insensitive comparison. An explicit remember/add action should return
one of these outcomes:

- `added`;
- `already exists`; or
- `restored` when an equivalent hidden value is reactivated.

Do not create a second item merely because a user entered a different case or
Unicode representation of the same visible label.

## Global Catalogue Workspace

### Navigation

Add a `Catalogue` action to NodeDent Home or the persistent application
navigation. It opens a full-page workspace and does not require an active
clinical workflow.

The Catalogue workspace must not be nested inside Saved Cases. The Saved Cases
surface may temporarily provide a link to the new workspace during migration,
but it should no longer render catalogue import/export controls after the new
workspace is available.

### Page structure

The page should include:

1. A heading and concise explanation that catalogue values are
   patient-independent suggestions saved in the current browser profile.
2. Visible storage state: loading, ready, saving, saved, invalid, unavailable,
   or failed as applicable.
3. Sections derived from the definition registry.
4. Tabs or another accessible disclosure pattern for related definitions.
5. Per-tab item counts, including hidden values when the manager is showing
   them.
6. A definition panel with its title, applicable form fields, and an add-local-
   value action.
7. Ownership-aware item rows.
8. Import/export controls.
9. A separated destructive reset control with confirmation.
10. A clear return route to NodeDent Home.

Initial section organization:

```text
Shared modules
  Anesthesia
    Injection
    Topical
    Other
  Isolation
    Placement vocabulary
    Support and clamp vocabulary
    Reassessment and note phrases

Endodontics
  Materials
    Root canal sealers
```

Sections and tabs must be generated from registry data rather than hard-coded
category branches in the page component. Small presentation group metadata may
be maintained beside the registry when multiple definition keys belong to one
tab set.

### Item row actions

Rows should expose only actions that apply to their owner and current state:

- `Save` and `Cancel` while editing a user item;
- `Favorite` or `Unfavorite`;
- `Move up` and `Move down`;
- `Hide` or `Show`;
- `Delete` for user items; and
- `Reset` when a user override exists for a seed.

Actions must use visible text or accessible names and must not rely on icon,
color, hover, or position alone. Destructive actions remain visually separated
from routine ordering and preference actions.

### Defaults

Favorites affect suggestion ordering only. The initial page must not provide
`Set default` for anesthetics, sealers, or other clinical products. A favorite
must not silently prefill a clinical field.

If a future workflow needs a default, it requires a field-specific decision
that documents why prefilling is safe, visible, and reversible. HygieneNote's
provider-default feature is not a precedent for clinical-product defaults in
NodeDent.

## Contextual Clinical-Form Behavior

Catalogue-backed fields should use an accessible editable combobox or
equivalent control that supports:

- selecting a visible suggestion;
- typing an unlisted value;
- keyboard navigation;
- a visible selected/focused state;
- ownership text such as `Starter` or `Local` when suggestions are shown;
- favorite-first ordering;
- hidden-item exclusion;
- returning focus correctly after a contextual hide action; and
- operation when the catalogue store is unavailable.

The current native-datalist-backed `TextInput` may remain as an incremental
fallback, but it cannot be the final rich-management interaction because native
datalists cannot consistently expose ownership, favorite, or hide actions.

Remembering a custom value must require a separate action such as
`Add to Catalogue` or `Remember this value`. It must not happen on blur,
clinical event recording, form close, note generation, or autosave.

Clinical forms must use distinct action language:

- `Record anesthesia administration to current visit`
- `Record isolation placement to current visit`
- `Record radiograph review to current visit`
- `Record sealer application`
- `Add entered values to Catalogue`
- `Manage Catalogue`

Avoid the generic `Save shortcuts` label once the global workspace is
implemented. When a form has unrecorded clinical fields, closing the form should
not imply that adding those values to the Catalogue recorded the clinical
entry.

## Endodontic Sealer Catalogue

### Definition

Add this definition to the registry:

```ts
{
  key: "endodontic.sealers",
  section: "Endodontics",
  title: "Root canal sealers",
  description: "Patient-independent product labels used to document root canal sealer application.",
  fieldLabels: ["Sealer used"],
  category: "endodontic",
  field: "sealers",
  allowsCustomText: true,
}
```

Product names belong to the `seed`, `user`, `clinic`, or `template` layers, not
`appCore`. The broad concept `root canal sealer` may be application-owned, but
the commercial products remain variable documentation vocabulary.

### Initial seed candidates

The initial clinician-supplied seed candidates are:

1. `Kerr® Sealapex™ (Calcium Hydroxide Root Canal Sealer)`
2. `Kerr® Pulp Canal Sealer (Zinc Oxide Eugenol Root Canal Sealer)`
3. `Angelus® MTA Fillapex® (Mineral Trioxide Aggregate Root Canal Sealer)`

Suggested stable seed IDs:

- `endodontic.sealers.kerr-sealapex`
- `endodontic.sealers.kerr-pulp-canal-sealer`
- `endodontic.sealers.angelus-mta-fillapex`

Before a production release, verify the current manufacturer spelling,
trademark presentation, material-class description, and source/version. Record
that provenance through the existing catalogue `source` and `version` fields.
If verification is not complete, preserve these entries as clinician-supplied
candidates in this spec rather than representing them as independently
verified product data.

The seed list must remain small and editable through user additions. It must not
be presented as exhaustive, preferred, ranked by clinical value, or appropriate
for every case.

### Workflow capture

Add a catalogue-backed `Sealer used` field to the active canal at the
`apply-sealer` step. The value is scoped to the active canal because sealer
application events are canal-scoped and different products must remain
representable even if most cases use one product throughout.

Recommended model names:

- `CanalRecord.sealerLabel` for the current working value;
- `EndodonticFieldId` value `sealerLabel`; and
- event detail `sealerLabel` on `sealer.applied` and `sealer.reapplied`.

The positive `sealer.applied` action should require a nonblank `sealerLabel` so
the product used is actually documented. The unsafe/cannot-place branch must
not require a product selection because it records that application could not
be completed safely.

Selection behavior:

- show seed and local suggestions;
- allow any custom text;
- do not select a favorite automatically;
- do not infer material suitability or change the protocol path;
- do not add amount, dose, technique, or timing defaults;
- do not silently copy a product from another canal; and
- if a carry-forward convenience is added later, make it an explicit action
  such as `Use previous canal's sealer`.

When `sealer.applied` is recorded, snapshot the visible label directly into the
event details. The existing canal snapshot may retain the same value for
compatibility, but note generation and structured export should prefer the
explicit event detail. `sealer.reapplied` should snapshot or carry the same
label explicitly rather than resolving it from the live catalogue later.

Generated output should include the product:

```text
MB: Kerr® Sealapex™ (Calcium Hydroxide Root Canal Sealer) applied with passive White NaviTip withdrawal.
```

Renaming, hiding, or deleting the corresponding catalogue preference must not
change this output for an existing event.

Older saved cases, JSON imports, and events without `sealerLabel` remain valid
and continue to render the existing generic bioceramic-sealer note text. Do not
fabricate a product during migration.

## Persistence And Migration

### Storage boundary

Catalogue preferences remain browser-local, patient-independent data outside
the encrypted clinical vault. They remain separate between Current, Beta, and
Sandbox origins unless a user explicitly exports and imports them.

Catalogue exports may reveal clinic product lists, staff shortcuts, or internal
phrasing. Export and import must remain explicit user actions with clear local-
file disclosure even though the format must reject patient-specific fields by
design.

### Versioning

Do not silently widen the current v1 category allowlist while continuing to
claim an unchanged persistence contract. Introduce a versioned migration that:

- reads the existing unified v1 anesthesia/isolation state;
- validates and preserves every accepted v1 item and seed override;
- writes the new registry-validated state;
- adds support for `endodontic.sealers`;
- remains idempotent; and
- fails visibly rather than overwriting invalid stored data.

The implementation may call the new state `StoredUserCatalogStateV2` and bump
the catalogue export format version to 2. It must continue to accept valid v1
exports and preview their migration. A v2 export containing endodontic values
must never be silently truncated by a parser that knows only the v1 allowlist.

### Import behavior

The first global workspace should preserve NodeDent's current conflict-safe,
additive import behavior:

- preview the file before applying it;
- count items dynamically by registered definition or category;
- identify additions, equivalents, and ID conflicts;
- add only new IDs;
- leave equivalent and conflicting local IDs unchanged; and
- report the result in an accessible live region.

Replace import is deferred. If added later, it must be separately labeled,
explain which local preferences and overrides will be displaced, and require
explicit destructive confirmation. Import must never alter clinical cases or
events.

### Reset behavior

`Reset local Catalogue` removes browser-local user items and seed overrides and
returns suggestions to the shipped seed state. It must:

- require confirmation;
- state that the operation cannot be undone unless the user has an export;
- state that existing cases and clinical events will not change; and
- report storage failure without claiming success.

## Privacy And Security Boundary

Only explicitly registered patient-independent fields may write catalogue
preferences. Catalogue actions must not accept or intentionally store:

- patient names or identifiers;
- chart numbers;
- dates of birth or contact information;
- tooth-specific findings tied to a patient;
- measurements from an encounter;
- diagnosis or prognosis narrative;
- event notes that contain patient context; or
- any other one-patient or one-appointment text.

The UI must explain this boundary near add/remember actions. Catalogue contents
must not be sent to analytics, telemetry, error reports, URLs, or remote APIs.
Future clinic sharing, accounts, or synchronization require a separate ADR and
privacy/security review.

## Accessibility And Interaction Requirements

- Related definitions may use tabs only when the complete tab/tabpanel pattern
  is implemented.
- Arrow keys, Home, and End navigate tabs according to the accessible tab
  pattern.
- Switching tabs must not discard unsaved text in another panel without
  warning.
- Editable comboboxes must expose an accessible label, expanded state, active
  option, and keyboard selection behavior.
- Status and ownership must be conveyed by text, not color alone.
- Every icon-only action needs an accessible name and visible tooltip where the
  GUI spec calls for one.
- Focus returns predictably after hiding or deleting an item.
- Import, add, edit, delete, reset, saving, saved, and failure results use
  appropriate live regions without excessive announcements.
- Destructive confirmations identify the exact item or local catalogue scope.
- The page remains usable at 200% zoom and at phone, tablet, laptop, and wide
  desktop widths.
- Touch targets and focus indicators follow the active accessibility and GUI
  specs.

## Implementation Sequence

### Phase 1: Registry And Persistence

- Add the typed catalogue-definition registry.
- Derive persistence validation and import counts from it.
- Add the versioned v1-to-v2 migration and v1 import compatibility.
- Register existing anesthesia and isolation definitions without changing
  their visible suggestion behavior.
- Add unit tests for registry uniqueness, validation, migration, merging,
  ordering, and unknown-definition rejection.

### Phase 2: Global Catalogue Workspace

- Add the NodeDent Home/navigation entry.
- Build the full-page section and tab structure.
- Consolidate the existing anesthesia and isolation manager behaviors into
  shared definition/item components.
- Move import/export out of Saved Cases.
- Add storage recovery and reset surfaces.
- Remove or replace the now-redundant unreachable manager components.

### Phase 3: Contextual Catalogue Actions

- Standardize `Add to Catalogue` and `Manage Catalogue` actions.
- Keep those actions separate from clinical `Record ...` actions.
- Replace `Save shortcuts` wording.
- Introduce or incrementally adopt the accessible editable catalogue combobox.
- Preserve custom text and graceful operation without catalogue storage.

### Phase 4: Endodontic Sealer Slice

- Register `endodontic.sealers` and its verified seeds.
- Add `sealerLabel` to canal working state and contextual inputs.
- Require it only for the positive sealer-application action.
- Snapshot it in sealer application and reapplication events.
- Include it in full note and structured export output.
- Preserve legacy generic output when no label exists.
- Add scenario and migration coverage.
- Regenerate protocol documentation if the workflow graph or required-input
  output changes.

### Phase 5: Cleanup And Evidence

- Remove hard-coded anesthesia/isolation import copy and counts.
- Confirm there are no unreachable module-specific managers.
- Record responsive, keyboard, dark-mode, and import/export evidence.
- Update the long-term roadmap to remove completed global-management and sealer
  items.
- Review ADR 0005's `Proposed` status against the delivered architecture.

## Validation

### Model and persistence

- All definition keys and seed IDs are unique.
- Existing anesthesia and isolation preferences migrate without change.
- Migration is idempotent.
- Invalid and unknown definitions are rejected without overwriting local data.
- Favorite, hidden, ordering, edit, delete, and seed-reset behavior survives a
  reload.
- v1 imports remain supported.
- v2 export/import round-trips endodontic sealer preferences.
- Import preview counts all registered categories dynamically.
- Additive import never overwrites an existing conflicting ID.

### Management UI

- The Catalogue workspace is reachable without opening Saved Cases.
- Sections, tabs, counts, empty states, and ownership labels are correct.
- User values can be added, edited, hidden, shown, favorited, reordered, and
  deleted.
- Seed values can be hidden, restored, favorited, reordered, and reset but not
  edited or deleted.
- Storage errors prevent mutation and remain recoverable through a validated
  import or confirmed reset.
- Keyboard, focus, zoom, touch, responsive, dark-mode, and live-region behavior
  is verified.

### Clinical integration

- Catalogue suggestions never prevent custom text entry.
- Adding a preference does not append a clinical event.
- Recording a clinical event does not add a preference.
- Catalogue selection does not change capability output or protocol routing.
- Anesthesia and isolation suggestions remain clinically equivalent after the
  manager migration.
- The three verified sealer seeds appear in the endodontic sealer suggestions.
- A custom sealer can be typed and recorded without first saving it.
- Positive sealer application is blocked until a sealer label is entered.
- The unsafe sealer branch remains available without a sealer label.
- Sealer application and reapplication events snapshot the selected or typed
  label.
- Renaming, hiding, or deleting a catalogue item does not change existing note
  or export output.
- Legacy events without a label retain the generic note fragment.

### Repository verification

- `npm test`
- `npm run build`
- `npm run docs:check`
- `npm run docs:workflow-graph` after workflow/protocol graph changes

## Acceptance Criteria

- NodeDent has one discoverable, full-page Catalogue workspace.
- Catalogue management is no longer embedded in Saved Cases.
- The page is driven by a typed definition registry rather than duplicated
  category conditionals.
- Existing anesthesia and isolation preferences survive migration.
- Seed and user ownership are clearly distinguishable.
- User and seed-override lifecycle actions behave consistently.
- Clinical record actions and catalogue preference actions are visually and
  semantically distinct.
- Catalogue-backed fields remain editable free text.
- The initial endodontic sealer catalogue includes the three verified products
  listed in this spec and permits unlisted products.
- The recorded sealer label is snapshotted into clinical history and notes.
- Catalogue edits never rewrite historical documentation.
- No catalogue value produces clinical guidance, defaults, or capability
  output.
- Accessibility, persistence, import/export, migration, responsive, and note
  behavior have automated and manual evidence.

## Deferred Work

- Clinic-owned and template-owned persistence and editing.
- Cross-device or clinic-workspace synchronization.
- Remote product sources or automatic catalogue updates.
- Inventory, lot, expiry, supplier, cost, or stock metadata.
- Defaults for clinical products.
- Replace import.
- Rules or recommendations derived from catalogue metadata.
- Broader endodontic catalogues for files, burs, gutta-percha, irrigants,
  medicaments, temporary materials, and restorative materials; these should be
  added through the same registry only when their workflow fields and
  documentation boundaries are specified.

## Completion

Archive this spec only after the global Catalogue workspace, registry-driven
validation, persistence migration, relocated import/export, standardized
contextual actions, and endodontic sealer slice are implemented and verified.
At completion, update ADR 0005's status if its decision has been formally
accepted and update the long-term roadmap so it no longer lists delivered work
as outstanding.
