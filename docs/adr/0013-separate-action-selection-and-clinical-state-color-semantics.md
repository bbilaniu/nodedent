# ADR 0013: Separate Action, Selection, And Clinical-State Color Semantics

## Status

Proposed

## Context

[ADR 0002](0002-apply-nodedent-color-system.md) established the NodeDent brand
palette and preserved distinct colors for clinically meaningful states. It maps
brand navy to headings, primary buttons, active states, and application chrome;
mint to positive progress; blue to informational or secondary workflow actions;
and amber, orange, red, violet, and cyan to specific clinical meanings.

The palette is sound, but the application does not yet have a complete semantic
contract for applying it. Color sometimes communicates action prominence,
workflow category, selected state, and clinical status in different places. A
solid navy control can therefore mean a primary action in one panel and a
selected choice in another. Primary-workflow launch buttons and shared-module
launch buttons can also look different even though both open the principal
workspace named by their card.

This overlap makes equivalent controls harder to recognize and leaves future
components to infer visual meaning from existing Tailwind class combinations.
Hover cannot resolve the ambiguity because it is transient and unavailable on
touch devices. NodeDent needs a stable semantic layer between its brand palette
and its components.

This ADR refines ADR 0002 without changing the adopted brand palette or the
clinical meanings that ADR 0002 preserves.

## Decision

NodeDent will treat action prominence, control selection, clinical status, and
content category as independent semantic dimensions.

- **Action prominence** describes what a control does in its current surface:
  primary, secondary, warning, or destructive.
- **Control selection** describes which choice, mode, tab, or option is current.
- **Clinical status** describes recorded state, readiness, attention, difficulty,
  error, or another domain state.
- **Content category** describes whether a surface belongs to a primary workflow,
  shared module, setup area, history view, or another part of the product.

A component must not use an action treatment merely to identify its content
category, and a selected control must not look identical to a primary action.
Color must reinforce visible labels, grouping, borders, icons, and programmatic
state rather than replace them.

### Action roles

The action role is contextual; it is not determined by the verb alone. For
example, `Review radiology` is a primary action when it is the principal action
in the Radiology launcher card, even though review may be secondary elsewhere.

| Role | Contract | Typical use |
| --- | --- | --- |
| Primary | Solid brand navy with high-contrast text; darker navy hover/pressed treatment | The principal enabled action in a card or decision panel, including start, open, record, review, or save when that action is primary in context |
| Secondary | Quiet or white surface with a navy border and text; modest tinted hover/pressed treatment | Cancel, manage, disclose details, or an additional action that should not compete with the surface's primary action |
| Warning | Amber-family treatment with explicit caution wording | An action whose consequence requires attention or confirmation |
| Destructive | Red-family treatment with explicit destructive wording and spatial separation | Delete, remove, or irreversibly replace data |

An enabled primary-workflow launcher and an enabled shared-module launcher will
use the same primary-action contract when each is the principal action in its
card. Their categories remain visible through section headings, card grouping,
names, descriptions, and any stable category metadata—not through different
button colors.

Warning and destructive meaning overrides ordinary action prominence. A risky
action does not become navy merely because it is the only action in a panel.

### Selection roles

Selected choices, modes, tabs, segmented controls, and similar inputs will use a
dedicated selection treatment. It will use a tinted surface, a strong border,
and a non-color selection indicator where practical, such as a checkmark, radio
mark, or explicit selected label. It will expose the appropriate native or ARIA
state.

Selection will not use the solid primary-action treatment. Mint will not be used
merely to mean selected because mint is reserved for positive or recorded state.
Focus will have its own visible ring and must remain distinguishable from hover
and selection.

### Status roles

Clinical and workflow status will remain distinct from action and selection
treatments:

| Status role | Color family | Meaning |
| --- | --- | --- |
| Positive | Mint | Ready, recorded, completed, or positive progress |
| Attention | Amber | Caution, reassessment required, temporization, or another state requiring attention |
| Neutral | Gray/slate | Pending without urgency, not started, unavailable, or ordinary inactive state |
| High difficulty | Orange | Existing high-difficulty clinical state |
| Danger/error | Red | Existing referral, validation, destructive, or serious error meaning, distinguished further by text and component structure |

Violet, cyan, and other existing clinical sub-state colors may remain where they
provide a documented distinction. New status colors must continue to be added
by clinical meaning rather than visual preference, as required by ADR 0002.

### Interaction states

Every interactive semantic variant will define rest, hover, pressed, focus-
visible, disabled, selected where applicable, and loading behavior in both light
and dark modes.

Hover and pressed states will strengthen or soften the resting treatment within
the same semantic family. They must not invert a filled control into an outline
or an outlined control into a filled control in a way that suggests selection,
deselection, or a category change. State changes must not cause layout shift.

Disabled controls will use a neutral muted treatment in addition to native
disabled behavior. When the reason for unavailability is not evident, visible
or programmatically associated text will explain it.

### Token and component architecture

The existing `brand-*` palette tokens remain the source colors. NodeDent will
add semantic tokens or centrally owned semantic style contracts for roles such
as:

- action primary, secondary, warning, and destructive;
- control selected and current;
- status positive, attention, neutral, difficulty, and danger;
- focus and disabled treatment; and
- application, elevated, and muted surfaces.

Application components will consume these roles instead of assembling brand
colors independently. Shared typed components or centralized class contracts
will own button, choice-control, and status-badge behavior. Variant names such as
`info` or `success` must be narrowed to a clear semantic role or replaced when
they leave action versus status meaning ambiguous.

The migration will be incremental. Existing component-local classes may remain
temporarily, but equivalent controls must converge on the shared contracts.

## Rationale

Separating these dimensions makes appearance predictable: navy identifies the
main available action, a dedicated treatment identifies the current choice, and
clinical status colors retain their domain meaning. Users do not need to learn a
different color language for primary workflows and shared modules.

Contextual action roles also avoid brittle verb-based styling. `Open`, `Review`,
and `Record` can each be primary or secondary depending on the surrounding
surface. The component contract expresses that hierarchy directly.

Semantic tokens preserve the NodeDent palette while reducing class-level drift.
They also provide one place to verify dark mode, contrast, hover, focus,
selection, disabled, and loading states.

## Consequences

- Primary-workflow and shared-module launcher buttons will converge on one
  primary-action treatment when enabled.
- Mode and assessment choices such as `Administration`, `Assessment`,
  `Adequate`, and `Not adequate` will use selection semantics rather than
  primary-action styling.
- A record action will normally be navy while available; mint will communicate
  the resulting recorded, ready, or completed state.
- Informational blue will no longer act as a general identifier for all shared
  modules.
- Some existing controls will change appearance even though their behavior and
  clinical semantics remain unchanged.
- The design-system implementation must include a documented component/state
  matrix and a development-only state gallery or equivalent stable visual-test
  fixture.
- Visual regression coverage will grow because semantic correctness includes
  light, dark, hover, focus, selected, disabled, and loading renderings.

## Alternatives Considered

- **Keep separate colors for primary workflows and shared modules:** preserves
  category distinction, but makes equivalent launch actions look behaviorally
  different and conflicts with action colors inside shared modules.
- **Use one filled brand color for actions and selected controls:** visually
  compact, but continues to conflate an available action with current state.
- **Assign styles from button labels:** easy for common verbs, but fails when an
  action such as review is primary in one context and secondary in another.
- **Rely on hover to reveal interactivity:** insufficient for touch, keyboard,
  high-contrast, and non-hover use.
- **Replace the NodeDent palette:** unnecessary; the problem is semantic
  application of the palette, not the palette itself.

## Implementation And Verification

The active [GUI consistency and design system
spec](../specs/gui-consistency-and-design-system.md) owns the inventory,
component/state matrix, incremental migration, and visual acceptance criteria.
The [Accessible interaction spec](../specs/accessible-interaction.md) owns
programmatic selection, focus, keyboard, touch, and non-color state cues.

### GUI specification follow-through

The GUI spec will resolve its currently open launcher-style choice using this
ADR's semantic contract. It will require:

- the same primary-action treatment for equivalent enabled primary-workflow and
  shared-module launchers;
- stable category identification through headings, grouping, labels, and
  descriptions rather than action color;
- a monotonic rest-to-hover-to-pressed transition that does not swap filled and
  outlined emphasis;
- a separate selected-choice contract; and
- a documented matrix covering action, selection, status, focus, disabled, and
  loading states in light and dark modes.

### Accessibility follow-through

The accessibility spec and component contracts will require selected choices to
use native selection semantics or an appropriate state such as `aria-pressed`.
Selection will have a visible non-color cue. Focus-visible styling will remain
distinct from hover and selection, and unavailable controls will expose their
reason when it is not otherwise evident. Contrast and state recognition will be
checked in light, dark, high-contrast, keyboard, touch, and zoom contexts.

### Living reference and visual evidence

The implementation will publish a concise engineering reference containing the
approved semantic component/state matrix. A development-only UI state gallery,
or an equivalent stable fixture, will render the shared action, choice, badge,
disabled, focus, loading, and status variants. It must not appear as part of the
production clinical workspace.

The gallery and representative workflow screens will provide stable inputs for
screenshot-based visual regression tests. The reference will document intended
usage and accessibility behavior; it will not duplicate clinical workflow
guidance.

### Initial migration targets

The first implementation pass will address the most visible ambiguity without
changing workflow behavior:

1. Normalize enabled launcher actions across primary workflows and shared
   modules.
2. Move anesthesia entry modes and assessment responses from primary-action
   styling to the selected-choice contract.
3. Keep the persistent add affordance and explicit label on the anesthesia
   record action, but apply the primary-action treatment while it is available.
4. Reserve mint on that surface for the resulting recorded, ready, or completed
   feedback.
5. Narrow or replace ambiguous shared variants such as `info` and `success`,
   then migrate other surface families incrementally rather than through a
   global class rewrite.

These visual changes must not alter clinical workflow logic, event semantics,
validation, generated note content, or persistence behavior.

Implementation should include:

- focused rendering tests for semantic variants;
- visual snapshots of representative launchers, choice controls, record
  actions, and status badges in light and dark modes;
- manual checks for hover, pressed, focus-visible, touch, disabled, selected,
  loading, zoom, and high-contrast behavior; and
- `npm run typecheck`, `npm test`, `npm run build`, and `npm run docs:check`.
