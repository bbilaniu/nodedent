# ADR 0004: Generalize Clinical Workflow Nodes Through Reusable Workflow Modules

## Status

Proposed

## Context

NodeDent's first workflow models endodontic treatment as data-driven protocol nodes. That has worked for chairside guidance and structured notes, but the current model is still shaped around one procedure: an endodontic case with canals, endodontic phases, and endodontic continuation rules.

Future workflows need shared clinical steps such as diagnosis, anesthesia, isolation, radiographs, temporization, final restoration, and referral. Some of those steps can be standalone workflows. The same steps can also appear inside larger workflows, such as endodontics or operative dentistry.

The product should avoid prompting repeatedly for work that has already been done in the same clinical context. For example, if anesthesia and isolation were already recorded before endodontic access, an operative restoration workflow should be able to recognize that state. If anesthesia needs a top-up, the clinician should be able to record the top-up without abandoning the active workflow.

The current endodontic pre-op decision card also contains express case setup fields. Those fields are broader than a single clinical decision node. Patient/tooth/procedure identity, diagnosis, radiographs, prior visit state, anesthesia/sedation, isolation, and overall case status should remain accessible throughout the visit.

## Decision

Generalize the current node concept into reusable workflow modules.

A workflow module is a versioned graph of clinical nodes with explicit:

- entry points
- completion states
- emitted clinical events
- required clinical context
- satisfied capabilities
- allowed scopes, such as patient, tooth, canal, surface, visit, or procedure

Parent workflows should be able to call reusable modules in two modes:

- Standalone mode, where the module is the primary workflow being performed.
- Embedded mode, where the module runs as a subsection of another workflow and returns control to the parent workflow when complete.

Reusable modules must publish structured events and capabilities into a shared clinical event ledger. Parent workflows should read that ledger through guards and selectors before prompting. If a capability is already satisfied for the relevant scope, the workflow should offer to acknowledge or reuse it rather than force the clinician through the same node sequence again.

Structured clinical events are the durable source of truth for workflow setup, output, and cross-workflow capability matching. Derived state, summaries, caches, or UI-specific working state may be introduced for performance and ergonomics, but they must not become an independent clinical record that competes with the event ledger.

Time-sensitive or dose-sensitive steps, such as anesthesia, should support supplemental events. A supplemental event can update the clinical record, refresh a capability, or document a top-up without requiring the parent workflow to leave its current location.

Introduce a persistent Case Setup & Status surface that is separate from the active decision card. This surface should hold shared case context and status summaries, including case identity, diagnosis, radiographs, prior visit state, anesthesia/sedation, isolation, and case status. It should be able to open reusable modules or supplemental event capture without moving the parent workflow away from the current decision node.

The current express setup form should eventually move into Case Setup & Status. During migration, the pre-op decision card may keep a compact setup summary, required-field validation, and a clear action to open setup/status details.

Once multiple primary workflows or standalone shared modules exist, the app should introduce an operational NodeDent home or workflow launcher instead of assuming the endodontic protocol is always the root screen. Direct-to-endo can remain the default while endodontics is the only primary workflow.

Primary workflow runners may remain workflow-specific while NodeDent is proving the shape of a new procedure family. A generic primary-workflow shell should be extracted only when repeated workflow-specific runners show the same structure and the extraction does not erase clinically meaningful differences.

Capability compatibility must be explicit. Similar clinical concepts recorded by different workflows should not satisfy each other only because their labels sound related. For example, endodontic closure and operative final restoration placement remain separate capability semantics unless a future compatibility or workflow-switching spec defines the mapping.

## Rationale

This keeps the successful state-machine pattern while removing the assumption that every node belongs to one endodontic graph. It also keeps documentation event-driven: reusable modules are valuable only if their outputs can be consumed by notes, status derivation, and later workflows.

Capabilities provide a practical bridge between workflows. A parent workflow usually does not need to know every internal detail of an anesthesia or isolation workflow. It needs to know whether anesthesia is adequate, whether isolation is present, which scope it applies to, and whether a new event is needed.

Embedded modules also support chairside ergonomics. The clinician should be able to handle a short related task, such as topping up anesthesia, and then return to the current decision card with the event trail intact.

Separating Case Setup & Status from the decision card keeps the active card focused on the current clinical step while keeping shared case context available after pre-op. It also creates a natural place to view and update anesthesia/sedation and isolation without turning those concepts into simple booleans.

## Consequences

- `ProtocolNode` should eventually become either a generic node type or an endodontic specialization of a generic node type.
- `ClinicalEvent` should gain enough structure to support workflow/module identity, scope, capability output, and parent-child workflow relationships.
- Guards should evolve from endodontic required-field checks into reusable predicates over case state, active scope, and clinical events.
- Existing endodontic nodes should be migrated gradually. The first pass should add metadata and adapters rather than rewriting the active workflow.
- Reusable modules must include note fragments and status derivation rules; a module is incomplete if it records events that cannot render into useful notes.
- The UI should support sidecar or modal embedded workflows only after the event and capability model is explicit.
- Case Setup & Status should summarize state derived from case fields and clinical events; it should not become a parallel checklist that competes with the event ledger.
- Derived workflow state must remain traceable to clinical events. If a cache cannot be rebuilt or reconciled from events, it should be treated as transient UI state or get its own explicit state boundary.
- Updates to anesthesia/sedation or isolation should usually append supplemental events. Direct editing should be treated as correction of data-entry mistakes, not the default way to change clinical history.
- The express setup form can be extracted incrementally, with pre-op validation preserved until setup/status routing is mature.
- A future workflow launcher should be operational and case-focused, not a marketing landing page.
- Cross-workflow capability reuse requires scope and semantic compatibility. Canal-scoped endodontic progress should not satisfy surface-scoped operative restoration requirements without an explicit compatibility rule.

## Alternatives Considered

- Keep copying nodes between workflows: fast initially, but would duplicate anesthesia, isolation, diagnostic, closure, and referral logic.
- Make every workflow fully standalone: simpler routing, but poor chairside ergonomics when one clinical step belongs inside a larger procedure.
- Store only boolean checklist flags such as "anesthesia done": easy to query, but too weak for notes, top-ups, scope, timing, and later audit.
- Keep express setup only inside the pre-op decision card: simple for the first screen, but makes shared case context harder to inspect or revise later in the visit.
- Keep endodontics as the permanent app root: fastest while there is one workflow, but awkward once standalone modules and other procedure workflows exist.
- Build a generic workflow engine or primary-workflow runner immediately: cleaner long-term, but too broad before repeated non-endodontic workflows prove the shared UI shape.

## Follow-Up

Use the implemented generalized workflow node plan in `docs/specs/archive/generalized-workflow-nodes.md` as the completed migration record. Use `docs/specs/archive/shared-anesthesia-module.md` as the completed shared anesthesia module record. Use `docs/specs/archive/operative-direct-restoration-workflow.md` as the first completed non-endodontic primary workflow record.
