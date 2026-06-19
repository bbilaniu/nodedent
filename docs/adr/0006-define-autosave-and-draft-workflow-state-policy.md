# ADR 0006: Define Autosave And Draft Workflow State Policy

## Status

Proposed

## Context

NodeDent autosaves case progress and now supports multiple workflow surfaces that can record setup and clinical output before a full procedure is complete.

Some fields represent current working setup, such as operative tooth and surface selection. Other events represent clinical history, such as anesthesia given, isolation established, or final restoration placed. Treating every edit the same way would either make setup too rigid or make clinical history too easy to silently rewrite.

The operative direct restoration workflow chose to upsert `operative.scope.recorded` on every setup edit without a separate scope-confirmation moment. That solves the first usable workflow, but NodeDent needs a broader policy for when autosaved edits are drafts, when they become clinical events, and how corrections should work.

## Decision

NodeDent should distinguish autosaved working state from durable clinical history.

Workflow setup that has not yet recorded irreversible clinical output may be autosaved and upserted as the latest setup event when the workflow explicitly defines that behavior. For operative direct restoration, `operative.scope.recorded` is the current setup boundary and there is no separate scope-confirmed step.

Clinical output events should usually append rather than silently replace prior events. Examples include anesthesia administration, isolation establishment, final restoration placement, obturation, referral, or other events that document care already delivered.

Direct edits to durable clinical history should be modeled as explicit correction behavior, not ordinary autosave. A correction should preserve enough traceability to show what changed and why, even if the UI presents it as a simple edit.

Future workflow specs should declare:

- which fields are transient local UI state
- which setup fields autosave as upserted workflow state
- which events append clinical history
- which events may be corrected or superseded
- whether the workflow needs an explicit confirmation moment before setup becomes clinical context

## Rationale

Autosave is important for chairside reliability, but autosave should not blur the difference between planning/setup and completed clinical care. Upserting setup keeps early workflow edits low-friction. Appending clinical output preserves auditability and avoids accidental loss of history.

Different workflows may need different confirmation points. A surface-scoped operative setup can be safely updated while the clinician is still defining the target. Other workflows may need an explicit confirmation moment if setup changes carry stronger clinical meaning.

## Consequences

- Workflow specs must document their draft/setup/event boundaries.
- Case Setup & Status can continue to autosave editable setup fields, but durable clinical output should remain event-ledger based.
- Correction UI is a separate product concern from ordinary workflow data entry.
- Notes and exports should prefer durable clinical events over transient UI state.
- The operative direct restoration workflow's no-confirmation setup behavior should not automatically apply to every future workflow.

## Alternatives Considered

- Require confirmation for all setup edits: safer audit semantics, but too much friction for early workflow setup and chairside correction of simple target fields.
- Upsert all event types: simple persistence model, but it risks erasing clinical history.
- Append every keystroke as a new event: maximally auditable, but noisy and difficult to use for notes, summaries, and review.

## Follow-Up

- Define correction event behavior before adding broad edit-in-place support for clinical history.
- Revisit this ADR when multi-visit workflow continuation or workflow switching needs more explicit draft/progress states.
