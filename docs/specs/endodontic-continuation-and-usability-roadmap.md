---
status: active
created_on: 2026-06-19
---

# Endodontic Continuation And Usability Roadmap

This spec preserves the remaining active endodontic work from the historical continued-development roadmap after the completed PR sequence was archived.

The goal is to improve endodontic continuity, regression coverage, note output, and chairside ergonomics without re-opening already completed protocol hardening work.

## Context

The endodontic guide already has a data-driven workflow under `src/nodedent/`, with protocol data, decision engine logic, note/export builders, schemas, state, and React components separated.

Completed baseline work includes:

- refactored NodeDent architecture under `src/nodedent/`
- protocol graph integrity tests
- note-fragment coverage tests
- disinfection, obturation gauging, cone-fit, sealer, cone seating, downpack, backfill, closure, and completion workflow hardening
- phase-aware multi-canal handoff menus
- closure guards that block final chamber cleanup while other canals are still active or incomplete
- coverage for completed, temporary, medicated/temporized, referred, and completed-RCT states

The remaining endodontic work should preserve the existing architecture:

```text
Protocol data -> decision engine -> UI components -> note/export builders
```

Do not put new clinical branch logic directly inside React components. When adding or changing a protocol step, update the protocol node, validation/guards, note fragments, status derivation, export/import behavior, and tests together.

## Goals

- Add multi-visit pause/resume support without fabricating prior in-app clinical events.
- Add clinical scenario regression fixtures for realistic full-case flows.
- Improve note templates and export ergonomics.
- Polish chairside usability for active canal, current phase, required fields, and recovery actions.

## Non-Goals

- Do not generalize the endodontic protocol engine in this spec.
- Do not add new clinical recommendations without source-backed protocol work.
- Do not treat undocumented prior care as if it happened in the current app session.
- Do not replace the existing shared workflow/module architecture decisions in ADR 0004.

## Current Remaining Gaps

- Multi-visit resume and prior undocumented visit continuation are not yet modeled cleanly.
- Realistic clinical scenario fixtures are still needed beyond focused protocol branch tests.
- Notes and exports need ergonomic review for common completed, initiated, medicated, and referred cases.
- Chairside UI needs another pass for scanability, error placement, undo/recovery, and responsive layout polish.

## Phase 1: Multi-Visit Pause And Resume Workflow

Reasoning level needed: high. This work changes case continuity and must clearly separate historical prior treatment from events recorded during the current app session.

Clinical edge case to support:

```text
A clinician may complete a later visit in the app after the tooth was previously opened,
medicated, and temporized outside the app or before the app workflow was used.
```

Decision:

```text
Do not pretend this was an in-app pause/resume event.

Model it as an external prior visit or historical continuation. The app should let the
clinician summarize known prior treatment facts, choose the appropriate clinical resume
point, and clearly separate prior-visit history from today's system-recorded events in
notes, JSON export, and tests.
```

Scope:

- Let the clinician pause a case with a next-visit plan.
- Let the clinician start or resume from a prior undocumented visit without requiring fake protocol events.
- Track per-canal state when some canals are complete and others are medicated or unfinished.
- Resume at the best next protocol node for each canal.
- Make continuation actions explicit and clinically meaningful.
- Add a next-visit note template.
- Add a prior-visit summary section for externally documented treatment history.
- Preserve pause/resume state through local persistence and JSON import/export.

Prior undocumented visit behavior:

- Add an explicit `Continue from prior visit` or equivalent case-start action.
- Capture prior facts as historical metadata, not as today's generated protocol events.
- Minimum useful prior facts:
  - prior access completed
  - canals previously located or treated
  - prior WL or estimated WL if known
  - prior shaping or disinfection state if known
  - medication placed, if known
  - temporary restoration or closure type, if known
  - prior visit date or approximate timing, if known
  - free-text prior-visit note or source
- Let the clinician select the resume point when derived state is incomplete or uncertain.
- Prefer conservative resume points when prior facts are uncertain.
- Preserve historical prior-visit facts through local persistence and JSON import/export.
- Note output must label these facts as prior history or previous visit, not as actions performed today.

Fast-forward rules:

- Fast-forward creates historical prior-state metadata and a single `case.continuedFromPriorVisit` marker.
- Fast-forward must not create detailed protocol events such as WL established, shaped, EDTA completed, cone fit PA taken, or medication placed unless those actions happen during the current system-recorded visit.
- Fast-forwarded canal status should display as historical or externally documented until the clinician performs or reconfirms the relevant step today.
- Unknown prior details should route earlier, not later.
- High-risk resume points such as cone-fit-ready or partially obturated require explicit confirmation and enough supporting details to avoid accidental over-advancement.

Acceptance criteria:

- A case can be paused after access, working length, shaping, disinfection, cone fit, medication, or partial obturation.
- A case can be continued from a prior undocumented temporization or medication visit and completed today without fabricating prior in-app events.
- Resume chooses the correct next node for each canal without losing measurements.
- The generated note includes what was completed today, what remains, and any prior-visit history in a clearly separated section.
- JSON export/import distinguishes in-app pause/resume state from external prior-visit history.
- Tests cover pause/resume from at least access, shaped, cone-fit-ready, medicated, and partially obturated states.
- Tests cover completing an RCT today after prior undocumented medicated/temporized care.

## Phase 2: Clinical Scenario Regression Fixtures

Reasoning level needed: medium-high. Existing tests cover focused branches; scenario fixtures should catch workflow regressions across realistic complete cases.

Scope:

- Add scenario fixtures that exercise realistic full case flows.
- Keep fixtures small enough to understand and maintain.
- Use fixtures to verify transition path, final case status, events, notes, and JSON export.

Minimum scenarios:

- Single-canal straightforward RCT completed.
- Molar with four canals completed.
- Canal short during scouting, then successful after troubleshooting.
- Available treatment space less than or equal to 16 mm high-difficulty branch.
- Persistent wet canal medicated and temporized.
- Cone short corrected with smaller cone.
- Cone long corrected by trimming.
- GP cone does not seat after sealer and returns to patency.
- One canal complete while another is paused or medicated.
- Referral pathway.

Acceptance criteria:

- Scenario tests catch broken node IDs, missing note fragments, missing required validations, and incorrect status derivation.
- Fixture failures are readable enough to identify the broken protocol phase.

## Phase 3: Note Templates And Export Ergonomics

Reasoning level needed: medium. Output should become more useful without turning generated notes into raw event dumps or inventing clinical meaning.

Scope:

- Compact note.
- Full procedure note.
- Patient-friendly summary.
- Specialist referral note.
- Next-visit or continuation note.
- Markdown export.
- Structured JSON export.
- Copy-to-clipboard variants.

Leave PDF export for later unless the app already has a proven markdown-to-PDF or print utility.

Acceptance criteria:

- Notes are chart-ready for common completed, initiated, medicated, and referred cases.
- Compact note stays brief.
- Full note includes clinically important events without becoming a raw event dump.
- JSON export remains stable and machine-readable.

## Phase 4: Chairside Usability Polish

Reasoning level needed: medium. This phase should improve clinical ergonomics without changing protocol semantics.

Scope:

- Make active canal, current phase, current measurements, and next action easy to scan.
- Improve required-field error placement and wording.
- Improve undo/recovery affordances.
- Keep the responsive 1-, 2-, 3-, and 4-column layouts working.
- Avoid adding explanatory marketing text inside the app.
- Prefer clinically meaningful action labels over generic continue/next/done labels.

Acceptance criteria:

- The app remains usable on tablet and desktop chairside layouts.
- Buttons and status labels do not overflow on small screens.
- The clinician can tell where they are, what has been established, and what still needs to be done.

## Deferred Work

- Generalizing the endodontic protocol engine beyond current NodeDent workflow architecture.
- Protocol authoring helpers beyond the current graph integrity and note-fragment checks.
- New clinical guides such as pulp diagnosis.

These deferred items should become separate specs only when they are ready for implementation.
