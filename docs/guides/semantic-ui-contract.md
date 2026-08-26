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
`secondaryDecision` for the larger bottom-of-form decision treatment, and the
corresponding `warningDecision` or `destructiveDecision` when consequence
overrides ordinary prominence.

### Dialogs

Use `semanticDialogSurface` for the overlay and elevated panel. A modal surface
must expose `role="dialog"` (or `role="alertdialog"` for a confirmation that
requires immediate attention), `aria-modal="true"`, and a label relationship to
its visible title. A visible Close or Cancel action uses the secondary action
contract. The other actions retain their ordinary semantic roles: being inside
a dialog does not make a routine action a warning, and a warning path does not
become destructive unless it irreversibly removes data.

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
| Case Entry | Continue or first New case is primary; alternate case, saved-case, import, download, and lock actions use the shared secondary contract; storage warnings use the attention tone | Verify vault-entry variants whenever recovery or case-library actions change |
| Case Setup | Workflow inclusion uses blue selection surfaces and `aria-pressed`; Open workflow is primary; removal and suggested-status actions are secondary; plaintext download is warning; form focus is blue | Preserve workflow-owned setup boundaries and migrate any new Case Setup controls through these contracts |
| Application chrome | Header actions use the shared action hierarchy; vault state uses explicit positive, attention, neutral, or danger status; footer navigation uses the shared blue focus treatment | Preserve one principal header action and classify future global actions by prominence or consequence |
| Shared banners and notices | Deployment, sandbox, clinical-data, storage, configuration-error, and difficulty surfaces use shared non-interactive status contracts; banner navigation is secondary and plaintext export is warning | Keep specialized workflow instructions in their owning surface while migrating equivalent feedback incrementally |
| Workflow targets | Active canal cards use blue selection, `aria-pressed`, and a visible check while the canal's clinical status remains a separate labeled badge; target forms use blue focus | Preserve phase-specific canal status colors and workflow-owned target structures |
| History and output | Event history uses ordered-list and time semantics; output-format tabs use selection rather than action styling; read-only output has visible blue focus; plaintext copy and download actions are warnings | Preserve generated-note content and export behavior while migrating any future output formats through the same contract |
| Tables and administrative rows | Catalogue and encrypted-recovery row collections use explicit list structure, shared compact actions, and semantic feedback; no clinical data table currently requires a separate HTML table primitive | Introduce a table primitive only when column relationships materially require one; retain responsive row/card layouts otherwise |
| Dialogs and confirmations | Shared modal frames expose dialog semantics and labelled titles; visible dismissal is secondary; new-case confirmation retains a primary continuation action; saved-case deletion/reset actions are destructive | Preserve focus management and escape behavior when dialog infrastructure changes |
| End-visit and phase/canal map | Stop choices use decision-sized primary or warning actions; referral remains a warning route rather than a destructive action; phase/canal selection is separate from the phase-progress badge | Preserve workflow transitions, required next-visit plans, and phase-derived status logic |
| Other surface refinements | No remaining major surface family is deferred; component-local cleanup continues incrementally as touched | Apply the same contracts to new controls and remove unexplained one-off styling without global rewrites |

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

Second surface pass on 2026-08-25:

- Case Entry and Case Setup actions were migrated from repeated local classes to the shared action contracts;
- treatment-workflow inclusion moved from mint status styling to blue selection styling with programmatic pressed state;
- Case Setup launch, removal, plaintext-download, and form-focus roles were separated explicitly; and
- the development fixture and focused rendering tests were extended for selected setup surfaces and semantic form controls;
- the fixture had no horizontal overflow at 320 px in light or dark mode, and selection and primary-action colors remained distinct; and
- all 184 tests, the production build, documentation checks, and versioning checks passed.

Third surface pass on 2026-08-25:

- application chrome and reusable notices moved to explicit semantic status surfaces without changing their visible status wording;
- auxiliary phase-map navigation became secondary, while plaintext export retained warning consequence styling;
- the chrome fixture had no horizontal overflow at 320 px in light or dark mode, action and status surfaces remained visually distinct, and the browser console reported no errors; and
- all 185 tests, the production build, documentation checks, and versioning checks passed.

Fourth surface pass on 2026-08-25:

- active target and output-format selection moved from solid primary-action styling to blue selection with programmatic state and visible check indicators;
- canal status, event and recovery history, catalogue rows, read-only output focus, and plaintext action consequences remain separate dimensions;
- the dense-surface fixture had no horizontal overflow at 320 px in light or dark mode, target selection and positive clinical status remained visually distinct, and the browser console reported no errors; and
- all 188 tests, the production build, documentation checks, and versioning checks passed.

Fifth surface pass on 2026-08-25:

- workflow, saved-case, prior-visit, phase/canal-map, new-case, and end-visit
  dialogs use a shared modal frame with programmatic dialog names;
- end-visit actions use the large decision hierarchy, destructive case-library
  actions remain red, and referral/medication routes remain warning actions;
- phase and canal selection uses blue selected-choice semantics while current,
  recorded, and not-recorded phase progress remains a separate labeled status;
- the dialog fixture was visually inspected in light and dark modes at the
  available wide-desktop viewport, with no document overflow or application
  console errors; and
- focused semantic rendering tests, all 189 tests, documentation checks, type
  checking, the production build, deployment/security checks, and versioning
  checks passed.
