---
status: active
created_on: 2026-06-16
---

# NodeDent Long-Term Product Roadmap

This document captures long-term NodeDent product direction that is broader than the current endodontic workflow and the near-term generalized workflow node plan.

Use this file for product ideas that should not be forgotten, but are not ready to become implementation tasks.

## Relationship To Current Specs

- `docs/specs/archive/generalized-workflow-nodes.md` records the implemented architecture for reusable workflow modules, event-backed capabilities, Case Setup & Status, and embedded workflow UI. `docs/specs/archive/shared-anesthesia-module.md`, `docs/specs/archive/shared-isolation-module.md`, and `docs/specs/archive/shared-radiology-module.md` record the implemented shared anesthesia, shared isolation, and shared radiology modules.
- `docs/adr/0004-generalize-clinical-workflow-nodes.md` records the architecture decision behind reusable workflow modules.
- This roadmap tracks platform-level capabilities that should be revisited after the current event ledger, shared modules, and first non-endodontic workflow runner are stable.

## Long-Term Themes

### Shared Module And Workflow Pipeline

The shared anesthesia, isolation, and radiology modules are implemented for the current narrow scope. They use structured events, event-backed capabilities, embedded workflow entry points, and Case Setup & Status summaries without turning recorded values into clinical recommendations. Anesthesia and isolation also use local user-owned documentation catalogs.

The first usable non-endodontic primary workflow, operative direct restoration, is implemented as a focused workflow-specific runner. It reuses shared diagnosis, radiographs, anesthesia, and isolation context where appropriate, while owning operative-specific treatment targets such as teeth, surfaces, materials, shades, bonding/cementation details, and restoration outputs.

The initial cross-workflow label, readiness, target-panel, setup, runner, and hierarchy pass is complete and recorded in `docs/specs/archive/workspace-cross-workflow-consistency.md`. Broader visual consolidation remains active in `docs/specs/gui-consistency-and-design-system.md`.

The operative direct restoration runner should remain workflow-specific until another non-endodontic workflow repeats the same setup, readiness, record, and completion pattern. At that point, revisit whether a generic primary-workflow shell would reduce duplication without forcing all procedures through the same UI too early.

Event-backed workflow setup and output should remain the durable state boundary. Derived operative summaries, caches, or future multi-procedure state can be added for ergonomics, but notes, exports, and capability matching should remain traceable to structured clinical events.

Endodontic closure and operative final restoration placement should remain separate capabilities unless a future compatibility or workflow-switching spec defines how one satisfies or maps to the other.

Near-term follow-up should avoid expanding anesthesia into source-backed clinical decision support until those rules have their own evidence-backed spec or ADR.

### Future Radiology And Imaging

The first shared radiology module is implemented and archived in `docs/specs/archive/shared-radiology-module.md`. It records clinician-entered radiograph review events and satisfies the shared `radiographs.reviewed` capability without interpreting images or recommending imaging.

Future radiology and imaging work should include:

- image attachment management, image viewing, DICOM handling, or imaging-system integration
- intraoral photography or camera documentation as a future imaging-adjacent shared module or radiology-adjacent capability
- clinic-owned radiology documentation catalogs or shortcuts, if repeated radiology documentation patterns justify them
- source-backed imaging rules only after a dedicated evidence-backed ADR or active spec defines the rules and boundaries
- migration that removes or hides legacy pre-op radiograph case fields after compatibility is no longer needed

Radiology should remain documentation-oriented unless a future source-backed spec explicitly adds interpretation, adequacy, recency, or recommendation behavior.

### Clinical Documentation Catalogs

NodeDent now has a unified user-catalog persistence layer for anesthesia and isolation shortcuts, legacy preference migration, and patient-independent catalog export/import with additive conflict-safe merging.

Remaining catalog work includes:

- clinic and template catalog storage
- catalog sync across devices or clinic workspaces
- a broader global settings or catalog management workspace
- seeded/customizable catalogs for isolation methods, burs, endodontic file systems, filling materials, brands, shades, cements, bonding systems, and other reusable documentation vocabularies

Catalogs should remain documentation shortcuts unless a separate source-backed decision explicitly adds rule behavior. Product or shortcut selections should not infer adequacy, dose, timing, expiry, safety, or treatment recommendations.

Workflow fields should stay editable free text with suggestions until records show stable categories worth structuring. Restoration outcome is a current example: it can become a catalog-backed enum later, but early operative workflow slices should not prematurely close that vocabulary.

### Local Anesthesia Improvements

The shared anesthesia module should stay non-prescriptive by default, but future quality-of-life improvements may be useful:

- Add automatic timestamping or a `Set to now` control for anesthesia administration time.
- Consider automatic calculation of anesthetic dose in mg from anesthetic concentration and entered volume.
- Keep calculated dose behavior visible and reversible, and do not use it to infer safety, adequacy, expiry, or treatment recommendations without a separate source-backed ADR/spec.
- Add source-backed anesthesia timing or expiry rules only after a dedicated source review documents what rules are being applied and why.

### Clinical Timeline And History Viewer

NodeDent should eventually include a clinical timeline or history viewer derived from the event ledger.

The viewer should help clinicians answer:

- What was done already?
- Which teeth, canals, or regions did it apply to?
- Is the information current, historical, or only useful for reference?
- Which workflow recorded or reused the event?

Candidate timeline content:

- anesthesia and sedation events, including technique, agent, dose, target tooth or region, adequacy, top-ups, timing, and reassessments
- isolation events, including technique, broad region, exposed teeth, clamp code, anchor tooth, floss ligatures or other supports, compromised isolation, replacement, and removal
- endodontic progress events, including access, canals located, working lengths, cleaning/shaping status, irrigation, medication, temporary closure, obturation, and final closure
- notes, exports, and case status changes

The viewer should be read-oriented by default. Clinical updates should append new events, while true data-entry mistakes should use explicit correction actions.

### Second-Appointment Endodontic Continuity

A key use case is seeing a patient for a second appointment on the same root canal treatment.

The app should make it easy to review the prior visit before continuing:

- original diagnosis and treatment plan
- tooth and canals involved
- which canals were located, measured, cleaned, shaped, medicated, obturated, or left incomplete
- prior working lengths and reference points
- medication placed and temporary closure status
- prior anesthesia and isolation history
- next-visit plan or referral notes

Prior anesthesia and isolation are usually historical by the second appointment rather than reusable current capabilities. They are still valuable context for planning today's appointment, documenting continuity, and comparing how treatment evolved over time.

Open design questions:

- Whether a resumed appointment should continue the same root workflow run or start a new workflow run linked to the same case/procedure.
- Whether NodeDent needs a separate `visitId` concept in addition to `workflowRunId`.
- How much prior-visit history should appear in Case Setup & Status versus a dedicated timeline view.

### Multi-Window And Multi-Screen Mode

NodeDent should eventually support an optional multi-window or multi-screen setup.

Candidate layout:

- primary screen: active clinical decision card
- secondary screen: Case Setup & Status, anesthesia/sedation, isolation, notes, or clinical timeline
- optional timeline screen: event history and evolution over time for the current case, tooth, or workflow

This should rely on the event ledger and derived selectors rather than duplicating state across windows. Multi-window support should wait until workflow runs, visit continuity, and shared module events have stable identifiers.

### Workflow Launcher And Case Home

NodeDent Home is implemented as the operational first screen before workflow activation and as a quick-switcher after activation. It no longer assumes that the endodontic protocol is always the root screen.

The launcher currently supports:

- starting or resuming a case
- returning to the most recent active workflow
- choosing a primary workflow
- opening standalone shared modules
- opening Case Setup & Status and saved-case management

Direct notes/export and a future timeline/history viewer remain candidate Home entry points.

The launcher should remain clinical and work-focused, not a marketing landing page.

Now that this launcher is the real entry point, continue decluttering the endodontic pre-op setup card. The current pre-op surface remains transitional and carries setup, resume, prior-visit, shared-readiness, module-launch, safety, validation, and decision responsibilities in one card. As NodeDent Home and Case Setup & Status own case setup and workflow entry, the pre-op card should become a focused clinical step with:

- concise pre-op instruction
- compact safety/stop-rule banner
- required-input summary
- one primary pre-op completion action
- validation only when required pre-op facts are missing

Move resume, prior-visit setup, broad case identity, shared module launch, and timeline/history entry points out of the pre-op decision card once equivalent surfaces exist elsewhere.

The main workspace shell now supports an operative target panel as well as the endodontic target panel. Continue removing endodontic assumptions from shared shell areas when they appear, especially button labels, case status phrasing, saved-case affordances, and prior-visit entry points.

### Localization And Internationalization

NodeDent should eventually support localization.

The implementation does not need to commit to `i18next`, but the architecture should keep localization possible:

- keep workflow IDs, event types, capability names, and node IDs stable and language-neutral
- separate user-facing strings from clinical identifiers
- localize UI labels, option text, note phrasing, and help text
- support dental localization needs such as tooth numbering systems, date/time formatting, units, and regional clinical terminology
- keep exports predictable when a case was recorded in one locale and later viewed in another

Implemented primary workflow identity now comes from typed workflow definitions, while the legacy case-level `procedureType` remains a compatibility field. Continue separating user-facing procedure labels from workflow identity so labels can be localized without changing event identity or routing.

## Long-Term Non-Goals

- Do not build multi-window mode before event identity and derived selectors are stable.
- Do not build timeline graphs from ad hoc UI state.
- Do not make localization block the first shared-module implementation.
- Do not treat historical anesthesia or isolation from a prior appointment as current capability without explicit same-visit confirmation.

## Revisit Triggers

The structured anesthesia/isolation events, Case Setup capability summaries, operational Home launcher, and baseline multi-visit endodontic continuation have already triggered and informed the current architecture. Revisit the remaining roadmap when:

- shared consent, examination, or continuity-of-care modules are ready for a bounded source-backed or product spec;
- future radiology/imaging work is ready to move from roadmap backlog into an active source-backed or product spec;
- multi-visit endodontic continuation has end-to-end scenario fixtures and a reusable continuity/history boundary is ready to design;
- a second non-endodontic primary workflow repeats the operative runner shape; or
- localization becomes a product requirement rather than a future possibility.
