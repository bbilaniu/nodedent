---
status: active
created_on: 2026-07-20
---

# GUI Consistency And Design System

## Goal

Define and apply a coherent NodeDent visual system across workflow launchers, shared modules, clinical runners, setup panels, forms, dialogs, tables, and state feedback without flattening clinically meaningful differences.

This spec owns broad GUI consistency beyond the completed [Workspace cross-workflow consistency](archive/workspace-cross-workflow-consistency.md) pass and the active [Accessible interaction](accessible-interaction.md) contract. The archived workspace spec records the implemented workflow behavior, placement, labels, and information hierarchy. The accessibility spec continues to own interaction semantics, focus, validation, keyboard behavior, and touch requirements.

[ADR 0013](../adr/0013-separate-action-selection-and-clinical-state-color-semantics.md)
proposes the semantic separation of action prominence, control selection,
clinical status, and workflow category. Once accepted, this spec owns the
component/state matrix and incremental implementation of that decision.

The implemented first-pass matrix, component usage, development fixture, and
review checklist are published in the [Semantic UI contract](../guides/semantic-ui-contract.md).
That pass normalizes launcher actions; separates anesthesia, isolation, and
radiology selection from action styling; makes their record actions visually
primary; centralizes shared status tones; and removes the ambiguous shared
`info`, `mint`, and `success` action variants. The remaining broad inventory and
surface-by-surface migration keep this spec active.

The second surface pass migrates Case Entry and Case Setup. It centralizes their
action and form-control treatments, represents workflow inclusion as blue
selection rather than mint positive status, keeps workflow launch actions
primary, and classifies plaintext download as a warning action.

The third surface pass migrates application chrome and reusable notices. It
uses the status contract for deployment, privacy, vault, error, and difficulty
feedback; keeps header prominence separate from vault state; gives footer
navigation the common blue focus treatment; and treats auxiliary banner
navigation as secondary while preserving warning semantics for plaintext
export.

The fourth surface pass migrates workflow targets, history and output, and
administrative row collections. Active targets use selection semantics without
overwriting their clinical status; event and recovery history use list and time
structure; output-format tabs use programmatic selected state; plaintext copy
and download actions use warning semantics; and catalogue/recovery controls use
the shared compact action, form-focus, and feedback contracts.

The fifth surface pass migrates dialogs and end-visit controls. Shared modal
frames now expose dialog names and modality consistently; quiet dismissal stays
secondary; phase and canal selection uses the blue choice contract while phase
progress remains a separate clinical status; and high-consequence decisions use
large primary, warning, or destructive actions according to their actual effect.
Saved-case deletion remains destructive, while referral and medication pathways
remain warning actions because they route documentation rather than deleting
clinical data.

## Principles

- Similar controls with the same meaning must look and behave consistently.
- Visual differences must communicate category, state, priority, or risk rather than implementation history.
- Workflow-specific clinical surfaces may retain distinct information structures while reusing shared layout and control primitives.
- Color must reinforce labels and structure, never replace them.
- Light, dark, high-contrast, keyboard-focus, touch, and disabled states are part of the same component contract.

### Case Setup ownership

Case Setup & Status owns case identity, visit status, treatment-workflow selection, and shared readiness. It does not repeat workflow-specific setup forms or summaries merely because a selected workflow consumes that state.

- Endodontic canal management remains in Endodontic progress, and endodontic measurement capture remains in the always-visible Measurements panel.
- Operative tooth, surface, restoration-intent, material, and shade capture remains in the operative workflow.
- Selected workflows remain discoverable and openable from the Treatment plan section in Case Setup.
- Removing duplicated Case Setup sections must not alter clinical events, persistence, validation, note output, exports, or workflow-owned controls.

This active ownership boundary supersedes the historical Case Setup placement recorded in the archived workspace cross-workflow consistency specification.

## Required Inventory

Inventory and classify the current UI before broad restyling:

- application header, footer, and navigation;
- NodeDent Home and quick-switcher cards;
- primary-workflow and shared-module launch buttons;
- setup, runner, readiness, target, history, and output panels;
- primary, secondary, informational, success, warning, danger, and destructive actions;
- inputs, textareas, selects, checkboxes, segmented controls, and catalog controls;
- dialogs, banners, status badges, empty states, validation, loading, saving, success, and failure feedback;
- tables, repeated rows, measurements, event history, and generated-output previews; and
- phone, tablet, laptop, and wide-desktop layouts in light and dark modes.

Document intentional variants and identify one-off class combinations that should use shared tokens or components.

## Workflow And Shared-Module Button Inconsistency

Primary-workflow launch buttons and shared-module launch buttons currently use inverted passive and hover color states:

| Current button category | Current passive/rest state | Current hover state |
| --- | --- | --- |
| Primary workflow | Filled primary brand surface with high-contrast light text | Light/outlined surface with primary brand text |
| Shared module | Light/outlined informational surface with primary brand text | Filled informational/brand surface with high-contrast light text |

This reciprocal behavior is inconsistent: the same pointer interaction reverses visual emphasis differently depending on category. It can make hover feel like selection in one place and deselection in another. The consistency pass must remove this inversion and define one predictable passive-to-hover transition shared by primary-workflow and shared-module launch buttons.

The final color values must be selected during the inventory/token phase after checking light and dark contrast. This spec does not preselect filled or outlined styling as the universal passive state. Whatever direction is selected must apply consistently to both categories through shared semantic variants rather than repeated component-local Tailwind strings.

Additional requirements:

- Preserve any necessary category distinction through labels, grouping, icons, borders, or stable semantic accents—not opposite hover mechanics and not hover alone, because touch devices do not have a reliable hover state.
- Keep the visible action label explicit, such as `Start workflow`, `Resume workflow`, `Record`, or `Review`.
- Do not apply the ordinary launch-button hover treatment to destructive, warning, disabled, selected, completed, or model-only states; those states keep their own semantic contract.
- Define corresponding `focus-visible`, active/pressed, disabled, selected, and loading states.
- Ensure dark-mode equivalents preserve the same interaction meaning and meet contrast requirements.
- Avoid motion or color changes that cause layout shift.

## Shared Foundations

### Color tokens

Define semantic tokens for:

- application and elevated surfaces;
- primary and muted text;
- borders and dividers;
- workflow and shared-module actions;
- selected/current state;
- informational, success, warning, danger, and destructive states; and
- focus rings and disabled treatment.

Components must consume semantic meaning rather than matching generated utility-class fragments.

### Typography and spacing

- Define title, section heading, field label, helper text, status, and compact metadata roles.
- Standardize vertical rhythm, card padding, control gaps, and responsive wrapping.
- Keep dense clinical information readable without turning workflow screens into marketing layouts.

### Controls

- Consolidate button sizes, corner radii, borders, typography, icons, and state behavior.
- Standardize form-control heights, label placement, helper/error spacing, and selected states.
- Define consistent checkbox, segmented-control, dropdown, and repeated-row treatments.
- Keep destructive actions visually and spatially separated from routine actions.

### Surfaces and feedback

- Standardize cards, panels, dialogs, banners, badges, tables, empty states, loading states, and recovery messages.
- Use the same visual state vocabulary across endodontic, operative, anesthesia, isolation, and radiology surfaces.
- Preserve workflow-specific target information and clinical semantics.

## Non-Goals

- Changing clinical workflow logic, event semantics, note output, or validation rules.
- Rebranding NodeDent or selecting a new color palette without a separate decision.
- Making every clinical workflow use an identical layout.
- Replacing accessible names or visible status text with color or icons.
- Performing a single global class rewrite without component-by-component verification.

## Implementation Sequence

1. Inventory existing variants and capture representative screenshots.
2. Define semantic tokens and a documented component/state matrix.
3. Remove the inverted workflow/shared-module passive and hover behavior by implementing the selected shared interaction contract.
4. Consolidate shared buttons, controls, panels, feedback, and typography incrementally.
5. Migrate one surface family at a time with focused regression tests.
6. Verify light/dark, keyboard, touch, responsive, zoom, and high-contrast behavior.

## Validation

- Focused rendering tests for semantic variants and state classes.
- Browser tests for rest, hover, focus-visible, active, disabled, selected, and loading states.
- Visual snapshots for primary-workflow and shared-module buttons in light and dark modes.
- Representative screenshots at phone, tablet, laptop, and wide-desktop widths.
- Automated contrast/accessibility checks plus manual keyboard, zoom, high-contrast, and touch verification.
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:check`

## Acceptance Criteria

- Primary-workflow and shared-module launch buttons no longer invert passive and hover emphasis relative to each other.
- Both categories use one documented, predictable passive-to-hover interaction contract while remaining identifiable without hover.
- Shared semantic variants own all workflow/shared-module button states.
- Core buttons, controls, surfaces, typography, spacing, and feedback have documented state contracts.
- Major NodeDent surfaces no longer rely on unexplained one-off styling for equivalent controls.
- Light/dark, responsive, focus, touch, disabled, selected, loading, warning, and destructive states remain distinguishable and accessible.
- Clinical semantics and workflow behavior are unchanged.

## Completion

Archive this spec after the component/state matrix is documented, major application surfaces use the shared contracts, the workflow/shared-module button inversion is removed, and automated plus manual visual evidence is recorded.
