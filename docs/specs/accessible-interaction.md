---
status: active
created_on: 2026-07-20
---

# Accessible Interaction

## Goal

Give NodeDent dialogs, validation, feedback, keyboard interaction, focus states, and chairside touch controls a consistent accessible contract.

This spec owns A11Y-01 through A11Y-03 and TOUCH-01 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md). Static review identified the gaps; browser and assistive-technology testing must confirm runtime behavior.

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
