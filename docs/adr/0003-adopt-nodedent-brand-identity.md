# ADR 0003: Adopt NodeDent Brand Identity

## Status

Accepted

## Context

The endodontic chairside guide began as a specific workflow tool, but the product direction is broader: NodeDent should support clinical decision workflows and structured notes across dental domains over time.

The product needs a consistent name, tagline, and visual identity that can support the current endodontic workflow without locking the brand into root canal therapy only.

Detailed visual exploration and logo options are archived in [NodeDent Logo Direction](../specs/archive/nodedent_logo_direction.md).

## Decision

Use **NodeDent** as the display name.

Use **Clinical decision notes for dentistry** as the tagline.

Position NodeDent as a parent dental workflow platform rather than an endodontic-only product. Individual clinical workflows can have their own page titles or module labels, but the platform identity should remain NodeDent.

Use the connected tooth/node mark as the primary logo direction. The mark should communicate dental care, decision support, structured notes, and branching clinical workflows without being too endodontic-specific.

Use the existing NodeDent brand palette as the foundation:

- Deep navy `#0F1E3A` for primary brand presence.
- Mint teal `#2BC4A6` for progress and decision-node accents.
- Slate gray `#64748B` for supporting text.
- Light slate `#F1F5F9` for quiet backgrounds.

## Rationale

`NodeDent` connects the product's two important meanings: decision nodes and dentistry. CamelCase improves readability while keeping the domain-compatible lowercase form `nodedent.com`.

The tagline describes the product category without limiting the platform to endodontics. It can support future workflows such as pulp diagnosis, operative dentistry, caries management, hygiene/perio, extractions, recall, and follow-up.

The connected tooth/node mark is broad enough for a parent platform and still visually tied to dentistry. It is more scalable than a root-canal-specific or highly literal decision-tree mark.

## Consequences

- Product UI, docs, and future marketing copy should use `NodeDent` casing.
- The domain may remain `nodedent.com`.
- Endodontic workflow pages should present themselves as part of NodeDent, not as a separate brand.
- Logo and favicon refinements should preserve the connected tooth/node concept unless a new ADR supersedes this decision.
- Brand visuals should avoid being too endodontic-specific, including overly literal pulp chambers or root canal imagery.
- Detailed design exploration should remain in the archived spec, while this ADR remains the durable decision record.

## Alternatives Considered

- `nodedent`, `NODEDENT`, or `Node Dent`: less readable or less product-like than `NodeDent`.
- Endodontic-specific naming or imagery: clearer for the first workflow, but too narrow for the intended platform.
- NodeDent monogram: compact and app-icon-friendly, but less immediately dental than the connected tooth/node mark.
- Clinical pathway icon: explains decision guidance clearly, but can become visually busier and less suitable as the primary mark.

## Follow-Up

When creating or revising brand assets, use the archived logo direction as the design brief and keep this ADR as the decision source of truth.
