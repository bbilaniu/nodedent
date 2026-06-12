---
status: implemented
created_on: 2026-06-09
completed_on: 2026-06-11
---

# NodeDent App Colour Implementation Plan

## Goal

Apply the NodeDent brand palette to the endodontic chairside app without losing the existing clinical status semantics.

The app should feel aligned with the logo system while still making routine, caution, high-difficulty, medicated, referred, and completion states easy to scan chairside.

## Source Palette

Core brand tokens:

| Token | Hex | Intended use |
| --- | --- | --- |
| `brand-navy` | `#0F1E3A` | Primary actions, active states, headings, app chrome |
| `brand-mint` | `#2BC4A6` | Progress, positive/routine states, selected accents |
| `brand-slate` | `#64748B` | Secondary text, supporting labels, subtle UI |
| `brand-light-slate` | `#F1F5F9` | Page background, quiet panels |

Optional construction / extension colors:

| Token | Hex | Intended use |
| --- | --- | --- |
| `brand-navy-deep` | `#061A43` | Gradient start, extra dark emphasis |
| `brand-mint-bright` | `#38D6BB` | Mint gradient end, hover accents |
| `brand-blue-light` | `#93C5FD` | Optional light-blue gradient start |
| `brand-blue` | `#60A5FA` | Optional light-blue gradient end |
| `brand-white` | `#FFFFFF` | Cards, icon backgrounds, highlights |
| `brand-light-node` | `#E2E8F0` | Inverted logo nodes, subtle light borders |

## Implementation Strategy

Use named tokens first, then migrate surfaces incrementally.

The current app uses Tailwind utilities directly, for example `bg-slate-50`, `text-slate-900`, `bg-blue-50`, and `bg-emerald-50`. A direct search-and-replace would be risky because some colors encode clinical meaning. The safer approach is to define NodeDent theme tokens, then intentionally map UI roles to those tokens.

## Phase 1 - Add Theme Tokens

Update `src/styles.css` to define Tailwind v4 theme tokens:

```css
@theme {
  --color-brand-navy-deep: #061A43;
  --color-brand-navy: #0F1E3A;
  --color-brand-mint: #2BC4A6;
  --color-brand-mint-bright: #38D6BB;
  --color-brand-slate: #64748B;
  --color-brand-light-slate: #F1F5F9;
  --color-brand-blue-light: #93C5FD;
  --color-brand-blue: #60A5FA;
  --color-brand-light-node: #E2E8F0;
}
```

After this, Tailwind classes such as `bg-brand-navy`, `text-brand-slate`, `border-brand-mint`, and `from-brand-blue-light` should be available.

Also update the global page background from `#f8fafc` to `#F1F5F9`.

## Phase 2 - Brand The Main App Shell

Update the highest-visibility surfaces first:

| Area | Current pattern | Target pattern |
| --- | --- | --- |
| Page background | `bg-slate-50` | `bg-brand-light-slate` |
| Header card | `bg-white border-slate-200` | Keep white, use subtle brand border if needed |
| Main H1 | `text-slate-950` | `text-brand-navy` |
| Eyebrow labels | `text-slate-500` | `text-brand-slate` |
| Primary buttons | `bg-slate-900 text-white` | `bg-brand-navy text-white` |
| Primary button hover | `hover:bg-slate-800` | `hover:bg-brand-navy-deep` |
| Focus rings | `focus:ring-slate-100` | `focus:ring-brand-mint/20` or `focus:ring-brand-blue-light/30` |

Primary files:

- `src/endo-guide/EndoChairsideGuide.tsx`
- `src/endo-guide/components/FormControls.tsx`
- `src/endo-guide/components/NotePreview.tsx`
- `src/endo-guide/components/CanalSelector.tsx`
- `src/endo-guide/components/DecisionCard.tsx`

## Phase 3 - Preserve Clinical Status Semantics

Do not replace all status colors with brand colors.

Keep warning and stop-rule families recognizable:

| Clinical meaning | Keep or adjust |
| --- | --- |
| Routine / recorded / complete | Move toward mint/green using `brand-mint` where appropriate |
| In-progress / informational | Use optional light blue gradient family if extra separation is needed |
| Caution / medicated / prior visit | Keep amber |
| High difficulty | Keep orange |
| Referral / destructive actions / validation errors | Keep red |
| Not started / paused / disabled | Use slate and light slate |

Centralized status files to update carefully:

- `src/endo-guide/engine/deriveCanalStatus.ts`
- `src/endo-guide/engine/deriveCaseStatus.ts`
- `src/endo-guide/engine/phaseProgress.ts`

Recommended first mapping:

```text
notStarted: brand-light-slate / brand-slate
estimated, scouted: optional light-blue family
wlEstablished, glidePath: existing violet/cyan unless the workflow needs simplification
shaped, disinfected, complete: brand-mint based success styling
paused: slate
medicated: amber
referred: red
```

## Phase 4 - Replace Repeated Utility Patterns

After the main colors are stable, consider introducing small shared class constants or component variants for repeated UI roles:

```text
primaryButton
secondaryButton
quietPanel
sectionCard
formControl
statusPill
dangerButton
warningButton
infoButton
```

Good first target: `src/endo-guide/components/FormControls.tsx`, because `SectionCard`, `TextInput`, and `SelectInput` already centralize many repeated patterns.

Avoid a large abstraction pass until the brand colors are visually approved.

## Phase 5 - Add Optional Light Blue Deliberately

Use `#93C5FD` to `#60A5FA` only where a second cool accent is genuinely needed.

Good uses:

- Saved workflow / import actions
- Informational panels
- Secondary navigation or workflow continuation cards
- A gradient accent on non-primary illustrations

Avoid using light blue for:

- Primary CTA buttons
- Routine completion states that should read as mint/green
- Error, warning, or referral states

## Verification Checklist

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Manual visual checks:

- Main header reads as NodeDent, not generic Tailwind slate.
- Primary actions use navy consistently.
- Positive progress uses mint without looking like a warning or error state.
- Blue is present only where it helps separate informational actions.
- Warning, high-difficulty, referral, and destructive states remain clinically obvious.
- Text contrast is readable on mobile and desktop.
- Focus states are visible for keyboard users.
- Printed/exported note surfaces remain plain and legible.

## Acceptance Criteria

- App-level background, headings, primary buttons, active states, and progress accents use named NodeDent color tokens.
- Supporting text and quiet panels use `brand-slate` and `brand-light-slate`.
- Optional light blue is available as a token and used only for secondary/informational accents.
- Clinical warning/error colors remain semantically distinct.
- No hard-coded brand hex values are scattered through React components after the token pass.
- Existing tests and build pass.

## Suggested PR Shape

1. Add theme tokens and update the app shell.
2. Migrate shared form/card/button patterns.
3. Update centralized status style maps.
4. Polish remaining isolated utilities after visual review.

Keep each PR small enough to visually inspect in the browser before proceeding.
