# ADR 0005: Support Seeded Customizable Clinical Documentation Catalogs

## Status

Proposed

## Context

NodeDent is beginning to model shared clinical modules, including anesthesia and isolation, and will later need operative, restorative, endodontic file, material, brand, shade, cement, and other product vocabularies.

Some catalog values are stable app vocabulary. Examples include event types, field names, route kinds, and broad material classes. Other values are product names, brands, systems, clinic phrases, shortcuts, favorites, and local documentation habits. Those values vary by user, clinic, geography, supplier, and time.

The app can ship starter values to make documentation faster, but those values must not become hidden clinical recommendations or hard-coded product defaults. Catalog-backed documentation also needs to remain historically stable: a note generated from an event should not change because a catalog item is renamed, hidden, or deleted later.

## Decision

NodeDent will support seeded customizable clinical documentation catalogs across clinical modules.

NodeDent may ship starter or seed catalog values based on common or developer-used documentation values. Seed values are editable documentation shortcuts, not clinical recommendations.

Users or clinics must eventually be able to customize product and documentation vocabularies, including anesthetics, burs, endodontic files, filling materials, brands, shades, cements, systems, and similar product vocabularies.

The architecture must separate app-core vocabulary from seed, user, clinic, and template catalogs. Canonical catalog owner layers are:

- `appCore`: stable non-prescriptive vocabulary owned by the application.
- `seed`: starter documentation shortcuts shipped by NodeDent.
- `user`: user-owned documentation shortcuts and favorites.
- `clinic`: clinic-owned documentation shortcuts, product lists, and phrasing.
- `template`: template-owned configuration or import/export vocabulary.

`appCore` may own stable non-prescriptive vocabulary, such as:

- routes
- field names
- event types
- material classes
- workflow or capability identifiers

`seed`, `user`, `clinic`, or `template` catalogs should own variable documentation values, such as:

- product names
- brands
- systems
- shades
- clinic-specific phrasing
- abbreviations and aliases
- favorites and sort order

Catalog-backed fields must remain editable free-text fields through datalist/autocomplete behavior unless a future ADR explicitly justifies a closed vocabulary.

New clinical documentation fields should prefer free text with optional suggestions until real records show stable repeated values worth structuring. For example, operative restoration outcome should remain free text in the first direct restoration workflow; a small enum or catalog can be introduced later if the vocabulary proves stable and useful.

Product or catalog selections must not infer:

- adequacy
- dose
- timing
- expiry
- safety
- treatment recommendations

Product selection must not add automatic dose or amount defaults. If amount conveniences are later added, they must be treated as user-entered favorites that are visible and reversible, not clinical defaults.

When recording an event, NodeDent must snapshot the selected label or typed text into event details so historical notes do not change if catalog items are renamed, hidden, deleted, or re-owned.

Catalog metadata should support:

- owner, using `appCore`, `seed`, `user`, `clinic`, or `template`
- category
- route and field applicability
- aliases
- active or hidden status
- favorite status
- sort order
- optional source or version

## Rationale

This preserves the speed benefits of catalogs without turning documentation shortcuts into decision support. It also keeps NodeDent usable before clinic-specific configuration exists, while leaving a path for user and clinic ownership of local vocabularies.

Separating stable app vocabulary from variable product catalogs reduces migration risk. Routes, field names, event types, and material classes can stay stable in code, while products and clinic phrases can evolve without changing the event model.

Snapshotting event details protects historical notes and audit behavior. The clinical event is the source of record for what was documented at the time, not a live pointer to a mutable catalog item.

## Consequences

- Catalog-backed fields should use free-text inputs with suggestions by default.
- New enums should be added only when they improve documentation, querying, or interoperability enough to justify the closed vocabulary.
- Product catalogs should not be used to calculate anesthesia adequacy, expiry, dose, amount, timing, or treatment recommendations.
- Current seed catalogs can stay intentionally small and non-prescriptive.
- Future catalog storage should distinguish app-core values from seed, user, clinic, and template-owned values.
- Event detail builders must continue writing the selected or typed label/text into event details.
- If a future feature needs rule-based behavior from catalog selection, that behavior requires a separate source-backed ADR or active spec.

## Alternatives Considered

- Hard-code product lists in app core: faster initially, but it makes local product variation and clinic preferences difficult to maintain.
- Avoid seed values entirely: safer from a recommendation perspective, but slower for users and less useful for repetitive documentation.
- Use closed selects for product values: cleaner data, but too rigid for real clinical documentation and unavailable products.
- Store event references to catalog item ids only: easier to normalize, but historical notes could change when catalog values are edited.

## Follow-Up

- Update shared module specs to reference this ADR when adding or refining catalogs.
- Keep the implemented shared anesthesia catalog work in `docs/specs/archive/shared-anesthesia-module.md` non-prescriptive unless a separate source-backed decision is documented.
- Design future catalog persistence around owner, category, applicability, aliases, active/favorite status, sort order, and source/version metadata.
