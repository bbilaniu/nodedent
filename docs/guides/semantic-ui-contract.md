# Semantic UI Contract

This guide is the engineering reference for the first implementation pass of
[ADR 0013](../adr/0013-separate-action-selection-and-clinical-state-color-semantics.md).
The ADR remains proposed; this guide records the implemented contract without
changing the decision's lifecycle status. Clinical workflow guidance remains in
the source material and workflow specifications.

## Independent Dimensions

Choose each dimension independently. A control may be a primary action inside a
shared module, a selected choice inside a primary workflow, or a warning action
that leads to an attention status.

| Dimension | Values | Communicates | Must not communicate |
| --- | --- | --- | --- |
| Action | Primary, secondary, warning, destructive | Prominence or consequence in the current surface | Workflow category or current selection |
| Selection | Selected, unselected, disabled | Current choice, mode, tab, or multi-select value | Action prominence or positive clinical state |
| Status | Positive, attention, neutral, difficulty, danger | Recorded workflow or clinical state | Clickability or selection |
| Content category | Headings, labels, descriptions, grouping | Primary workflow, shared module, setup, history, or output | Action hierarchy |

## Component And State Matrix

### Actions

All action roles include a 44-pixel minimum target at the default size, a blue
`focus-visible` outline, a same-family pressed state without layout movement,
and a neutral disabled treatment.

| Role | Rest | Hover | Pressed | Focus visible | Disabled | Loading |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | Solid navy, white text | Darker navy | Darker navy plus inset depth | Blue offset outline | Neutral surface and text; native `disabled` when unavailable | Preserve role, show spinner/progress text, set `aria-busy="true"` and prevent activation |
| Secondary | White/quiet surface, neutral border, navy text | Blue border and light surface | Neutral tinted surface | Blue offset outline | Neutral surface and text | Same loading semantics as primary |
| Warning | Amber surface and explicit caution wording | Stronger amber | Stronger amber | Blue offset outline | Neutral surface and text | Same loading semantics as primary |
| Destructive | Solid red and explicit destructive wording | Darker red | Darker red plus inset depth | Blue offset outline | Neutral surface and text | Same loading semantics as primary |

Use `semanticActionButton` from
`src/nodedent/components/uiStyles.ts`. Use `primaryDecision` or
`secondaryDecision` for the larger bottom-of-form decision treatment. Warning
or destructive consequence overrides ordinary prominence.

### Choice controls

| State | Visible treatment | Programmatic state | Non-color cue |
| --- | --- | --- | --- |
| Selected | Blue-tinted surface, strong blue border, navy text | Native selection or `aria-pressed="true"` | Filled circular check indicator |
| Unselected | Quiet white surface and neutral border | Native selection or `aria-pressed="false"` | Empty circular indicator |
| Disabled | Neutral muted treatment | Native `disabled`; associate a reason when it is not evident | Disabled shape and explanatory text |
| Focus visible | Blue offset outline in addition to selected/unselected state | Browser focus | Outline remains distinct from border and check |

Use `semanticChoiceControl` and render its indicator alongside a visible label.
Do not use solid navy or mint merely because a choice is selected.

### Status

| Role | Family | Examples |
| --- | --- | --- |
| Positive | Mint | Ready, recorded, completed |
| Attention | Amber | Review, reassessment required, caution |
| Neutral | Slate | Pending, not started, unavailable |
| Difficulty | Orange | Existing high-difficulty clinical state |
| Danger | Red | Error, referral, serious validation state |

Use `semanticStatusTone` for a status surface and combine it with
`statusBadge.base` for a badge. Status elements require visible text; color is
supplementary.

## First-Pass Surface Inventory

| Surface family | First-pass result | Follow-up boundary |
| --- | --- | --- |
| Primary-workflow and shared-module launcher cards | Principal enabled actions share the primary contract; headings and descriptions retain category | Audit quick actions and less prominent launcher-adjacent actions with real content |
| Anesthesia | Entry mode, route, and adequacy choices use selection semantics; record action is primary; recorded feedback remains mint | Exercise all validation and long-label combinations at supported widths |
| Isolation | Entry modes use selection semantics and the clinical record action is primary | Classify warning overrides for compromised or removal documentation during the isolation surface pass |
| Radiology | Modality multi-select uses selection semantics and the record action is primary | Consolidate its remaining form layout during the radiology surface pass |
| Shared status summaries | Positive, attention, and neutral styling comes from `semanticStatusTone` | Migrate remaining component-local status combinations by surface family |
| Shared controls | Shared button and form-control focus moved to blue; ambiguous shared `info`, `mint`, and `success` action variants were removed | Migrate remaining component-local mint focus styles and solid-navy selectors incrementally |
| Other major surfaces | Inventoried as deferred: application chrome, setup, targets, history, output, dialogs, tables, banners, and end-visit controls | Migrate and verify one surface family at a time; do not perform an unexplained global rewrite |

No event construction, workflow transition, validation, generated note,
persistence, or clinical source behavior is changed by this pass.

## Development Fixture

During `npm run dev`, open:

```text
http://127.0.0.1:5173/?theme=light#/dev/semantic-ui
http://127.0.0.1:5173/?theme=dark#/dev/semantic-ui
```

The fixture is dynamically imported only when `import.meta.env.DEV` is true and
does not appear in the production clinical workspace. It renders synthetic
examples of action roles, selection, status, focus, disabled, loading,
equivalent launcher actions, and a record-to-status transition. The same route
is the stable visual snapshot input.

Capture or compare the full page in both themes at these CSS viewport widths:

- 320 px: narrow phone and wrapping behavior;
- 768 px: tablet breakpoint;
- 1280 px: laptop/desktop matrix; and
- 1536 px: wide desktop.

For interaction evidence, inspect real hover, pressed, and keyboard focus in
both themes. At 200% zoom, content must reflow without horizontal page
scrolling. In forced-colors/high-contrast mode, labels, native state, checkmarks,
focus, and disabled reasons must remain understandable when authored colors are
replaced.

## Review Checklist

- An enabled primary-workflow launcher and enabled shared-module launcher have
  identical rest, hover, pressed, focus, and disabled contracts.
- A selected choice cannot be mistaken for a primary action and exposes native
  or ARIA selection state.
- A status cannot be mistaken for an enabled action.
- Focus remains visible independently of hover and selection.
- Disabled and loading states expose text or programmatic state in addition to
  color.
- Warning and destructive actions retain consequence semantics even when they
  are the only action in a surface.
- Light and dark rendering preserve the same meaning at phone, tablet, laptop,
  and wide-desktop widths.

## First-Pass Verification Evidence

Verified on 2026-08-24:

- the synthetic fixture was visually inspected in light and dark modes at the
  default wide-desktop viewport and at explicit 320 px and 768 px widths;
- the 320 px and 768 px checks had no horizontal document overflow;
- primary hover changed from navy to darker navy in both themes without
  inverting to an outline, and selected-choice hover remained in the selection
  family;
- keyboard focus computed as a two-pixel solid blue outline, the default action
  target measured 44 pixels high, and dark disabled controls remained neutral;
- the browser console reported no errors; and
- focused semantic rendering tests, the full test suite, documentation checks,
  type checking, and the production build passed. The production bundle did
  not contain the development fixture text.
