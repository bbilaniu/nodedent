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

## Current Implementation Status

This roadmap has already been partially executed on `codex/verify-endo-guide-refactor`.

Completed commits that should be treated as baseline:

```text
28f5cff test(endo-guide): verify refactored decision engine and note output
1d340d6 feat(endo-guide): add post-shaping cone fit handoff
2ffc289 test(endo-guide): verify protocol graph integrity
66e9d31 fix(endo-guide): validate sealer handoff requirements
534f777 test(endo-guide): require fragments for protocol events
1dec453 ready-for-sealer-cone-seating through drying, patency, sealer placement, paper point, sealer re-application, and GP cone seating.
a4cefb5 feat(endo-guide): add phase-aware canal handoffs
```

Implemented and verified:

```text
- Refactored guide architecture under src/endo-guide/.
- Engine/notes modules are separated from React/browser dependencies.
- JSON export/import preserves canals, measurements, radiograph statuses, events, closure, difficulty, and next-visit plan.
- Protocol graph integrity test ensures every option nextNodeId resolves.
- Handoff-node allowlist verifies intentional handoff nodes.
- Every protocol noteEvent now has an eventFragment.
- Post-shaping path reaches the sealer/cone seating handoff:
  shaping -> EDTA -> final NaOCl -> obturation gauge -> master cone -> cone-fit PA -> ready-for-sealer-cone-seating.
- ready-for-sealer-cone-seating validates cone fit PA status, master cone, and shaping length.
- Cone short/long troubleshooting loops are verified at the protocol-routing level.
- Cone-fit-ready canals resume at ready-for-sealer-cone-seating.
- Obturation gauge alternate branches are verified for size 30 beyond, size 30 short, size 25 stop, size 25 beyond, size 25 short, larger-gauge stop, and larger-gauge loop.
- Smear-layer and final NaOCl deferred routes are verified through medication/temporary closure pathways.
- Realistic PR 2 note output is verified for EDTA, NaOCl, obturation gauge, master cone, and cone-fit PA.
- Sealer and cone seating workflow is verified from ready-for-sealer-cone-seating through drying, patency confirmation, sealer placement, paper point through sealer, sealer re-application, and GP cone seating.
- Sealer troubleshooting routes are verified for wet canal, persistent wet canal, unsafe NaviTip placement, paper point short, sealer re-application unsafe, and GP cone short/long after sealer.
- Persistent wet canal can route to calcium hydroxide and temporary closure.
- Downpack/backfill workflow is verified through no-gap searing/vertical compaction and modified downpack/backfill/compact-backfill paths.
- Downpack/backfill branch connectivity is verified for no-gap, round/ovoid gap, modified downpack, accessory cones, vertical compaction, reapply-sealer-on-GP, backfill, and compact-backfill.
- Canal status now waits for final obturation completion outcomes; backfill.completed alone no longer marks the canal complete.
- Phase-aware canal handoff menus are implemented at earlier endodontic handoff nodes and preserve the late obturation/sealer handoffs.
- Canal switch events include previous/next canal, previous/next node, and phase labels while preserving legacy switch-event detail fields.
- Closure guard blocks final chamber cleanup when another canal is still active/incomplete.
- Closure, temporary closure, medicated/temporized, referred, and completed RCT states are covered by tests.
```

Known remaining gaps before later roadmap PRs:

```text
- Multi-visit resume, clinical fixture scenarios, note ergonomics, and usability polish remain future work.
```

## Recommended PR Sequence

```text
1. COMPLETE - Verify current refactor baseline
2. COMPLETE - Harden disinfection, obturation gauging, and cone-fit workflow
3. COMPLETE - Finish PR 2 alternate-branch verification
4. COMPLETE - Harden sealer and cone seating workflow
5. COMPLETE - Harden downpack, backfill, and canal obturation completion
6. COMPLETE - Add phase-aware multi-canal handoff menus
7. COMPLETE - Harden closure, post-op, and case-completion workflow
8. Add multi-visit pause/resume workflow
9. Add clinical scenario regression fixtures
10. Improve note templates and export ergonomics
11. Polish chairside usability
12. Only then consider framework generalization
```

## PR 1 - Verify Current Refactor Baseline - COMPLETE

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

Status:

```text
Complete. Baseline verification exists in 28f5cff and later protocol hardening commits.
```

## PR 2 - Harden Disinfection, Obturation Gauging, And Cone Fit - COMPLETE

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

Completed:

```text
- Shaped-canal post-shaping path is implemented and tested through EDTA, final NaOCl, obturation gauging, master cone, cone-fit PA, and ready-for-sealer-cone-seating.
- ready-for-sealer-cone-seating node exists and is a handoff node.
- ready-for-sealer-cone-seating validates cone fit PA status, master cone, and shaping length.
- Note fragments cover all protocol noteEvent types, including disinfection, gauge, master cone, and cone-fit outcomes.
- Cone-fit-ready canal continuation maps to ready-for-sealer-cone-seating.
- Protocol graph integrity and note-fragment coverage tests are in place.
- PR 2B adds alternate obturation-gauge branch coverage, deferred-route coverage, and realistic compact/full note assertions.
```

Remaining PR 2 gaps:

```text
- None currently known from the PR 2 scope.
```

Acceptance criteria:

```text
- A shaped canal can move through EDTA, NaOCl, obturation gauging, cone fitting, and acceptable cone-fit radiograph.
- Short/long cone troubleshooting does not dead-end.
- A deferred wet canal routes to medication/temporary closure.
- Compact note and full note include the important disinfection, gauge, master cone, and cone-fit facts.
- Tests cover the happy path and short/long troubleshooting loops.
```

## PR 2B - Finish Obturation Gauging And Deferred-Route Verification - COMPLETE

```git
test(endo-guide): verify obturation gauge alternate branches
```

Scope:

```text
- Exercise size 30 advances beyond to larger-gauge loop.
- Exercise size 30 short to size 25.
- Exercise size 25 reaches and records gauge.
- Exercise size 25 advances beyond to larger-gauge loop.
- Exercise size 25 short returning to patency/shaping.
- Exercise final NaOCl cannot-complete-today and smear-layer deferral to medication/temporary closure.
- Verify compact/full notes for a realistic PR 2 case include EDTA, NaOCl, gauge, master cone, and cone-fit PA.
```

Completed:

```text
- Size 30 advances beyond routes to gauge-obturation-larger and applies caution difficulty.
- Size 30 short routes to gauge-obturation-25 and applies caution difficulty.
- Size 25 stop routes to record-obturation-gauge.
- Size 25 advances beyond routes to gauge-obturation-larger and applies caution difficulty.
- Size 25 short routes to patency-10c and applies high difficulty.
- Larger gauge stop routes to record-obturation-gauge.
- Larger gauge continues beyond loops to gauge-obturation-larger.
- Alternate gauge branches enforce shaping length or obturation gauge where required.
- Smear-layer deferral and EDTA agitation deferral route to calcium hydroxide and temporary closure.
- Final NaOCl cannot-complete-today routes to persistent-wet, then calcium hydroxide.
- Compact/full notes for a realistic PR 2 case include EDTA, NaOCl, gauge, master cone, and cone-fit PA.
```

Acceptance criteria:

```text
- All PR 2 alternate branches route to existing, clinically meaningful nodes.
- Deferred wet/disinfection paths generate medication/temporary-closure events and notes.
- No clinical routing is changed unless a test exposes a clear bug.
```

## PR 3A - Harden Sealer And Cone Seating Workflow - COMPLETE

```git
test(endo-guide): verify sealer and cone seating workflow
```

Scope:

```text
- Start from ready-for-sealer-cone-seating.
- Verify dry/slightly damp canal proceeds to patency-before-sealer.
- Verify wet paper point loops to drying.
- Verify persistent wet canal routes to calcium hydroxide and temporary closure.
- Verify patency check immediately before sealer.
- Verify bioceramic sealer placement with passive NaviTip withdrawal.
- Verify NaviTip unsafe route.
- Verify paper point through sealer and sealer re-application.
- Verify seating the pre-fit GP cone.
- Verify GP cone short after sealer routes to patency-before-sealer.
- Verify GP cone long after sealer routes safely back to obturation gauging.
```

Completed:

```text
- ready-for-sealer-cone-seating can continue through dry/slightly damp drying, patency confirmation, sealer placement, paper point through sealer, sealer re-application, and GP cone seating.
- Full note coverage is verified for drying, sealer placement, paper point distribution, and GP cone seating.
- Drying validation blocks dry/slightly damp selection when drying status is wet.
- Wet paper point loops back to drying.
- Persistent wet canal routes to calcium hydroxide and temporary closure.
- Unsafe NaviTip placement and unsafe sealer re-application route to calcium hydroxide.
- Paper point short and GP cone short after sealer route back to patency-before-sealer.
- GP cone long after sealer routes back to obturation gauging.
```

Acceptance criteria:

```text
- A cone-fit-ready canal can move from handoff through sealer placement and GP cone seating.
- Troubleshooting branches return to clinically meaningful nodes.
- Required fields for drying, patency, sealer, and cone seating are enforced where needed.
- Full note documents drying, sealer placement, paper point distribution, sealer re-application, and GP cone seating.
```

## PR 3B - Harden Downpack, Backfill, And Canal Obturation Completion - COMPLETE

```git
test(endo-guide): verify downpack and backfill completion workflow
```

Scope:

```text
- Verify no-gap branch proceeds to sear GP.
- Verify round/ovoid gap branches route through modified downpack or accessory cones.
- Verify modified downpack success, repeat, and cone-moved routes.
- Verify accessory cone success and difficulty routes.
- Verify searing and vertical compaction.
- Verify reapply-sealer-on-GP before backfill.
- Verify backfill success, difficulty, apical GP movement, excess GP in chamber, and plugger-hole branches.
- Verify canal status becomes complete only after active canal obturation workflow is complete.
```

Completed:

```text
- No-gap branch is verified through GP searing and vertical compaction to canal-obturation-complete.
- Modified downpack/backfill path is verified through reapply-sealer-on-GP, backfill, compact-backfill, and canal-obturation-complete.
- Branch connectivity is verified for no-gap, round/ovoid gap, modified downpack, accessory cones, vertical compaction, backfill, and compact-backfill routes.
- Full note coverage is verified for vertical compaction and compacted backfill completion.
- Canal status no longer treats backfill.completed alone as complete.
- Canal status treats backfill.compactedStable, backfill.excessInChamber, and downpack.gpStableAfterCompaction as complete.
```

Acceptance criteria:

```text
- A seated GP cone can proceed through downpack/backfill to canal-obturation-complete.
- Downpack/backfill troubleshooting branches do not dead-end.
- Full note documents downpack, backfill, and canal obturation completion.
- Status derivation distinguishes cone-fit-ready, sealer-started, and completed canals as accurately as current status vocabulary allows.
```

## Original PR 3 - Harden Sealer, Cone Seating, Downpack, And Backfill - SPLIT INTO PR 3A/3B

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

## Phase-Aware Multi-Canal Handoffs - COMPLETE

```git
feat(endo-guide): add phase-aware canal handoffs
```

Completed:

```text
- Added phase-aware canal targets at earlier handoff nodes.
- Preserved existing late obturation and sealer/cone seating handoff behavior.
- Added canal-specific, phase-specific target labels.
- Added canonical workflow.switchedCanal details for previous/next canal, previous/next node, and phase label.
- Kept legacy switch-event detail fields for compatibility.
- Added tests for early handoff targets, late handoff preservation, switch-event notes, and resume inference.
```

Acceptance criteria:

```text
- A clinician can switch existing canals at phase handoffs without creating a new canal.
- Existing Add new canal behavior remains separate.
- Switching canals preserves measurements and events.
- Full note/event narrative includes the canal switch.
```

## PR 4 - Harden Closure, Post-Op, And Completion - COMPLETE

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

Completed:

```text
- Added getCanalsBlockingClosure() and canal-obturation-complete validation.
- Final chamber cleanup is blocked when another canal is not started, estimated, scouted, WL-established, glide-path, shaped, or disinfected.
- Closure is allowed when other canals are complete, paused, medicated, or referred.
- Completed RCT closure is verified through cleanup, rinse, and final restoration.
- Temporary closure after completed obturation remains RCT completed.
- Medicated temporary closure remains Medicated and temporized instead of being mislabeled complete.
- Referred cases remain Referred in notes and JSON export.
- JSON export preserves closure type and derived case status.
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
