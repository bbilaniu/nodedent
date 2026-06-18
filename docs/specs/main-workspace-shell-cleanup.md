---
status: active
created_on: 2026-06-18
---

# Main Workspace Shell Cleanup Proposal

This proposal defines the cleanup step between the implemented shared anesthesia/isolation modules and the next primary workflow area, operative dentistry.

The goal is to stop the main workspace from being endodontic-first at the platform level while preserving the endodontic decision guide as the active clinical workflow when an endodontic case is being treated.

## Context

NodeDent now has:

- an endodontic primary workflow
- shared diagnosis and radiograph readiness
- shared anesthesia documentation and `anesthesia.adequate` capability output
- shared isolation documentation and `isolation.established` capability output
- NodeDent Home / workflow launcher
- Case Setup & Status
- embedded shared workflow runners

The current main screen still carries several transitional responsibilities in the endodontic decision card:

- setup and readiness prompts
- shared module launch controls
- prior-visit and resume context
- safety and validation messaging
- endodontic phase/canal progress
- active clinical decision options

That made sense while NodeDent had only one primary workflow. It will not scale cleanly to operative dentistry, where the primary treatment targets are teeth and surfaces rather than canals.

## Goals

- Make NodeDent Home and Case Setup & Status the global navigation and setup layer.
- Keep the endodontic decision guide focused on the active endodontic clinical step.
- Move endodontic-only navigation and progress surfaces out of the platform-level main page.
- Preserve fast chairside access to anesthesia and isolation without duplicating confusing entry points.
- Prepare the shell for future workflow-specific target panels, including operative teeth/surfaces.
- Keep the UI quiet, dense, and work-focused rather than turning the app into a landing page.

## Non-Goals

- Do not implement operative dentistry in this cleanup.
- Do not replace the endodontic workflow engine.
- Do not generalize canals into a universal target model.
- Do not remove useful endodontic progress tools; relocate them into an endodontic-specific area.
- Do not add source-backed clinical rules or recommendations.
- Do not change clinical event identity, capability names, or workflow IDs.

## Proposed Changes

### 1. Reframe The Main Workspace

The main app shell should read as NodeDent, not as only the Endodontic Chairside Decision Guide.

Recommended structure:

- global header: case identity, active procedure, autosave, theme, home/case actions
- primary workspace: active workflow panel
- secondary workspace: notes, event log, workflow-specific target/progress panel

The endodontic decision card remains the active workflow panel when the current workflow is endodontic.

### 2. Demote The Endodontic Decision Guide From App Identity

The endodontic decision guide should remain clinically prominent, but it should no longer be the main page identity.

Change the language and hierarchy from:

- app = Endodontic Chairside Decision Guide

To:

- app = NodeDent clinical workspace
- active workflow = Endodontic decision guide

The decision card should focus on:

- current phase
- current step title
- concise chairside instruction
- compact safety/stop-rule banner
- required-input summary
- validation related to the current decision
- primary decision options

It should not own broad case setup, shared module launch, prior-visit setup, or global workflow navigation once those controls exist elsewhere.

### 3. Move The Pathway Phase Canal Map Into Endodontic Progress

The pathway phase/canal map is endodontic-specific. It should not appear as a global platform surface once NodeDent supports multiple primary workflow types.

Recommended destination:

- an `Endodontic progress` panel, drawer, or modal
- available from the active endodontic workflow area
- optionally shown in the secondary column only when the active workflow is endodontic

The feature should remain useful for endodontic continuity, but operative workflows should not see canal-oriented phase mapping.

### 4. Keep Canal Selection Endodontic-Specific

Do not stretch the current canal selector into a universal selector for teeth, surfaces, canals, quadrants, and future target models.

Instead, use a workflow-specific target panel pattern:

- endodontic workflow: canal selector and canal status controls
- operative workflow: tooth and surface selector
- future workflows: their own target panels where needed

A global case summary can still show the active tooth/procedure, but detailed target editing should belong to the active workflow domain.

This avoids making one component understand every dental scope and keeps workflow target behavior easier to test.

### 5. Rationalize Shared Module Entry Points

Anesthesia and isolation should have parallel entry behavior:

- quick capture in Case Setup & Status
- full embedded workflow from NodeDent Home, readiness prompts, and Case Setup
- clear labels for record/review/add-event states

The endodontic pre-op decision card should eventually stop carrying broad shared-module launch controls once equivalent controls are available in NodeDent Home and Case Setup.

### 6. Fix Visual And Theme Drift

Before adding operative dentistry, clean up current UI drift:

- dark-mode warning and status panels
- duplicated button styles
- inconsistent action labels between anesthesia and isolation
- crowded pre-op readiness layout
- unclear distinction between global setup actions and active workflow decisions

## Suggested Implementation Phases

### Phase 1: Shell Language And Header Cleanup

Reasoning level: low-medium.

- Rename the top-level page identity toward NodeDent clinical workspace.
- Keep the active workflow title visible inside the primary workflow card.
- Preserve existing navigation behavior.
- Fix remaining dark-mode style inconsistencies found during this pass.

### Phase 2: Decision Card Decluttering

Reasoning level: medium.

- Move broad setup/module launch controls out of the decision card when equivalent controls exist in NodeDent Home or Case Setup.
- Keep required-input and validation messaging local to the current decision.
- Keep the safety/stop-rule banner compact and readable in light and dark mode.

### Phase 3: Endodontic Progress Area

Reasoning level: medium.

- Move pathway phase/canal map into an endodontic-specific progress panel, drawer, or modal.
- Keep it available from the endodontic workflow context.
- Avoid showing canal phase mapping as a platform-level panel.

### Phase 4: Workflow-Specific Target Panel Pattern

Reasoning level: medium-high.

- Treat `CanalSelector` as an endodontic target panel rather than a universal selector.
- Define a simple interface or layout slot for active workflow target panels.
- Do not implement operative teeth/surfaces yet; reserve the slot and naming so operative can add its own target panel later.

### Phase 5: Operative Dentistry Readiness Review

Reasoning level: high.

- Confirm the main shell can host a non-endodontic primary workflow without showing canal-first UI.
- Confirm operative can reuse diagnosis, radiographs, anesthesia, and isolation context through existing selectors.
- Confirm operative treatment targets can own teeth/surfaces without changing shared isolation event ownership.

## Acceptance Criteria

- The main page reads as NodeDent with an active workflow, not as a single-purpose endodontic app.
- The endodontic decision card is focused on the active clinical decision.
- Shared module controls are available from global/setup surfaces without cluttering the active decision card.
- The pathway phase/canal map is endodontic-specific, not a platform-level surface.
- The canal selector remains endodontic-specific and is not stretched to operative surfaces.
- A future operative workflow can add a teeth/surfaces target panel without modifying canal-specific code.
- Light and dark mode remain readable for safety, warning, status, and action panels.

## Open Decisions

- Should the endodontic progress panel be always visible in the secondary column, or hidden behind an `Endo progress` button?
- Should NodeDent Home become the first screen immediately, or remain a modal until there is a second primary workflow?
- Which shared module controls should remain in the pre-op readiness card during the transition?
- Should the active workflow target panel live in the secondary column, inside the active workflow card, or in Case Setup & Status?

