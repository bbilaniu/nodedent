# Endodontic Guide Continued Development Roadmap

Use this file to continue developing the app after the MVP/refactor work. The next phase should stay focused on making the **endodontic chairside guide** clinically complete, testable, and usable. Do not generalize into a broader clinical-guide framework until the endodontic workflow works end-to-end.

## Current Baseline

The app is already organized as a data-driven endodontic guide:

```text
src/endo-guide/
  protocol/
  engine/
  schemas/
  notes/
  components/
  state/
```

Future work should preserve that separation:

```text
Protocol data -> decision engine -> UI components -> note/export builders
```

Do not put new clinical branch logic directly inside React components. When adding a protocol step, update the protocol node, validation/guards, note fragments, status derivation, export/import behavior, and tests together.

## Recommended PR Sequence

```text
1. Verify current refactor baseline
2. Harden disinfection, obturation gauging, and cone-fit workflow
3. Harden sealer, cone seating, downpack, and backfill workflow
4. Harden closure, post-op, and case-completion workflow
5. Add multi-visit pause/resume workflow
6. Add clinical scenario regression fixtures
7. Improve note templates and export ergonomics
8. Polish chairside usability
9. Only then consider framework generalization
```

## PR 1 - Verify Current Refactor Baseline

```git
test(endo-guide): verify refactored guide baseline
```

Scope:

```text
- Run typecheck, tests, and build.
- Review protocol node reachability.
- Confirm current UI still supports the chairside workflow.
- Confirm JSON import/export preserves canals, measurements, events, radiograph statuses, closure, and next-visit plan.
- Confirm local persistence still hydrates a usable case.
```

Acceptance criteria:

```text
npm run typecheck
npm run test
npm run build
git diff --check
```

No clinical expansion should happen in this PR unless a failing test exposes an actual baseline bug.

## PR 2 - Harden Disinfection, Obturation Gauging, And Cone Fit

```git
feat(endo-guide): harden disinfection and cone-fit workflow
```

Scope:

```text
- Verify smear-layer removal from shaped canal to EDTA agitation.
- Verify final NaOCl disinfection can either proceed to obturation gauging or defer to medication/temporization.
- Verify obturation gauging branches:
  - size 30 reaches and does not advance beyond
  - size 30 advances beyond
  - size 30 short
  - size 25 reaches
  - size 25 advances beyond
  - size 25 short returns to patency/shaping
  - larger gauge loop
- Verify master cone branches:
  - cone fits
  - cone short
  - cone long
  - smaller cone fit
  - trimmed cone fit
  - cone-fit radiograph acceptable/short/long
- Require and validate obturation gauge, master cone, shaping length, reference point where clinically needed.
- Ensure note fragments document disinfection, gauge, master cone, and cone-fit radiograph outcomes.
- Ensure canal continuation maps a cone-fit-ready canal to the sealer/cone seating handoff.
```

Acceptance criteria:

```text
- A shaped canal can move through EDTA, NaOCl, obturation gauging, cone fitting, and acceptable cone-fit radiograph.
- Short/long cone troubleshooting does not dead-end.
- A deferred wet canal routes to medication/temporary closure.
- Compact note and full note include the important disinfection, gauge, master cone, and cone-fit facts.
- Tests cover the happy path and short/long troubleshooting loops.
```

## PR 3 - Harden Sealer, Cone Seating, Downpack, And Backfill

```git
feat(endo-guide): harden sealer and obturation completion workflow
```

Scope:

```text
- Verify drying workflow before sealer placement.
- Verify persistent wet canal routes to calcium hydroxide and temporary closure.
- Verify patency check immediately before sealer.
- Verify bioceramic sealer placement with passive NaviTip withdrawal.
- Verify paper point through sealer and sealer re-application.
- Verify seating the pre-fit GP cone.
- Verify cone short/long after sealer routes safely.
- Verify round/ovoid/no-gap branches after cone seating.
- Verify modified downpack, accessory cone, searing, vertical compaction, reapply-sealer, backfill, and compact-backfill branches.
- Ensure all downpack/backfill events have note fragments.
- Ensure canal status becomes complete only after the active canal obturation workflow is complete.
```

Acceptance criteria:

```text
- A cone-fit-ready canal can complete sealer placement, cone seating, downpack/backfill, and canal obturation completion.
- Troubleshooting branches return to clinically meaningful nodes.
- No active option points to a missing protocol node.
- Full note documents sealer, GP seating, downpack/backfill, and canal completion.
- Tests cover dry canal, persistent wet canal, cone seating failure, downpack, and backfill branches.
```

## PR 4 - Harden Closure, Post-Op, And Completion

```git
feat(endo-guide): harden closure and completion workflow
```

Scope:

```text
- Prevent final closure until all required canals are complete, paused, medicated, or intentionally referred.
- Support chamber cleanup after all canals are obturated.
- Support chamber rinse.
- Support closure choices:
  - sponge and temporary restoration
  - orifice barrier and temporary restoration
  - final restoration
- Add post-op instruction capture where useful.
- Ensure closure updates case status and note output.
- Ensure closure does not erase canal-specific events.
```

Acceptance criteria:

```text
- Multi-canal cases cannot accidentally close while untreated canals are still active unless the clinician explicitly pauses/medicates/refers them.
- Final note clearly distinguishes RCT completed, RCT initiated, medicated/temporized, and referred cases.
- JSON export includes closure type and next-visit/post-op plan.
- Tests cover complete, temporary, medicated, and referred closure states.
```

## PR 5 - Add Multi-Visit Pause/Resume Workflow

```git
feat(endo-guide): add multi-visit resume workflow
```

Scope:

```text
- Let the clinician pause a case with a next-visit plan.
- Track per-canal state when some canals are complete and others are medicated or unfinished.
- Resume at the best next protocol node for each canal.
- Make continuation actions explicit and clinically meaningful.
- Add a next-visit note template.
- Preserve pause/resume state through local persistence and JSON import/export.
```

Acceptance criteria:

```text
- A case can be paused after access, working length, shaping, disinfection, cone fit, medication, or partial obturation.
- Resume chooses the correct next node for each canal without losing measurements.
- The generated note includes what was completed today and what remains.
- Tests cover pause/resume from at least access, shaped, cone-fit-ready, medicated, and partially obturated states.
```

## PR 6 - Add Clinical Scenario Regression Fixtures

```git
test(endo-guide): add clinical scenario regression fixtures
```

Scope:

```text
- Add scenario fixtures that exercise realistic full case flows.
- Keep fixtures small enough to understand and maintain.
- Use fixtures to verify transition path, final case status, events, notes, and JSON export.
```

Minimum scenarios:

```text
- Single-canal straightforward RCT completed.
- Molar with four canals completed.
- Canal short during scouting, then successful after troubleshooting.
- Available treatment space <=16 mm high-difficulty branch.
- Persistent wet canal medicated and temporized.
- Cone short corrected with smaller cone.
- Cone long corrected by trimming.
- GP cone does not seat after sealer and returns to patency.
- One canal complete while another is paused/medicated.
- Referral pathway.
```

Acceptance criteria:

```text
- Scenario tests catch broken node IDs, missing note fragments, missing required validations, and incorrect status derivation.
- Fixture failures are readable enough to identify the broken protocol phase.
```

## PR 7 - Improve Note Templates And Export Ergonomics

```git
feat(endo-guide): improve clinical note and export outputs
```

Scope:

```text
- Compact note
- Full procedure note
- Patient-friendly summary
- Specialist referral note
- Next-visit / continuation note
- Markdown export
- Structured JSON export
- Copy-to-clipboard variants
```

Acceptance criteria:

```text
- Notes are chart-ready for common completed, initiated, medicated, and referred cases.
- Compact note stays brief.
- Full note includes clinically important events without becoming a raw event dump.
- JSON export remains stable and machine-readable.
```

Leave PDF export for later unless the app already has a proven markdown-to-PDF or print utility.

## PR 8 - Polish Chairside Usability

```git
feat(endo-guide): polish chairside workflow usability
```

Scope:

```text
- Make active canal, current phase, current measurements, and next action easy to scan.
- Improve required-field error placement and wording.
- Improve undo/recovery affordances.
- Keep the responsive 1-, 2-, 3-, and 4-column layouts working.
- Avoid adding explanatory marketing text inside the app.
- Prefer clinically meaningful action labels over generic continue/next/done labels.
```

Acceptance criteria:

```text
- The app remains usable on tablet and desktop chairside layouts.
- Buttons and status labels do not overflow on small screens.
- The clinician can tell where they are, what has been established, and what still needs to be done.
```

## Deferred Until The Endodontic App Is Stable

Only start this section after PRs 1-8 are complete and the endodontic guide has scenario coverage.

### Future PR - Generalize The Guide Engine

```git
refactor(clinical-guides): generalize decision engine beyond endodontics
```

Goal: make the engine reusable for other clinical guides without copying endodontic-specific logic everywhere.

Separate generic concepts from endodontic concepts:

```text
Generic:
- protocol nodes
- decision options
- guards
- events
- note fragments
- phase maps
- validation engine
- continuation pattern

Endodontic:
- canal records
- EAL / patency / shaping
- irrigation
- cone fit
- obturation
- closure
```

Do not perform this refactor while major endodontic behavior is still changing.

### Future PR - Add Protocol Authoring Helpers

```git
feat(clinical-guides): add protocol authoring utilities
```

Scope:

```text
- missing nextNodeId detection
- orphan node detection
- unreachable node detection
- required field validation checks
- event type consistency checks
- note-fragment coverage checks
- intentional terminal-node checks
- phase reachability checks
```

### Future PR - Start The Next Clinical Guide

The best next guide is probably pulp diagnosis because it feeds naturally into the endodontic workflow.

```git
feat(pulp-guide): add pulp diagnosis decision guide
```

Scope:

```text
- chief complaint
- pain history
- cold test
- percussion
- palpation
- bite test
- probing
- radiographic findings
- pulpal diagnosis
- apical diagnosis
- recommended treatment
- note output
```

Long-term integration:

```text
Pulp diagnosis
-> recommends endodontic treatment
-> starts endodontic chairside guide
-> generates procedure note
-> generates restoration / next-visit recommendation
```
