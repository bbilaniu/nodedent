---
status: active
created_on: 2026-07-20
---

# Accessible Interaction

## Goal

Give NodeDent dialogs, validation, feedback, keyboard interaction, focus states, and chairside touch controls a consistent accessible contract.

This spec owns A11Y-01 through A11Y-03 and TOUCH-01 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md). Static review identified the gaps; browser and assistive-technology testing must confirm runtime behavior.

[ADR 0013](../adr/0013-separate-action-selection-and-clinical-state-color-semantics.md)
proposes separate visual roles for actions, selected controls, and status. This
spec owns the corresponding programmatic state, non-color cues, focus behavior,
and assistive-technology requirements.

## Implementation Status

The 2026-08-25 interaction pass introduced a reusable `AccessibleDialog`
primitive and moved the application modal and destructive-confirmation families
onto it. The primitive provides an accessible name and optional description,
initial focus, contained Tab order, topmost-dialog Escape handling, background
`inert`/`aria-hidden` suppression, body scroll locking, backdrop behavior, and
focus restoration. Shared-workflow dismissal or Catalogue navigation and
end-visit dismissal now warn before they discard unrecorded edits.

Shared text, select, file, time, vault, contextual endodontic, and operative
validation now exposes field IDs, `aria-invalid`, described-by relationships,
visible non-color error text, and field links from local error summaries where
an invalid field exists. Equivalent remaining actions and status messages use
the semantic UI contracts, with routine dismissal, clinical recording,
warnings, and destructive consequences kept visually distinct.

The development-only semantic gallery includes an interactive dialog fixture.
Browser verification confirmed initial focus, forward and reverse Tab wrapping,
Escape dismissal, background suppression, scroll locking, focus restoration, a
44 CSS-pixel default action target, visible two-pixel keyboard focus, and no
horizontal overflow at the available 1920-pixel viewport in light and dark
modes. The automated rendering and workflow suites cover the component
semantics and error relationships.

This spec remains active because committed automated browser/axe coverage and
manual VoiceOver/NVDA, 200% zoom, forced-colors, phone, tablet, mounted-tablet,
and gloved-use evidence are still acceptance work. Those checks require their
actual target environments and must not be inferred from the desktop fixture.

## Required Outcomes

### Dialog contract

- Use one reusable accessible dialog primitive where practical.
- Provide dialog semantics, an accessible name, focus entry, focus containment, Escape behavior, background inertness, scroll prevention, and focus restoration.
- Warn before Escape or close discards unconfirmed work.
- Put the least destructive action first for destructive confirmations.

### Forms and feedback

- Give every input and textarea a visible label.
- Connect invalid controls to specific errors with `aria-invalid` and `aria-describedby`.
- Provide a form-level error summary that links to invalid fields.
- Announce save, copy, import, and workflow-validation results through appropriate live regions without excessive repetition.
- Never rely on color alone for required, invalid, complete, warning, expired, or reassessment states.

### Keyboard and focus

- Apply a shared `focus-visible` treatment to buttons, links, tabs, cards acting as buttons, checkboxes, and icon-only controls.
- Preserve visible focus in light, dark, high-contrast, and 200% zoom conditions.
- Ensure complete workflows and recovery actions are keyboard operable.

### Chairside touch

- Test 44–48 CSS pixel targets for high-frequency chairside actions.
- Keep destructive controls separated from adjacent actions.
- Verify phone, tablet, mounted-tablet, and gloved interaction rather than relying only on WCAG's minimum target size.

## Non-Goals

- Redesigning NodeDent's visual identity.
- Replacing all components when existing primitives can be corrected.
- Treating automated axe checks as a substitute for keyboard, VoiceOver, NVDA, zoom, high-contrast, and touch testing.

## Validation

- Focused component tests for semantics and error relationships.
- Playwright keyboard, focus-restoration, and destructive-dialog tests.
- Automated axe checks on major workflow surfaces.
- Manual assistive-technology, zoom, contrast, and chairside-device verification.
- `npm run typecheck`, `npm test`, `npm run build`, and `npm run docs:check`.

## Completion

Archive this spec after the shared contracts are implemented, major dialogs/forms use them, and automated plus manual evidence is recorded.
