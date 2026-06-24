---
status: active
created_on: 2026-06-24
---
# CODEX task brief: Clinical note generator QA — state consistency, missing-data handling, and avoiding endodontic overfitting

Please audit the current clinical note template/generator against the attached sample output containing:

1. Full note
2. Compact note
3. Backing JSON/event log

The goal is not only to fix the endodontic/RCT output, but to improve the shared template logic so it works safely for future workflows. Please avoid overfitting the current template to endodontics. Any shared methods should remain workflow-agnostic, with workflow-specific terms handled by configuration, renderers, or domain modules.

## Important instruction

For every issue below, please mark one of:

* `SOLVED` — current code already fixes this
* `STILL FAILING` — current code reproduces the issue
* `PARTIAL` — partly fixed but still needs work
* `NOT APPLICABLE` — no longer relevant because architecture changed

Then fix any `STILL FAILING` or `PARTIAL` items.

---

## No-Model-Change Implementation Breakdown

The JSON sample is not ready to be treated as a stable contract yet. The first implementation pass should therefore focus on making the current note outputs honest using existing state, without adding new schema fields or changing the exported data model.

### Fixable without data model changes

| Issue | No-model-change fix |
| --- | --- |
| 1. Case status / workflow completion mismatch | Make note/export status prefer derived completion when events or closure prove completion, instead of blindly using stale `caseStatus`. |
| 2. Rubber dam / isolation overclaim in compact note | Remove hardcoded compact-note rubber dam wording; render actual isolation events or `Isolation: not recorded.` |
| 3. Stale/intermediate measurements mixed with final measurements | Render final canal fields in the clinical note; keep event snapshot values in the audit/event log. |
| 4. Radiograph wording contradiction: "taken" vs "not taken" | Change the decision/output wording to `WL PA status recorded`; event text should reflect the stored value, including `not taken`. |
| 5. Radiograph types are conflated in compact note | Separately render pre-op PA/BW/CBCT, WL PA, cone-fit PA, and final obturation PA as `not recorded` when no field exists. |
| 7. Autosave / timestamp inconsistency | Remove autosave timestamps from the clinical note or relabel them as app metadata; keep event timestamps in the audit log. |
| 8. `currentCanal` / final event mismatch | Omit `currentCanal` from human-readable clinical notes; treat it as UI/navigation state. |
| 9. "Small" file/cone/gauge labels are not self-explanatory | Render values such as `small` as protocol labels unless a real clinical size is available. |
| 10. EAL0 / patency / shaping relationship needs explanation | Add endodontic-specific explanatory text when values match the EAL0 +/- 1 convention. |
| 11. Diagnosis fields are weak or unclear | Normalize `idem` and blank-like diagnosis values to `not recorded` in rendered notes. |
| 12. Prior visit history missing despite "previously started RCT" | If diagnosis/status implies previous treatment but prior history is empty, render `Prior treatment context: not recorded.` |
| 13. Missing anesthesia documentation | Render anesthesia honestly as recorded or `not recorded`; the shared anesthesia module already exists. |
| 14. Missing or unclear isolation documentation | Render isolation honestly as recorded or `not recorded`; the shared isolation module already exists. |
| 15. Operative section is missing | Rename, suppress, or clarify empty operative sections when closure/restoration is documented elsewhere. |
| 18. Final restoration is too vague | Use cautious wording such as `Closure recorded as final restoration; material/details not recorded.` |
| 20. Difficulty flag lacks explanation | Infer a basic reason from recorded difficulty/referral events when possible, otherwise render `reason not recorded`. |
| 21. Workflow-switch events clutter the human-readable note | Exclude `workflow.*` navigation events from the full clinical note; keep them in event/audit output. |
| 22. Compact note loses important nuance | Apply compact-note safety rules: no affirmative claims from missing data, preserve key missing or uncertain items. |
| 23. Need a final source-of-truth summary block | Add an endodontic canal summary from final `caseData.canals`. |
| 24. Blank fields vs "not recorded" need consistent handling | Add render helpers for blank/null -> `not recorded`, while preserving explicit `not taken`. |
| 25. Event snapshots should not be treated as final state | Use final entity state for clinical notes; use event snapshots only in audit/event logs. |
| 26. Shared methods must not become endodontic-specific | Keep missing-data, final-state, section, and output-mode helpers generic; keep endodontic details in endodontic note modules. |

### Not fully fixable without data model work

| Issue | Why it needs model/schema/module work |
| --- | --- |
| 6. Final obturation radiograph not clearly documented | There is no current field for final obturation radiograph status. The renderer can only say `Final obturation PA: not recorded.` |
| 16. Consent not documented | There is no consent module or consent field set yet. |
| 17. Pre-op clinical findings are under-documented | There are no structured findings fields for symptoms, tests, restorability, periodontal findings, or prognosis. |
| 18. Final restoration is too vague | A full fix needs restoration material, definitive/temporary status, occlusion, bonding/core/crown recommendation, and related fields. |
| 19. Irrigation details incomplete | A full fix needs concentration, volume, delivery, activation, and safety-control fields. |
| 20. Difficulty flag lacks explanation | Structured difficulty reasons need a new field; without model work only inferred or missing reasons can be rendered. |
| 27. Suggested architecture direction | A broad shared renderer should be extracted incrementally after current note-output regressions are covered by tests. |

### Recommended first implementation slice

Fix issues `1`, `2`, `3`, `4`, `5`, `7`, `15`, `21`, `22`, `23`, `24`, and `25` first. This slice should use an in-code regression case fixture based on the observed sample behavior, not the not-yet-stable backing JSON contract.

The first pass should not add consent, findings, final obturation PA, restoration-detail, irrigation-detail, or structured difficulty-reason fields. Those should become separate model/schema/UI/import/export tasks after the note renderer is no longer producing contradictions from existing state.

---

# 1. Case status / workflow completion mismatch

## Problem observed

The note says:

* `Visit status: RCT initiated`
* JSON `caseStatus: RCT initiated`

But the same record shows:

* current node is pathway complete
* both canals are complete
* obturation sequence completed
* final restoration placed
* closure completed

## Required behavior

The human-readable note should not say “RCT initiated” when the workflow is completed.

Possible expected output:

* `RCT completed`
* `RCT completed; definitive coronal restoration/crown pending`
* `RCT initiated` only if the case was truly started but not completed

## Generalized requirement

Shared note logic should derive or validate final visit status from the actual workflow state, not rely blindly on an outdated case status label.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 2. Rubber dam / isolation overclaim in compact note

## Problem observed

Full note says:

* `Isolation: Not recorded.`

Compact note says:

* `RD isolation planned/used as clinically appropriate.`

This is not safe. The compact note appears to insert rubber dam wording even though isolation was not actually recorded.

## Required behavior

Do not generate “rubber dam used,” “RD isolation used,” or equivalent wording unless the source data explicitly supports it.

If isolation is missing, say:

* `Isolation: not recorded.`

If rubber dam was used, say something explicit:

* `Rubber dam isolation placed and maintained during endodontic treatment.`

If not used, allow:

* `Rubber dam not used; reason: ___; alternative isolation: ___.`

## Generalized requirement

Shared rendering methods must not auto-generate affirmative procedural claims from missing data. This applies to all workflows, not only rubber dam/endodontics.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 3. Stale/intermediate measurements mixed with final measurements

## Problem observed

The note/event log preserves earlier canal measurements and later revised canal measurements without clearly distinguishing them.

Examples from sample:

### L canal

Earlier narrative/event values:

* EAL0 19 mm
* patency 20 mm
* shaping 18 mm

Later/final table values:

* EAL0 20 mm
* patency 21 mm
* shaping 19 mm

### B canal

Earlier JSON snapshot values:

* EAL0 18 mm
* patency 19 mm
* shaping 17 mm

Later/final values:

* EAL0 21 mm
* patency 22 mm
* shaping 20 mm

## Required behavior

The human-readable note must clearly indicate the source-of-truth values.

Acceptable approaches:

1. Print only final values in the main clinical note.
2. If prior values are shown, label them clearly as initial/revised:

   * `Initial L measurement: EAL0 19 / patency 20 / shaping 18.`
   * `Final L measurement revised to: EAL0 20 / patency 21 / shaping 19.`
3. Keep stale/intermediate values in the audit/event log only, not the main note.

## Generalized requirement

Any workflow that stores intermediate snapshots should distinguish:

* initial value
* revised value
* final value
* audit/event value

Do not mix them in the final clinical note without labels.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 4. Radiograph wording contradiction: “taken” vs “not taken”

## Problem observed

One event label says:

* `EAL 0 recorded and WL radiograph taken`

But the actual stored field says:

* `WL radiograph status: not taken`

The full note also states:

* `L WL PA: not taken`

## Required behavior

The generated label must reflect the actual field value.

If status is `not taken`, output should say:

* `EAL0 recorded; WL PA not taken.`

If status is `taken`, output may say:

* `EAL0 recorded; WL PA taken and reviewed.`

## Generalized requirement

Decision labels must be conditional on stored values. Do not use generic success labels that imply the opposite of the selected data.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 5. Radiograph types are conflated in compact note

## Problem observed

Compact note says:

* `Master cone fit confirmed radiographically.`

This is true for cone-fit PA, but the compact note does not distinguish:

* pre-op PA reviewed
* BW reviewed or not recorded
* CBCT reviewed or not recorded
* WL PA status
* cone-fit PA status
* final obturation PA status

The note documents cone-fit radiographs as acceptable, but WL PA is not taken for L and unclear/blank for B. Final obturation PA is not clearly documented.

## Required behavior

Radiographic statuses should be separate fields and rendered separately where relevant.

Suggested compact format:

* `Pre-op PA reviewed.`
* `WL PA: B not recorded; L not taken.`
* `Cone-fit PA: B acceptable; L acceptable.`
* `Final obturation PA: not recorded.`

## Generalized requirement

Do not collapse different imaging events into one generic phrase. This applies across workflows: pre-op imaging, intra-op verification imaging, post-op/final imaging, and review status should be separate.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 6. Final obturation radiograph not clearly documented

## Problem observed

The sample documents cone-fit PA, but does not clearly document:

* final obturation PA taken
* final PA reviewed
* obturation length/density acceptable
* final PA not taken

## Required behavior

Add a distinct final imaging field/state where appropriate.

For endodontics, possible field:

* `finalObturationRadiographStatus`
* values: `takenAcceptable`, `takenNotAcceptable`, `notTaken`, `notRecorded`

Human-readable output:

* `Final obturation PA taken and reviewed; obturation length/density acceptable.`
* or `Final obturation PA: not recorded.`

## Generalized requirement

If a workflow has a final verification step, it should have its own explicit field and should not be inferred from earlier verification steps.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 7. Autosave / timestamp inconsistency

## Problem observed

Full note says:

* `Autosaved: 2026-06-24, 9:30:49 a.m.`

Backing JSON says:

* `autosavedAt: 2026-05-06T16:55:26.814Z`

Event timestamps are:

* `2026-06-08`

These dates are mutually inconsistent.

## Required behavior

Clarify and fix timestamp semantics.

Possible separate fields:

* `createdAt`
* `updatedAt`
* `autosavedAt`
* `exportedAt`
* `eventTimestamp`

The full note should display the correct timestamp label.

## Generalized requirement

Shared metadata renderer should not conflate autosave, export, event, created, or modified timestamps.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 8. `currentCanal` / final event mismatch

## Problem observed

Top-level JSON says:

* `currentCanal: L`

But final event indicates switching to B at pathway complete.

This may not be clinically significant, but it indicates possible state desynchronization.

## Required behavior

At pathway completion, top-level current state should either:

1. Be normalized to `All` or `Complete`
2. Reflect the actual final active unit consistently
3. Be omitted from the exported clinical note if not clinically meaningful

## Generalized requirement

Avoid leaking UI navigation state into the clinical note unless it is clinically meaningful.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 9. “Small” file/cone/gauge labels are not self-explanatory

## Problem observed

The note repeatedly says:

* final shaping file: `small`
* obturation gauge: `small`
* master cone: `small`

This may be meaningful inside the software, but a reviewer needs actual clinical values or a legend.

## Required behavior

Either render actual mapped values or include a legend.

Example:

* `Final shaping file: Small protocol, equivalent to [file system/size/taper].`
* `Master cone: [size/taper].`

If the exact mapping is unknown, retain `small` but make it clear it is a protocol label, not a file size.

## Generalized requirement

Shared methods should support display labels and clinical/export labels separately.

Example:

* UI label: `small`
* clinical label: `Small protocol — size 25/.06`
* audit value: `small`

Do not hard-code endodontic file logic into shared rendering methods.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 10. EAL0 / patency / shaping relationship needs explanation

## Problem observed

Final values show shaping length 1 mm short of EAL0 and patency 1 mm beyond EAL0.

Example:

* B: EAL0 21, patency 22, shaping 20
* L: EAL0 20, patency 21, shaping 19

This may be intentional, but the note does not explain the convention.

## Required behavior

If this relationship is intentional, print a clarification:

* `EAL0 recorded at apical foramen; shaping length intentionally set 1 mm short of EAL0; patency maintained 1 mm beyond EAL0.`

## Generalized requirement

When workflow-specific derived measurements are displayed, the template should allow a workflow module to provide explanatory text without hard-coding that logic into shared methods.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 11. Diagnosis fields are weak or unclear

## Problem observed

Diagnosis section says:

* Pulpal diagnosis: `Previously started RCT`
* Apical diagnosis: `idem`

Problems:

* “Previously started RCT” is more of a treatment status than a full pulpal diagnosis.
* “idem” is unclear and should not be used as a final apical diagnosis.

## Required behavior

Use proper diagnosis fields or preserve uncertainty explicitly.

Examples:

* `Pulpal diagnosis: previously initiated endodontic therapy.`
* `Apical diagnosis: not recorded.`
* or dropdown values such as normal apical tissues, symptomatic apical periodontitis, asymptomatic apical periodontitis, chronic apical abscess, etc.

## Generalized requirement

Avoid using `idem` in exported clinical notes. If a field is intentionally same-as-prior, resolve it to the actual value or write `not recorded`.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 12. Prior visit history missing despite “previously started RCT”

## Problem observed

The note says:

* `Pulpal diagnosis: Previously started RCT`

But also says:

* `Prior visit history: Not recorded.`

## Required behavior

If the case is a previously started treatment, prompt for or render prior treatment history:

* when it was started
* by whom, if known
* what was completed
* temporary restoration status
* symptoms since prior visit
* reason for continuation/completion

## Generalized requirement

If a diagnosis/status depends on prior treatment, the shared template should support a linked “prior history/context” section.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 13. Missing anesthesia documentation

## Problem observed

Full note says:

* `Anesthesia: Not recorded.`

## Required behavior

Anesthesia should be recorded or explicitly marked not used/not required.

Suggested fields:

* anesthetic type
* concentration
* epinephrine concentration
* number of carpules
* injection technique
* effectiveness
* complications

## Generalized requirement

Anesthesia should be a shared clinical module usable across workflows, not endodontic-specific.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 14. Missing or unclear isolation documentation

## Problem observed

Full note says:

* `Isolation: Not recorded.`

Compact note overclaims rubber dam usage.

## Required behavior

Add or enforce an isolation section with explicit values:

* isolation type
* rubber dam yes/no/not recorded
* clamp if applicable
* seal quality
* alternative isolation if no rubber dam
* reason if isolation deviated from ideal

## Generalized requirement

Isolation should be a shared module with workflow-specific options. Do not build it only around rubber dam/endodontics.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 15. Operative section is missing

## Problem observed

Full note says:

* `Operative: Not recorded.`

But the note also says access was completed/refined and final restoration placed.

## Required behavior

Clarify what “operative” is meant to capture and avoid saying “not recorded” if operative events are documented elsewhere.

Possible solution:

* Rename section to `Additional operative details`
* Or populate it from access/restoration events
* Or remove the section if redundant

## Generalized requirement

Shared note sections should avoid contradictory empty-section headings when relevant data exists in sub-sections.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 16. Consent not documented

## Problem observed

No clear consent section is present.

## Required behavior

Add consent documentation fields where appropriate:

* diagnosis discussed
* risks discussed
* benefits discussed
* alternatives discussed
* no treatment option discussed
* prognosis discussed
* questions answered
* consent obtained

## Generalized requirement

Consent should be a shared module reusable across workflows.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 17. Pre-op clinical findings are under-documented

## Problem observed

The note has pre-op imaging review and chamber depth but lacks clinical findings such as:

* chief complaint
* symptoms
* percussion
* palpation
* probing
* mobility
* bite test
* sinus tract/swelling
* restorability
* caries/crack/restoration/crown status
* periodontal status
* prognosis

## Required behavior

For RCT, these should be optional-but-visible fields with “not recorded” if missing. For future workflows, the same pattern should support relevant assessment fields.

## Generalized requirement

Create a shared assessment/findings module that workflows can extend.

Do not hard-code endodontic tests into the shared renderer.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 18. Final restoration is too vague

## Problem observed

The note says:

* `Final restoration placed.`

This does not say:

* material
* whether it is definitive or temporary
* whether it is an access restoration only
* bonding protocol
* occlusion checked/adjusted
* crown/onlay/core recommendation

## Required behavior

Use clearer restoration fields.

Examples:

* `Access restored with bonded composite; occlusion checked.`
* `Temporary restoration placed; definitive restoration required.`
* `Core buildup placed; full coverage recommended.`

## Generalized requirement

Restoration/closure should be a shared module, with workflow-specific labels allowed.

Avoid using “final restoration” unless the restoration is truly final/definitive.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 19. Irrigation details incomplete

## Problem observed

Good details are recorded:

* 17% EDTA
* 90–120 seconds
* EDTA agitation
* final NaOCl completed

Missing/unclear:

* NaOCl concentration
* NaOCl volume
* needle type/depth
* activation method, if any
* safety controls

## Required behavior

Add optional fields for concentration, volume, delivery, activation, and safety notes.

## Generalized requirement

Irrigation is endodontic-specific, but the pattern is general: material/agent use should support concentration, amount, time, method, and safety controls without hard-coding into shared methods.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 20. Difficulty flag lacks explanation

## Problem observed

Compact note says:

* `Difficulty flag: caution.`

But it does not explain why.

## Required behavior

If a difficulty flag is set, allow or require reason text.

Examples:

* two canals
* calcification
* difficult negotiation
* limited opening
* curvature
* patient factors
* radiographic uncertainty
* other

## Generalized requirement

Shared flags should support structured reason(s) plus free text, not just a severity label.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 21. Workflow-switch events clutter the human-readable note

## Problem observed

The long note contains many workflow-switch lines, for example:

* switched from L to B
* continued at patency/glide path
* continued at sealer/cone seating
* continued at pathway complete

These are useful for audit/debugging but clutter the clinical note.

## Required behavior

Separate:

1. Clinical note
2. Audit trail / event log
3. Developer/debug trace

The full clinical note should include clinically meaningful sequence information, but not every UI navigation/workflow switch.

## Generalized requirement

Shared rendering should support different output modes:

* compact clinical note
* full clinical note
* audit log
* debug trace

Do not mix debug navigation events into the clinical note by default.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 22. Compact note loses important nuance

## Problem observed

Compact note is efficient but hides key issues:

* says RCT initiated despite apparent completion
* implies RD isolation despite missing isolation data
* does not distinguish WL PA vs cone-fit PA vs final PA
* says final restoration placed without material/definitive status
* gives difficulty flag without reason
* omits anesthesia because not recorded
* omits consent and diagnosis limitations

## Required behavior

Compact note should remain compact but must not become misleading.

Suggested pattern:

* Use affirmative language only for recorded items.
* For high-risk missing items, include short `not recorded` phrases.
* Preserve key radiographic distinctions.
* Preserve final status accurately.

## Generalized requirement

Compact notes need safety rules. They should not compress missing or contradictory data into false certainty.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 23. Need a final source-of-truth summary block

## Problem observed

The note would be easier to audit if it ended with a concise final source-of-truth table.

## Required behavior

For endodontics, add a final canal summary table or structured block:

| Canal | Final EAL0 | Patency | Shaping | Final file | Gauge | MC    | Cone PA    |
| ----- | ---------: | ------: | ------: | ---------- | ----- | ----- | ---------- |
| B     |         21 |      22 |      20 | small      | small | small | acceptable |
| L     |         20 |      21 |      19 | small      | small | small | acceptable |

Also include convention text if applicable:

* `Shaping length intentionally set 1 mm short of EAL0. Patency maintained 1 mm beyond EAL0.`

## Generalized requirement

Other workflows should be able to define their own final source-of-truth summary block. This should be workflow-configurable, not endodontic-hard-coded.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 24. Blank fields vs “not recorded” need consistent handling

## Problem observed

Some fields are blank in JSON, while the full note sometimes renders “not recorded” and sometimes omits the field.

Examples:

* B WL radiograph status blank
* L WL radiograph status `not taken`
* anesthesia not recorded
* isolation not recorded
* operative not recorded
* file terminal length blank
* available treatment space blank

## Required behavior

Create consistent missing-data semantics:

* `notRecorded`
* `notTaken`
* `notApplicable`
* `unknown`
* blank/null only for internal unset state, not final export

## Generalized requirement

Shared methods should normalize missing values before rendering. Avoid ambiguous blank strings in exported clinical notes.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 25. Event snapshots should not be treated as final state

## Problem observed

JSON event snapshots preserve the canal state at each moment. This is useful, but earlier snapshots can contain stale values.

## Required behavior

The renderer should distinguish:

* final canonical state
* event snapshot state
* historical/audit state

The clinical note should use final canonical state unless explicitly rendering an audit trail.

## Generalized requirement

Implement or verify a clear state-selection rule for rendering.

Possible rule:

1. Use final entity state for summaries.
2. Use event snapshots only for chronological audit sections.
3. If values changed, optionally render a “revised from X to Y” statement.

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 26. Shared methods must not become endodontic-specific

## Problem observed/risk

Many of the current issues were found using an RCT note. However, the same engine will be used for other clinical workflows.

## Required behavior

Please make sure fixes are implemented as generic rendering/state-management improvements where possible.

Shared methods should handle:

* missing data
* contradictory data
* final vs intermediate values
* compact vs full output
* audit vs clinical output
* section-level rendering
* conditional statements
* source-of-truth summaries
* workflow-specific field labels
* workflow-specific explanatory notes

Workflow-specific modules/config should handle:

* endodontic canal labels
* EAL0/patency/shaping logic
* file/cone/gauge terminology
* irrigation sequence
* cone-fit radiographs
* obturation-specific final PA
* diagnosis dropdowns specific to endodontics

## Anti-overfitting requirement

Do not solve these by hard-coding assumptions such as:

* every workflow has canals
* every workflow has rubber dam
* every workflow has obturation
* every workflow has EAL0
* every workflow has master cones
* every final verification is a radiograph
* every clinical unit is a canal/tooth

Instead, use generalized concepts:

* workflow unit
* measurement
* verification
* material/agent use
* isolation
* anesthesia
* consent
* closure
* final summary
* audit event
* missing-data status

## Status

* [ ] SOLVED
* [ ] STILL FAILING
* [ ] PARTIAL
* [ ] NOT APPLICABLE

---

# 27. Suggested architecture direction

Please consider this architecture:

## Shared layer

* `renderClinicalSection(sectionConfig, data)`
* `renderCompactSummary(summaryConfig, data)`
* `normalizeMissingValues(data)`
* `validateContradictions(data)`
* `selectFinalState(entity, events)`
* `renderAuditTrail(events)`
* `renderConditionalPhrase(field, value, phraseMap)`
* `renderVerificationStatus(verificationConfig, data)`
* `renderMaterialUse(materialUseConfig, data)`

## Workflow-specific layer

For endodontics:

* canal summary config
* EAL0/patency/shaping derived explanation
* irrigation config
* obturation config
* cone-fit PA config
* final obturation PA config
* endodontic diagnosis config

For future workflows:

* periodontal charting config
* restorative config
* surgery config
* exam/recall config
* referral config
* etc.

## Testing requirement

Add regression tests using this sample case.

Tests should confirm:

1. Completed RCT does not render as “RCT initiated.”
2. Missing isolation does not render as rubber dam used.
3. `WL PA not taken` does not render as `WL radiograph taken`.
4. Compact note separates cone-fit PA from WL PA and final PA.
5. Final values are rendered as final values, not stale event snapshots.
6. Intermediate revised values are either hidden from clinical note or clearly labelled.
7. “Small” labels are mapped or explained.
8. Final restoration is not overclaimed as definitive unless explicitly recorded.
9. Missing anesthesia/consent/isolation are rendered honestly.
10. Shared rendering functions do not reference endodontic-only concepts.

---

# Acceptance criteria

This task is complete when:

* The current generator can render the sample note without contradictions.
* The compact note is concise but not misleading.
* The full note separates clinical documentation from audit/debug workflow noise.
* Missing information is explicit and not converted into affirmative claims.
* Final state is selected consistently from JSON.
* Earlier event snapshots do not pollute the clinical source-of-truth summary.
* Radiographic statuses are separated by type.
* The architecture remains reusable for non-endodontic workflows.
* Tests exist to prevent regression.
