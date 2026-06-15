---
status: implemented
created_on: 2026-06-09
completed_on: 2026-06-15
---

# NodeDent Logo Direction

Archived status: implemented. The durable brand identity decision is captured in [ADR 0003: Adopt NodeDent Brand Identity](../../adr/0003-adopt-nodedent-brand-identity.md). This file remains as detailed exploration and design brief context.

## Brand name

**NodeDent**

Use **NodeDent** as the display name rather than `nodedent`, `NODEDENT`, or `Node Dent`.

Rationale:

- **Node** communicates decision nodes, branching logic, and clinical workflow structure.
- **Dent** anchors the product clearly in dentistry.
- CamelCase makes the name easier to read and gives it a product-brand feel.
- The domain can remain lowercase as `nodedent.com`.

## Tagline

**Clinical decision notes for dentistry**

This tagline keeps the brand broad enough for future workflows beyond root canal therapy, including pulp diagnosis, operative dentistry, caries management, hygiene/perio, extractions, recall, and follow-up.

---

# Visual Style

## Overall direction

NodeDent should feel like a **parent clinical workflow platform**, not only an endodontic or root canal app.

The logo should communicate:

- Dental care
- Decision support
- Structured notes
- Branching clinical workflows
- Modularity and future expansion

It should avoid being too endodontic-specific.

## Suggested palette

Use a clinical, modern palette consistent with the current app UI.

The primary logo lockup in `public/nodedent_connected_tooth_logo_lockup.png` presents these brand palette tokens:

| Use | Hex | RGB | HSL | CMYK |
| --- | --- | --- | --- | --- |
| Deep Navy / primary | `#0F1E3A` | `rgb(15, 30, 58)` | `hsl(219, 59%, 14%)` | `74%, 48%, 0%, 77%` |
| Mint Teal / accent | `#2BC4A6` | `rgb(43, 196, 166)` | `hsl(168, 64%, 47%)` | `78%, 0%, 15%, 23%` |
| Slate Gray / supporting | `#64748B` | `rgb(100, 116, 139)` | `hsl(215, 16%, 47%)` | `28%, 17%, 0%, 45%` |
| Light Slate / background | `#F1F5F9` | `rgb(241, 245, 249)` | `hsl(210, 40%, 96%)` | `3%, 2%, 0%, 2%` |

Optional extension colors can be introduced if the product needs additional UI states, supporting illustrations, or secondary brand accents:

| Use | Hex | RGB | HSL | CMYK |
| --- | --- | --- | --- | --- |
| Light Blue gradient start / blue-300 | `#93C5FD` | `rgb(147, 197, 253)` | `hsl(212, 96%, 78%)` | `42%, 22%, 0%, 1%` |
| Light Blue gradient end / blue-400 | `#60A5FA` | `rgb(96, 165, 250)` | `hsl(213, 94%, 68%)` | `62%, 34%, 0%, 2%` |

The SVG reference artwork also uses these exact construction colors for gradients, highlights, and inverted variants:

| Use | Hex | RGB | HSL | CMYK |
| --- | --- | --- | --- | --- |
| Navy gradient start | `#061A43` | `rgb(6, 26, 67)` | `hsl(220, 84%, 14%)` | `91%, 61%, 0%, 74%` |
| Navy gradient end / line color / shadow color | `#0F1E3A` | `rgb(15, 30, 58)` | `hsl(219, 59%, 14%)` | `74%, 48%, 0%, 77%` |
| Mint gradient start | `#2BC4A6` | `rgb(43, 196, 166)` | `hsl(168, 64%, 47%)` | `78%, 0%, 15%, 23%` |
| Mint gradient end | `#38D6BB` | `rgb(56, 214, 187)` | `hsl(170, 66%, 53%)` | `74%, 0%, 13%, 16%` |
| White background / node highlight | `#FFFFFF` | `rgb(255, 255, 255)` | `hsl(0, 0%, 100%)` | `0%, 0%, 0%, 0%` |
| Inverted light node end | `#E2E8F0` | `rgb(226, 232, 240)` | `hsl(214, 32%, 91%)` | `6%, 3%, 0%, 6%` |

Notes:

- Use `#0F1E3A`, `#2BC4A6`, `#64748B`, and `#F1F5F9` as the core brand tokens when communicating the palette in design docs.
- Use the optional light-blue gradient, `linear-gradient(#93C5FD, #60A5FA)`, only when an additional color family becomes necessary.
- Navy SVG gradient: `linear-gradient(#061A43, #0F1E3A)`
- Mint SVG gradient: `linear-gradient(#2BC4A6, #38D6BB)`
- Node highlight: white radial highlight using `#FFFFFF` at 22%, 3%, and 0% opacity
- Soft shadow: `#0F1E3A` at 12% opacity
- Line shadow: `#0F1E3A` at 10% opacity
- CMYK values are approximate conversions for print discussions; use the Hex or RGB values as the digital source of truth.

### Primary

- Deep navy / slate
- Professional, clinical, trustworthy
- Works well for text and app headers

### Accent

- Mint, teal, or cyan
- Suggests clarity, status, progress, and clinical guidance
- Connects naturally to “green / routine pathway” UI states

### Avoid as primary colors

- Bright red, because it suggests danger, bleeding, or error
- Overly dental-blue stock-icon styling
- Heavy gradients unless used very subtly

## Shape language

Use:

- Rounded geometry
- Connected nodes
- Dental arch or tooth-inspired forms
- Simple, scalable lines
- Minimal detail for favicon compatibility

Avoid:

- Highly anatomical roots
- Endodontic files as the main symbol
- Medical crosses
- AI sparkles
- Overly literal pulp chambers
- Anything that locks the brand into root canal therapy only

---

# Logo Option 1: Connected Tooth Mark

## Concept

A minimal tooth or dental arch outline built from connected nodes.

The reference icon uses eight small circular nodes connected by thin lines, subtly forming a molar, premolar, or dental arch silhouette. Simplified small-size variants can reduce the node count if needed for legibility.

## What it communicates

- “Node” through connected decision points
- “Dent” through tooth or arch geometry
- Clinical workflow without being limited to endodontics
- A parent platform for multiple dental decision guides

## Why it works

This is the strongest general-purpose direction for NodeDent.

It can represent:

- Endodontic decision trees
- Restorative workflows
- Caries management pathways
- Hygiene/perio protocols
- Diagnosis logic
- Structured note generation

## Possible lockup

```text
[connected tooth/node icon] NodeDent
Clinical decision notes for dentistry
```

## Favicon idea

A simplified tooth-shaped outline with three connected nodes.

Example concept:

```text
  ●──●
 /    \
●      ●
 \    /
  ●──●
```

The final design should be more polished and tooth-like, but still very simple.

## Best use case

Use this if NodeDent is intended to become the umbrella platform for multiple clinical decision-note guides.

---

# Logo Option 2: NodeDent Monogram

## Concept

A stylized **ND** mark where the **N** is made of connected nodes and the **D** subtly resembles a tooth, arch, or rounded dental form.

## What it communicates

- A more brand-like, app-icon-friendly identity
- “Node” through the connected-node N
- “Dent” through the rounded D / arch shape
- A professional software product rather than a single clinical template

## Why it works

This option is compact and memorable.

It is especially useful for:

- App icons
- Favicons
- Sidebar icons
- GitHub/GitLab repository avatars
- Mobile home-screen icons
- Browser tabs

## Possible lockup

```text
[ND node monogram] NodeDent
Clinical decision notes for dentistry
```

## Favicon idea

A dark navy rounded square containing an **N** made from three connected mint nodes, with a subtle rounded **D** curve.

## Best use case

Use this if you want NodeDent to feel like a polished software product or platform brand.

---

# Logo Option 3: Clinical Pathway Icon

## Concept

A branching decision pathway that ends in a small tooth, dental arch, or note card.

For example:

```text
Start node
   ↓
Decision split
  ↙ ↘
Path A Path B
   ↓
Dental note / tooth
```

## What it communicates

- Chairside decision guidance
- Branching clinical pathways
- Structured clinical note generation
- Workflow logic

## Why it works

This is the most literal option for explaining what the app does.

It clearly says:

- The user moves through decisions.
- Each decision changes the clinical path.
- The final output is documentation.

## Possible lockup

```text
[pathway-to-tooth icon] NodeDent
Clinical decision notes for dentistry
```

## Favicon idea

A three-node branching pathway inside a rounded square, with the last node shaped like a small tooth or note.

## Best use case

Use this if the logo needs to immediately explain “decision guide” to new users.

## Tradeoff

This option may be slightly busier than the connected tooth mark or monogram. It may need more simplification for a favicon.

---

# Recommended Direction

## Primary recommendation

**Option 1: Connected Tooth Mark**

This is the best fit for NodeDent as a broad dental decision-note platform.

It is:

- Dental, but not endodontic-only
- Modular
- Easy to connect to the name “NodeDent”
- Scalable across future workflows
- Suitable for both web app branding and favicons

## Secondary recommendation

Use **Option 2: NodeDent Monogram** if the connected tooth mark feels too illustrative or if you want a more software-product-style identity.

## Avoid using Option 3 as the primary mark unless

You want the logo to explain the product function very literally. It may be better as a supporting illustration or onboarding graphic rather than the main logo.

---

# Suggested Brand System

## Parent platform

```text
NodeDent
Clinical decision notes for dentistry
```

## Possible future product family

```text
NodeDent        = parent platform
Pulp-App        = pulp / endodontic workflow
HygieneNote     = hygiene / periodontal notes
Caries guide    = caries risk and lesion management
Operative guide = restorative workflow and notes
```

## Logo hierarchy

Use NodeDent as the umbrella brand.

Individual guides can have their own page titles or modules, but the visual identity should remain consistent:

- same typography
- same card-based design language
- same navy/slate base palette
- same mint/teal progress accent
- same node/decision visual motif

## Typography

Use **Inter** for the primary wordmark, tagline, and supporting brand-system labels.

The type direction should feel:

- modern
- clean
- professional
- highly readable

---

# Practical Design Brief

Create a logo for **NodeDent** with the tagline:

```text
Clinical decision notes for dentistry
```

The logo should be modern, clinical, and modular. It should communicate dental decision workflows and structured note generation without being limited to root canal therapy.

Preferred concept:

```text
A connected-node mark subtly forming a tooth, dental arch, or dental workflow path.
```

Preferred style:

```text
Minimal, rounded, scalable, professional, suitable for favicon and app header.
```

Preferred colors:

```text
Deep navy primary: #0F1E3A
Mint / teal accent: #2BC4A6
Slate gray supporting text: #64748B
Light slate background: #F1F5F9
Optional SVG gradient stops: #061A43 to #0F1E3A, #2BC4A6 to #38D6BB
Optional light-blue extension gradient: #93C5FD to #60A5FA
White highlight / flat icon background: #FFFFFF
```

Avoid:

```text
Root canal file imagery
Overly anatomical tooth roots
Medical crosses
AI sparkles
Bright red as primary color
Complex illustrations that fail at small sizes
```
