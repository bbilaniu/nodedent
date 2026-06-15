# ADR 0002: Apply the NodeDent Color System Without Losing Clinical Semantics

## Status

Accepted

## Context

The endodontic chairside app originally used generic Tailwind color utilities such as slate, blue, emerald, green, amber, orange, and red. Some of those colors were purely visual, while others carried clinical meaning.

NodeDent needs the app to align with the brand palette, but chairside status recognition must remain clear. Routine, recorded, in-progress, caution, high-difficulty, medicated, referred, destructive, and completion states cannot collapse into one brand color family.

## Decision

Define NodeDent brand colors as Tailwind v4 theme tokens in `src/styles.css` and use named token classes throughout the app for app chrome, headings, primary actions, active states, quiet panels, supporting text, focus states, and positive progress.

Use this role mapping:

- `brand-navy`: headings, primary buttons, active states, app chrome.
- `brand-navy-deep`: primary hover and dark overlay emphasis.
- `brand-mint`: positive, routine, recorded, and completion accents.
- `brand-slate`: secondary text and supporting labels.
- `brand-light-slate`: page background, quiet panels, inactive surfaces.
- `brand-light-node`: subtle borders.
- `brand-blue-light` and `brand-blue`: informational or secondary workflow actions, such as saved workflow, import, and continuation panels.

Keep clinical warning/error families semantically distinct:

- Amber remains caution, medicated, prior visit, and temporization.
- Orange remains high difficulty.
- Red remains referral, destructive actions, and validation errors.
- Violet/cyan can remain for specific workflow sub-states where they add useful separation.

Support dark mode as an alternate rendering of the same clinical color roles, not as a separate color language. The app sets `data-theme="dark"` on the document root and `src/styles.css` remaps existing utility classes to darker surfaces, softer borders, and higher-contrast text. Primary actions remain navy, positive/progress states remain mint, informational workflow states remain blue, and amber/orange/red/violet/cyan keep their clinical meanings with dark-mode contrast adjustments.

## Rationale

Named tokens make the brand system explicit and reduce scattered hardcoded color choices. A deliberate role mapping prevents accidental search-and-replace changes that would make clinically different states look equivalent.

Preserving warning, high-difficulty, and referral colors protects chairside scanning speed and clinical safety. Using brand mint for positive progress aligns completion and recorded states with NodeDent without making them look like warning or error states.

## Consequences

- React components should use token classes such as `bg-brand-navy`, `text-brand-slate`, `border-brand-light-node`, and `focus:ring-brand-mint/20` for branded UI roles.
- Hardcoded brand hex values should stay in `src/styles.css`, not in React components.
- Status style maps should remain centralized in `src/endo-guide/engine/deriveCanalStatus.ts`, `src/endo-guide/engine/deriveCaseStatus.ts`, and `src/endo-guide/engine/phaseProgress.ts`.
- New status colors should be added by clinical meaning, not by visual preference alone.
- Optional blue should be used sparingly for informational or secondary actions, not for primary CTAs, completion, warnings, or errors.
- Dark mode should be maintained through the document-level theme override in `src/styles.css`; avoid duplicating every component class unless a component has a unique contrast problem.

## Alternatives Considered

- Direct Tailwind color replacement: fast, but risky because some existing colors encoded clinical status.
- Single brand-dominant palette everywhere: visually consistent, but weaker for chairside differentiation.
- Component-local hex values: flexible, but likely to drift and harder to review.

## Verification

Color implementation changes should pass:

```bash
npm run typecheck
npm run test
npm run build
```

Manual review should confirm primary actions use navy, positive progress uses mint, informational actions use light blue only where helpful, and amber/orange/red clinical states remain obvious.
