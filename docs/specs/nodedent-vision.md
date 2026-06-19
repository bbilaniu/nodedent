---
status: active
created_on: 2026-06-19
---

# Nodedent Direction: UI Cleanup, Shared Modules, and Workflow Architecture

## Current UI Quirks and Proposed Changes

### 1. Global header should not be endo-specific

The current header still shows items such as **Tooth / RCT / RCT Planned**. This feels too specific to endodontics if nodedent is becoming the shared platform for multiple dental workflows.

The global case header should contain general encounter information, such as:

* Patient or chart identifier
* Appointment date
* Tooth or teeth involved
* Active workflow or workflows
* Overall case status

Endodontic-specific items, such as **RCT planned**, **RCT started**, **canal tracking**, or **obturation status**, should live inside the Endodontic RCT workflow header or card rather than the global page header.

### 2. Prior visit context should become a shared module

“Prior visit” makes sense in endodontics, but it is not specifically an endodontic concept.

It also applies to:

* Replacing a temporary filling
* Remaking or revising a previous restoration
* Completing the final restoration after specialist RCT
* Following up after an emergency visit
* Continuing staged treatment
* Switching from one treatment plan to another

Therefore, prior visit context should become a shared module, possibly renamed to something like:

* Previous visit context
* Case background
* Prior treatment context
* Continuity note

This module should be available to any workflow rather than being owned by the Endodontic RCT workflow.

### 3. Workflow buttons should be state-aware

Currently, the Endodontic RCT card says **Continue workflow** even when the workflow has never been started.

The button label should reflect the actual workflow state:

* Never started: **Start workflow**
* Saved progress exists: **Continue workflow**
* Completed: **Review / reopen**
* Converted or abandoned: **View history**
* Planned but not started: **Start planned workflow**

This is especially important because nodedent’s value depends partly on persistent workflow state and auditability.

### 4. Add placeholder primary workflows

It would be useful to add placeholder primary workflows such as:

* Extraction surgery
* Cleaning / hygiene
* Operative dentistry
* Emergency exam
* Diagnostic exam

These could initially appear as disabled roadmap cards, “coming soon” cards, or minimal unguided workflow containers.

A useful compromise would be to allow some placeholder workflows to launch a simple unguided note form before full guided decision support is implemented.

## Diagnostics: Shared Module or Primary Workflow?

Diagnostics should primarily be built as a shared module, not as something owned by one workflow.

However, a **Diagnostic encounter** can also exist as a primary workflow that uses the shared diagnostic modules.

For example, the same diagnostic modules could be reused inside:

* Emergency exam
* RCT workflow
* Operative dentistry
* Extraction planning
* Fixed partial denture assessment
* Recall or comprehensive exam

This avoids duplicating diagnostic logic while still allowing diagnostics to be the main purpose of an appointment when appropriate.

The guiding rule should be:

> If a feature can be reused inside multiple workflows, build it as a shared module. If it can be the main purpose of an appointment, allow it to be launched as a primary workflow.

## Current Project State

### pulp-app.com

Currently, pulp-app.com allows creation of clinical notes in separate sections that are copied individually into the EMR.

It includes:

* Specific diagnostic forms
* Specific treatment forms
* Table-based forms for quick overview of observations or treatment per tooth
* Duplication of entries when needed
* Automatic pruning of redundant information into common paragraphs, such as shared isolation or shade
* Reimporting generated JSON back into the section that created it for modification or updating

Current limitation:

* Clearing or reloading the page loses all data.

### hygienenote.com

Currently, hygienenote.com allows creation of a complete hygiene appointment note with some automation. The final note is copied into the EMR.

Current limitation:

* Clearing or reloading the page loses all data.

### nodedent.com

Currently, nodedent.com allows creation of a complete RCT note that can be copied into the EMR.

It includes:

* Persistent progress tracking
* Timestamped event logs
* Autosaving even if the browser is closed or a new case is started
* Optional tracking of decision-relevant clinical parameters
* Canal-level data entry, including measurements and obturation details

## Product Vision

The long-term goal is to evolve nodedent into the main clinical workflow platform and gradually incorporate or transform useful parts of pulp-app.com and hygienenote.com.

The app should support:

1. Complete clinical notes that can be immediately copied into the EMR.
2. Guided workflows with clinical decision support.
3. Unguided workflows using faster forms or tables.
4. Persistent case state and autosave.
5. Timestamped audit trails.
6. Workflow switching when treatment changes during the appointment.
7. Shared modules that can be reused across multiple workflows.
8. Structured JSON reimport/export for editing, persistence, and future integration.

Workflow setup and output should be recorded as structured clinical events wherever practical. Derived state, caches, and summaries are useful for speed and ergonomics, but they should remain rebuildable from event-backed case state rather than becoming a competing source of truth.

## Examples of Workflow Switching

The system should support real clinical changes such as:

* An RCT becoming an extraction after a root fracture is found.
* A deep filling becoming a pulpectomy or RCT.
* An emergency exam being followed by a filling.
* Fillings being completed first, with an extraction planned afterward.
* A diagnostic workflow leading into a treatment workflow during the same appointment.

The goal is not just to produce notes, but to model the way dental appointments actually evolve.

## Target Use Cases

Nodedent should support different levels of user need:

### 1. Fast note users

These users want a clean note that can be immediately copied into the EMR.

They need:

* Fast forms
* Compact output
* Minimal friction
* No required decision support

### 2. Guided workflow users

These users want help following clinical steps, tracking decisions, and documenting why treatment choices were made.

They need:

* Clinical decision points
* Step-aware workflows
* Treatment parameters
* Context-sensitive prompts

### 3. Audit trail and process improvement users

These users want to understand what happened during treatment and what slowed them down.

They need:

* Timestamped logs
* Persistent workflow state
* Event tracking
* Ability to review pauses, complications, conversions, and repeated steps

## Architectural Direction

Nodedent should become the shared shell for clinical workflows.

The preferred structure is:

* **Case / encounter shell:** persistent container for the appointment or clinical case
* **Primary workflows:** RCT, operative dentistry, extraction, hygiene, emergency exam, diagnostic exam
* **Shared modules:** diagnostics, previous visit context, anesthesia, isolation, radiographs, prescriptions, complications, follow-up
* **Output layer:** EMR-ready notes, compact summaries, JSON export, and future API integration
* **Audit layer:** timestamped event log and workflow state history

Primary workflow UIs may start as focused workflow-specific runners when that keeps the first usable slice small. A generic primary-workflow shell should be extracted only after at least two non-endodontic workflows repeat the same runner shape.

Clinical capability compatibility should be explicit. Similar-looking concepts from different workflows, such as endodontic final closure and operative final restoration placement, should not be treated as interchangeable unless a compatibility or workflow-switching spec defines the mapping.

The core product idea is:

> Nodedent should support both fast documentation and deeper clinical workflow guidance, while allowing real-world dental appointments to change direction without losing context or auditability.
