---
status: active
created_on: 2026-06-16
---

# NodeDent Long-Term Product Roadmap

This document captures long-term NodeDent product direction that is broader than the current endodontic workflow and the near-term generalized workflow node plan.

Use this file for product ideas that should not be forgotten, but are not ready to become implementation tasks.

## Relationship To Current Specs

- `docs/specs/archive/generalized-workflow-nodes.md` records the implemented architecture for reusable workflow modules, event-backed capabilities, Case Setup & Status, and embedded workflow UI. `docs/specs/archive/shared-anesthesia-module.md` and `docs/specs/archive/shared-isolation-module.md` record the implemented shared anesthesia and shared isolation modules.
- `docs/adr/0004-generalize-clinical-workflow-nodes.md` records the architecture decision behind reusable workflow modules.
- This roadmap tracks platform-level capabilities that should be revisited after the event ledger and shared modules are stable.

## Long-Term Themes

### Shared Module And Workflow Pipeline

The shared anesthesia and shared isolation modules are implemented for the current narrow scope. Both modules use structured events, event-backed capabilities, embedded workflow entry points, Case Setup & Status capture, and local user-owned documentation catalogs without turning shortcut values into clinical recommendations.

Near-term shared-module follow-up should focus on main workspace cleanup rather than adding another shared module. The endodontic pre-op card, NodeDent Home, Case Setup & Status, and shared module launch controls should be made visually and behaviorally consistent before the next primary workflow is added.

The next primary workflow area should be operative dentistry. Operative workflows should reuse shared diagnosis, radiographs, anesthesia, and isolation context where appropriate, while owning operative-specific treatment targets such as teeth, surfaces, materials, shades, bonding/cementation details, and restoration outputs.

Near-term follow-up should avoid expanding anesthesia into source-backed clinical decision support until those rules have their own evidence-backed spec or ADR.

### Clinical Documentation Catalogs

NodeDent should eventually generalize the local user anesthesia catalog work into a broader catalog system.

Future catalog work should include:

- clinic and template catalog storage
- catalog import/export
- catalog sync across devices or clinic workspaces
- a global settings or catalog management workspace
- seeded/customizable catalogs for isolation methods, burs, endodontic file systems, filling materials, brands, shades, cements, bonding systems, and other reusable documentation vocabularies

Catalogs should remain documentation shortcuts unless a separate source-backed decision explicitly adds rule behavior. Product or shortcut selections should not infer adequacy, dose, timing, expiry, safety, or treatment recommendations.

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

Once NodeDent has multiple primary workflows or standalone shared modules, it should open through an operational home screen or workflow launcher instead of assuming the endodontic protocol is always the root screen.

The launcher should support:

- starting or resuming a case
- returning to the most recent active workflow
- choosing a primary workflow
- opening standalone shared modules
- opening Case Setup & Status
- opening notes/export
- opening a future timeline/history viewer

The launcher should remain clinical and work-focused, not a marketing landing page.

When this launcher becomes the real entry point, declutter the endodontic pre-op setup card. The current pre-op surface is transitional and carries setup, resume, prior-visit, shared-readiness, module-launch, safety, validation, and decision responsibilities in one card. After NodeDent Home and Case Setup & Status own case setup and workflow entry, the pre-op card should become a focused clinical step with:

- concise pre-op instruction
- compact safety/stop-rule banner
- required-input summary
- one primary pre-op completion action
- validation only when required pre-op facts are missing

Move resume, prior-visit setup, broad case identity, shared module launch, and timeline/history entry points out of the pre-op decision card once equivalent surfaces exist elsewhere.

When operative dentistry workflows become usable, revisit the main workspace shell. The current status banner and canal selector are endodontic-first surfaces. They should be removed or modified so the workspace can show procedure-appropriate treatment targets, such as teeth and surfaces being treated, without forcing operative workflows through canal-oriented UI.

### Localization And Internationalization

NodeDent should eventually support localization.

The implementation does not need to commit to `i18next`, but the architecture should keep localization possible:

- keep workflow IDs, event types, capability names, and node IDs stable and language-neutral
- separate user-facing strings from clinical identifiers
- localize UI labels, option text, note phrasing, and help text
- support dental localization needs such as tooth numbering systems, date/time formatting, units, and regional clinical terminology
- keep exports predictable when a case was recorded in one locale and later viewed in another

Procedure names can remain strings while NodeDent has one primary clinical workflow and only a few procedure labels. Once the app supports multiple primary procedures, workflow launch, and localized procedure names, procedure identity should move toward typed workflow definitions. User-facing procedure labels can then be localized without changing event identity or workflow routing.

## Long-Term Non-Goals

- Do not build multi-window mode before event identity and derived selectors are stable.
- Do not build timeline graphs from ad hoc UI state.
- Do not make localization block the first shared-module implementation.
- Do not treat historical anesthesia or isolation from a prior appointment as current capability without explicit same-visit confirmation.

## Revisit Triggers

Revisit this roadmap when:

- `shared.isolation` or `shared.anesthesia` records structured events.
- Case Setup & Status can summarize event-backed capabilities.
- Multi-visit endodontic continuation is implemented.
- NodeDent has at least one non-endodontic primary workflow.
- Localization becomes a product requirement rather than a future possibility.
