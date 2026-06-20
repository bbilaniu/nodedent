# Dental Hygiene Chairside Guide

## Purpose
This workflow covers a dental hygienist's appointment using the expanded hygiene-note webform template. It is developer-facing and should support implementation of the structured form, conditional UI, and chart-ready summary output.

## Scope
Included:
- Visit details: date and provider name.
- History and Exam: patient concerns, medical history update, and vitals readings.
- EOE / IOE: extraoral exam, intraoral exam, findings, observations, and WNL toggles.
- Gingival Description: color, consistency, gingival margins, interdental papilla, and surface texture findings.
- Calculus and Biofilm Deposits: plaque, calculus, and extrinsic stain cards.
- Periodontal Status: activity status, disease type, stage, grade, and notes.
- Caries Risk: risk level, risk factors, and notes.
- Oral Health Education (OHE): OHE topics and notes.
- Recommendations: recommendations and notes.
- Treatment Done Today: completed care, instrumentation details, and notes.
- Next Appointment: planned care, instrumentation details, and notes.
- Local Anesthesia: No C/I to LA, injection/topical entries, post-anesthetic assessment, and notes.
- Continuity of Care: hygiene follow-up interval.
- Additional Clinical Documentation: other clinical findings.
- Summary Preview: ready-to-copy plain text and structured tags.

Excluded:
- [] Patient identity / chart number / demographics: not present in the JSX source. Decide whether this belongs in this workflow or a parent appointment wrapper.
- [] Radiographs: no explicit radiograph acquisition/review fields in the JSX source.
- [] Consent: no explicit consent field in the JSX source.
- [] Procedure-level billing / fee codes: not present in the JSX source.
- [] Periodontal charting measurements: spot probing and full mouth probing are selectable care items, but pocket depths / bleeding / mobility / recession values are not entered in this JSX source.
- [] Hard clinical validation rules: the JSX includes conditional expansion and a local anesthesia assessment highlight, but does not define a complete required-field blocking policy.

## Required Setup
- Source component: `GingivalDescriptionWebformImportedTemplate.jsx`.
- Default title: `Dental Hygiene Note Template`.
- Default description: `Expanded from the original gingival description form into a fuller hygiene-note template with chart-ready structured output.`
- Variants: `full` and `very-short`.
- Very-short default open sections:
  - `historyAndExam`: true
  - `eoeIoe`: false
  - `gingivalDescription`: true
  - `deposits`: true
  - `periodontalStatus`: true
  - `cariesRisk`: false
  - `ohe`: false
  - `recommendations`: false
  - `treatmentDoneToday`: true
  - `nextAppointment`: false
  - `localAnesthesia`: false
  - `disposition`: false
  - `additionalClinicalDocumentation`: false
- Very-short quick jump sections:
  - History and Exam
  - Gingival Description
  - Treatment Done Today
  - Local Anesthesia
  - Next Appointment
- Shared location options:
  - Sextant 1 (Upper right)
  - Sextant 2 (Upper anterior)
  - Sextant 3 (Upper left)
  - Sextant 4 (Lower left)
  - Sextant 5 (Lower anterior)
  - Sextant 6 (Lower right)
- Shared quadrant options:
  - Q1
  - Q2
  - Q3
  - Q4
- Shared amount options:
  - None
  - Light
  - Moderate
  - Heavy
- Shared extent options:
  - Generalized
  - Localized
- Patient/tooth/arch/quadrant/surfaces:
  - Tooth / teeth are free text in gingival finding rows: placeholder `e.g. #5, #6-8 or 11, 12`.
  - Locations use sextants in gingival findings and deposits.
  - Local anesthesia uses quadrants.
  - [] Surface-level dental charting is not explicitly represented outside free-text notes and distributions.
- Diagnosis or reason for visit:
  - Patient concerns or `Patient presents for hygiene, no other concerns`.
  - Periodontal diagnosis fields.
  - Caries risk fields.
- Medical history checks:
  - `Patient reports no change.` checkbox.
  - Medical history free-text textarea.
  - Vitals readings: systolic, diastolic, heart rate, time.
- Consent:
  - [] Not present in JSX. Decide whether to add consent as a required setup field.
- Anesthesia:
  - Local anesthesia is optional and gated by `No C/I to LA`.
  - Entries can be injection or topical.
- Isolation:
  - [] Not present in JSX. Decide whether hygiene isolation needs a field.

## Step Sequence

### Step 1: Visit Details
Clinical instruction:
- Record basic note metadata before entering clinical findings.

Required data to record:
- `date`: date input, defaults to `getTodayDateString()`.
- `providerName`: text input.

Decision options:
- Date can be edited manually.
- Provider name is required.

Notes/events to generate:
- Plain-text summary header:
  - `Date: {date}` when date is present.
  - `Provider: {providerName}` when provider name is present.

Guards or required fields:
- [] Provider name should be required before copy/export.
- [] Date should always be included even if blank or invalid.

### Step 2: History and Exam
Clinical instruction:
- Document patient concerns, medical history update, and vitals readings.

Required data to record:
- `patientPresentsForHygieneNoOtherConcerns`: checkbox label `Patient presents for hygiene, no other concerns`.
- `patientConcerns`: textarea label `Patient concerns`; placeholder `Document the chief complaint or concerns in the patient's own words.`
- `medicalHistoryNoChange`: checkbox label `Patient reports no change.`
- `medicalHistory`: textarea label `Medical history`; placeholder `Review and update medications, allergies, surgeries, or conditions.`
- `vitalsReadings`: repeatable entries with:
  - `systolic`: number input; placeholder `e.g. 118`.
  - `diastolic`: number input; placeholder `e.g. 76`.
  - `heartRate`: number input; placeholder `e.g. 72`.
  - `time`: time input.

Decision options:
- `Patient presents for hygiene, no other concerns` can be checked and still allow additional patient concern text.
- `Patient reports no change.` can be checked and still allow additional medical history text.
- Vitals actions:
  - Add reading.
  - Remove reading.
  - Set to now.
  - Clear time.
- If more than one valid vitals reading exists, summary logic computes average BP and/or average HR.

Notes/events to generate:
- `Patient concerns: Patient presents for hygiene, no other concerns.` when checked.
- Additional patient concern text appears indented below the no-concerns statement when both are present.
- `Patient concerns: {patientConcerns}.` when no-concerns is not checked.
- `Medical history update: Patient reports no change.` when checked.
- Medical history notes appear as an indented sentence when present.
- Vitals summary lines:
  - `BP: {systolic}/{diastolic} mmHg`
  - `HR: {heartRate} bpm`
  - Optional time suffix: `(at {formatted time})`
  - Optional average line when multiple valid readings exist.

Guards or required fields:
- Empty history and empty vitals should omit the block.
- Vitals lines require at least BP or HR numeric values.
- [] Decide whether vitals are required for hygiene notes or only optional.

### Step 3: EOE / IOE
Clinical instruction:
- Document extraoral and intraoral exam findings and observations.

Required data to record:
- EOE fields:
  - `eoeWithinNormalLimits`: button label `EOE Within Normal Limits`.
  - `asymptomaticClickOnOpeningClosing`: button label `TMJ clicking`.
  - If TMJ clicking is selected:
    - `asymptomaticClickLaterality`: select placeholder `Select laterality`; options: None selected, Bilateral, Left, Right.
    - `tmjClickingStatus`: multi-toggle label `Status`; options: Symptomatic, Asymptomatic.
    - `tmjClickingPhase`: multi-toggle label `On open / close`; options: On open, On close.
  - `asymptomaticLymphNodes`: button label `Palpable Lymph Nodes`.
  - If palpable lymph nodes is selected:
    - `palpableLymphNodeLaterality`: select placeholder `Select laterality`; options: None selected, Bilateral, Left, Right.
    - `palpableLymphNodeLocation`: multi-toggle label `Location`; options: Submandibular, Sublingual.
    - `palpableLymphNodeSwelling`: multi-toggle label `Swelling`; options: Slightly enlarged, Very swollen.
  - `eoe`: textarea label `EOE observations`; placeholder `Document extraoral observations.`
- IOE fields:
  - `ioeWithinNormalLimits`: button label `IOE Within Normal Limits`.
  - `ioeFindings`: multi-toggle label `IOE findings`; options:
    - Coated tongue
    - Fissured tongue
    - Scalloped tongue
    - Bilateral linea alba
  - `palatineTorusAtMidline`: button label `Palatine torus at midline`.
  - If palatine torus is selected:
    - `palatineTorusProminence`: select placeholder `Select prominence`; options: None selected, Slight, Prominent.
  - `bilateralMandibularTori`: button label `Bilateral mandibular tori`.
  - If bilateral mandibular tori is selected:
    - `bilateralMandibularToriProminence`: select placeholder `Select prominence`; options: None selected, Slight, Prominent.
  - `ioe`: textarea label `IOE observations`; placeholder `Document intraoral observations.`

Decision options:
- EOE and IOE WNL toggles can coexist with specific findings and observations.
- Selecting TMJ clicking expands laterality, status, and open/close controls.
- Selecting Palpable Lymph Nodes expands laterality, location, and swelling controls.
- Selecting Palatine torus at midline expands prominence.
- Selecting Bilateral mandibular tori expands prominence.

Notes/events to generate:
- `EOE: within normal limits` when WNL is true and no additional EOE findings are present.
- `EOE: {findings}` when EOE findings/observations are present.
- TMJ line format includes laterality, status, and phase when available.
- Palpable lymph nodes line includes laterality, location, and swelling when available.
- `IOE: within normal limits` when WNL is true and no additional IOE findings are present.
- `IOE: {findings}` when IOE findings/observations are present.
- WNL observations should be normalized so text like `within normal limits overall` is not redundantly repeated.

Guards or required fields:
- If TMJ clicking is deselected, clear `asymptomaticClickLaterality`; status and phase are not explicitly cleared in the JSX when the button is toggled off.
- If Palpable Lymph Nodes is deselected, clear laterality, location, and swelling arrays.
- If Palatine torus at midline is deselected, clear `palatineTorusProminence`.
- If Bilateral mandibular tori is deselected, clear `bilateralMandibularToriProminence`.
- [] Decide whether EOE/IOE WNL should be mutually exclusive with abnormal findings or allowed as currently implemented.

### Step 4: Gingival Description
Clinical instruction:
- Select gingival findings by section and annotate each selected finding with extent, teeth, locations, distributions, and notes.

Required data to record:
- Finding sections and options:
  - Color: Pink, Dark Pink, Red, Cyanotic, Pigmented.
  - Consistency: Firm, Spongy, Fibrotic.
  - Gingival margins: Knife-edged, Rolled.
  - Interdental papilla: Pointed, Bulbous, Blunted.
  - Surface Texture: Stippling, Shiny, Smooth.
- Each selected finding uses the same annotation schema:
  - `presence`: selected/unselected.
  - `extent`: select with options generalized / localized; default `generalized`.
  - `toothNumbers`: text input label `Tooth # / teeth`; placeholder `e.g. #5, #6-8 or 11, 12`.
  - `locations`: multi-toggle label `Location`; options are the shared sextant location options.
  - `distributions`: multi-toggle label `Distribution`; options: Diffuse, Marginal, Papillary.
  - `notes`: textarea label `Notes`; placeholder `Optional detail for this finding`.

Decision options:
- Selecting a finding expands its annotation fields and displays a `Selected` badge.
- Deselecting a finding resets it to empty annotation defaults.
- In very-short variant, selected finding rows can expand wider in the responsive grid.

Notes/events to generate:
- Summary section label: `Gingival Description:`.
- Summary order:
  1. Color
  2. Gingival margins
  3. Interdental papilla
  4. Consistency
  5. Surface Texture
- Descriptor rules:
  - `Red` becomes `redness`.
  - `Stippling` becomes `stippled`.
  - Distributions are prefixed to the descriptor.
  - `toothNumbers` creates an `on {toothNumbers}` area suffix.
  - If no tooth numbers are present and locations are selected, locations create the area suffix.
  - Notes are appended in parentheses.
- Tags tab should show selected findings with section badge, GEN/LOC badge, finding, teeth, location, distribution, and notes.

Guards or required fields:
- If `presence` is false, do not include that finding in summary or tags.
- [] Decide whether localized findings should require teeth or location.
- [] Decide whether generalized findings should block tooth-specific entries or allow them.

### Step 5: Calculus and Biofilm Deposits
Clinical instruction:
- Document plaque, calculus, and extrinsic stain using deposit cards.

Required data to record:
- Cards:
  - Plaque
  - Calculus
  - Extrinsic Stain
- Shared deposit fields:
  - `enabled`: selected/unselected.
  - `amount`: None, Light, Moderate, Heavy; default `None`.
  - `extent`: Generalized, Localized; default `Localized`.
  - `details`: textarea label `Details`.
- Plaque and Calculus additional fields when enabled and amount is not `None`:
  - `locations`: shared sextant location options.
  - `types`: Supragingival, Subgingival.
  - `distributions`: Interproximal, Facial, Lingual, At gingival margin.
- Extrinsic Stain uses amount, extent, and details only in the current JSX source.
- Placeholders:
  - Plaque: `Describe oral biofilm location, amount, and extent.`
  - Calculus: `Describe supragingival/subgingival calculus and affected sites.`
  - Extrinsic Stain: `Describe generalized or localized stain and specific teeth/surfaces.`

Decision options:
- Selecting a deposit card expands it and displays a `Selected` badge.
- Deselecting a card resets it to empty deposit defaults.
- If amount is `None`, extent/type/location/distribution details should not be required for that card.
- Plaque and Calculus use `showTypeLocation`; Extrinsic Stain does not.

Notes/events to generate:
- Summary lines:
  - `Calculus: none` when enabled with amount `None`.
  - `Plaque: none` when enabled with amount `None`.
  - `Extrinsic Stain: none` when enabled with amount `None`.
  - Otherwise: `{Label}: {extent} {amount} {label} {locations} {types} {distributions}`.
  - If details are present, summary uses `{Label}: {extent} {details}` instead of assembled amount/location/type/distribution details.
- Tags tab should show enabled deposit cards with amount, extent, location, type, distribution, and notes.

Guards or required fields:
- Only enabled deposit cards appear in summary/tags.
- [] Decide whether Extrinsic Stain should eventually support locations/types/distributions or remain detail-driven.
- [] Decide whether `None` amount should mean `enabled but none observed` versus `not assessed`.

### Step 6: Periodontal Status
Clinical instruction:
- Record periodontal activity, disease type, periodontitis stage/grade when applicable, and rationale notes.

Required data to record:
- `periodontalStatusActivity`: select label `Activity status`; options: None selected, Active, Stable.
- `periodontalStatusDiseaseType`: select label `Disease type`; options: None selected, Periodontitis, Gingivitis.
- If disease type is `Periodontitis`:
  - `periodontalStatusSeverityStage`: select label `Stage`; options:
    - None selected
    - Slight Periodontitis Stage I
    - Moderate Periodontitis Stage II
    - Severe Periodontitis Stage III
    - Severe Periodontitis Stage IV
  - `periodontalStatusGrade`: select label `Grade`; options:
    - None selected
    - Grade A slow rate of progression
    - Grade B moderate rate of progression
    - Grade C rapid rate of progression
- `periodontalStatusNotes`: textarea label `Periodontal status notes`; placeholder `Document contributing factors or rationale.`

Decision options:
- If disease type changes away from `Periodontitis`, clear stage and grade.
- If disease type is `Gingivitis`, stage and grade controls are hidden.

Notes/events to generate:
- `Periodontal diagnosis: {activity} {severityStage} {grade}. {notes}.` for Periodontitis.
- `Periodontal diagnosis: {activity} Gingivitis. {notes}.` for Gingivitis.
- If only notes are present: `Periodontal diagnosis: {notes}.`

Guards or required fields:
- Stage and grade are only relevant for Periodontitis.
- [] Decide whether Periodontitis requires both stage and grade before summary/export.
- [] Decide whether Gingivitis requires activity status.

### Step 7: Caries Risk
Clinical instruction:
- Record caries risk level, risk factors, and rationale notes.

Required data to record:
- `cariesRiskLevel`: select label `Caries risk level`; options: None selected, Low, Moderate, High.
- `cariesRiskFactors`: multi-toggle label `Caries risk factors`; options:
  - High frequency of sugar intake
  - Inadequate oral hygiene
  - Insufficient exposure to fluoride
  - Heavily restored dentition
  - Hyposalivation
  - History of caries in the last 36 months
  - Symptomatically driven dental visits
- `cariesRiskNotes`: textarea label `Caries risk notes`; placeholder `Document rationale for caries risk selection.`

Decision options:
- Risk factors can be selected with or without a risk level.
- Notes can be used with or without a risk level or risk factors.

Notes/events to generate:
- `Caries risk: {level} caries risk due to {factors}. {notes}.`
- If no level but factors exist: `Caries risk due to {factors}`.
- Formatting adjustments:
  - `Inadequate oral hygiene` becomes `inadequate oral hygiene`.
  - `History of caries in the last 36 months` becomes `history of active decay in the last 36 months`.

Guards or required fields:
- [] Decide whether risk level should be required when any caries risk factor is selected.
- [] Decide whether caries risk should be tied to recommendations automatically later.

### Step 8: Oral Health Education (OHE)
Clinical instruction:
- Record OHE topics discussed and any specific education notes.

Required data to record:
- `oheTopics`: multi-toggle label `OHE topics`; `Select All` action; options:
  - Caries theory
  - Caries risk factors
  - Bass brushing
  - C-shape flossing technique
  - Sulcabrush and interdental brush technique
  - Review benefits of Prevident or Opti-Rinse
  - Periodontitis theory
  - Periodontitis risk factors
  - Importance of maintaining a 4-month hygiene interval
- `oheNotes`: textarea label `OHE notes`; placeholder `Document OHE details discussed today.`

Decision options:
- `Select All` selects all OHE topic options.
- OHE notes can be entered without selecting a topic.

Notes/events to generate:
- `OHE: {topics}. {notes}.`
- Topic grouping rules:
  - If both `Caries theory` and `Caries risk factors` are selected, output `caries theory and risk factors`.
  - If both `Periodontitis theory` and `Periodontitis risk factors` are selected, output `periodontitis theory and risk factors`.
- Topic wording rules:
  - `Bass brushing` -> `bass brushing`.
  - `C-shape flossing technique` -> `c-shaped flossing`.
  - `Sulcabrush and interdental brush technique` -> `sulcabrush and interdental brush technique`.
  - `Review benefits of Prevident or Opti-Rinse` -> `review benefits of Prevident or Opti-Rinse`.
  - `Importance of maintaining a 4-month hygiene interval` -> `importance of maintaining a 4-month hygiene interval`.

Guards or required fields:
- [] Decide whether OHE is optional, required for all hygiene visits, or required only for specific findings.

### Step 9: Recommendations
Clinical instruction:
- Record recommended products or home-care actions and any additional recommendation notes.

Required data to record:
- `recommendations`: multi-toggle label `Recommendations`; options:
  - High fluoride toothpaste (Prevident 5000)
  - Mouthwash (0.05% X-PUR Opti-Rinse)
  - Salt water rinse for 2-3 days
  - Water flosser
  - Electric toothbrush
  - Xylitol pastilles
- `recommendationsNotes`: textarea label `Recommendation notes`; placeholder `Add recommendation details when needed.`

Decision options:
- Recommendations can be selected independently of caries risk / periodontal status.
- Notes can be entered without selecting a recommendation.

Notes/events to generate:
- `Recommendations: {recommendations}. {notes}.`
- Recommendation labels are lowercased at the first letter in summary output unless already case-sensitive internally.

Guards or required fields:
- [] Decide whether specific recommendations should be suggested automatically from caries risk, deposits, or periodontal status.
- [] Confirm whether `Xylitol pastilles` should remain in recommendation catalog.

### Step 10: Treatment Done Today
Clinical instruction:
- Record which hygiene care items were completed today, including instrumentation details when applicable.

Required data to record:
- `treatmentDoneToday`: multi-toggle label `Completed today`; options:
  - Med/dent history update
  - EOE/IOE
  - Nutrition score
  - Gingival assessments
  - Calculus index
  - Caries risk
  - Periodontal risk assessment
  - Spot probing
  - Full mouth probing
  - Plaque score with disclosing solution
  - OHE reinforced
  - Reviewed homecare
  - Hand and Power Instrumentation
  - Ipana 5% NaF varnish application
- `Select Core` action selects:
  - Med/dent history update
  - EOE/IOE
  - OHE reinforced
  - Reviewed homecare
- If `Hand and Power Instrumentation` is selected:
  - `treatmentDoneTodayInstrumentationDevices`: multi-toggle label `Power instrumentation device (today)`; options: Cavitron, Piezo.
  - `treatmentDoneTodayInstrumentationAreas`: multi-toggle label `Instrumentation area (today)`; options:
    - Q1
    - Q2
    - Q3
    - Q4
    - Full mouth
    - Maxilla
    - Mandible
    - Sextant 1
    - Sextant 2
    - Sextant 3
    - Sextant 4
    - Sextant 5
    - Sextant 6
- `treatmentDoneTodayNotes`: textarea label `Treatment done today notes`; placeholder `Add details for treatment done today.`

Decision options:
- Instrumentation device and area controls appear only when `Hand and Power Instrumentation` is selected.
- If `Hand and Power Instrumentation` is deselected, clear instrumentation devices and areas.

Notes/events to generate:
- `Treatments completed today: {selected items}. {notes}.`
- If `Hand and Power Instrumentation` has devices, output label becomes `Hand and Power Instrumentation ({devices})`.
- If `Hand and Power Instrumentation` has areas, output becomes `{areas} Hand and Power Instrumentation ({devices})`.

Guards or required fields:
- [] Decide whether selecting `Hand and Power Instrumentation` should require device and area before export.
- [] Decide whether fluoride varnish application requires a separate consent or product detail field.

### Step 11: Next Appointment
Clinical instruction:
- Record planned next appointment care and instrumentation details when applicable.

Required data to record:
- Action: `Copy from Treatment Done Today`.
- `nextAppointment`: multi-toggle label `Planned next appointment care`; same options as Treatment Done Today.
- `Select Core` action selects:
  - Med/dent history update
  - EOE/IOE
  - OHE reinforced
  - Reviewed homecare
- If `Hand and Power Instrumentation` is selected:
  - `nextAppointmentInstrumentationDevices`: multi-toggle label `Power instrumentation device (next appointment)`; options: Cavitron, Piezo.
  - `nextAppointmentInstrumentationAreas`: multi-toggle label `Instrumentation area (next appointment)`; same instrumentation area options as Treatment Done Today.
- `nextAppointmentNotes`: textarea label `Next appointment notes`; placeholder `Add details for next appointment.`

Decision options:
- `Copy from Treatment Done Today` copies:
  - `treatmentDoneToday` -> `nextAppointment`
  - `treatmentDoneTodayInstrumentationDevices` -> `nextAppointmentInstrumentationDevices`
  - `treatmentDoneTodayInstrumentationAreas` -> `nextAppointmentInstrumentationAreas`
- Instrumentation device and area controls appear only when `Hand and Power Instrumentation` is selected.
- If `Hand and Power Instrumentation` is deselected, clear next-appointment instrumentation devices and areas.

Notes/events to generate:
- `Next Appointment: {selected items}. {notes}.`
- Instrumentation formatting follows the same rule as Treatment Done Today.

Guards or required fields:
- [] Decide whether next appointment care should be required when a continuity interval is selected.
- [] Decide whether copying from today's care should also copy notes or intentionally not copy notes.

### Step 12: Local Anesthesia
Clinical instruction:
- Document local anesthesia only when it is relevant to the hygiene visit.

Required data to record:
- `localAnesthesiaNoContraindication`: multi-toggle label `Local anesthesia toggles`; option: No C/I to LA.
- If `No C/I to LA` is selected:
  - Repeatable `localAnesthesiaEntries`.
  - Actions:
    - Add injection entry.
    - Add topical entry.
    - Remove entry.
    - Set to now.
    - Clear time.
- Each local anesthesia entry records:
  - `route`: select label `Route`; options: None selected, Injection, Topical.
  - Conditional type field:
    - If route is `Injection`: label `Injection type`; options: None selected, I/O, M/I, PSA, IA/L, Buccal NB, GP, NP.
    - If route is `Topical`: label `Application type`; options: None selected, Mucosal application, Sulcular application.
  - `quadrant`: select label `Quadrant`; options: None selected, Q1, Q2, Q3, Q4.
  - `anestheticProduct`: select label `Anesthetic product`.
    - Injection products:
      - Articaine 4% with 1:200K epinephrine
      - Lidocaine 2% with 1:100K epinephrine
      - Mepivacaine 3% without epinephrine
    - Topical products:
      - Benzocaine 20% paste
      - ORAQIX (lidocaine and prilocaine periodontal gel) 2.5%/2.5%
  - `amountMl`: input label `Amount (ml)`.
  - `timeAdministered`: time input label `Time administered`.
- Default / product amount behavior:
  - Empty local anesthesia entry defaults route to `Injection` and amount to `1.8`.
  - Add injection entry creates route `Injection` and amount `1.8`.
  - Add topical entry creates route `Topical` and amount blank.
  - Topical product defaults:
    - Benzocaine 20% paste: `0.5`.
    - ORAQIX (lidocaine and prilocaine periodontal gel) 2.5%/2.5%: `1.7`.
- Post-anesthetic assessment:
  - Multi-toggle label `Anesthesia assessment`; options:
    - No adverse reactions noted
    - Adequate anesthesia achieved
  - `localAnesthesiaNotes`: textarea label `Anesthesia notes`; placeholder `Add anesthesia assessment notes.`

Decision options:
- If `No C/I to LA` is not selected, local anesthesia entries, assessment toggles, and notes are hidden/cleared.
- Route controls whether `Injection type` or `Application type` is shown.
- Route controls which anesthetic products are available.
- Route change clears incompatible injection/application fields and incompatible product.
- Topical route starts with blank amount, then product selection can apply a default amount.
- Post-anesthetic assessment block is highlighted when:
  - `No C/I to LA` is selected, and
  - at least one local anesthesia entry exists, and
  - both `No adverse reactions noted` and `Adequate anesthesia achieved` are false.
- Highlight message: `Complete the post-anesthetic assessment before finishing the note.`

Notes/events to generate:
- Summary heading when no contraindication selected: `Local anesthetic administered: No C/I to LA`.
- Injection detail line:
  - `{injectionType} {quadrant}: {product} {amountMl} ml (at {time})`
- Topical detail line:
  - `{applicationType} {quadrant}: {product} {amountMl} ml (at {time})`
- Totals:
  - `Total: {product} {totalAmount} ml`
- Assessment lines:
  - `No adverse reactions noted`
  - `Adequate anesthesia achieved`
- Additional notes appended as cleaned sentence text.

Guards or required fields:
- An entry is omitted from summary unless route, quadrant, product, and amount are present.
- Injection entries also require injection type to appear in summary.
- Topical entries also require application type to appear in summary.
- [] Decide whether the highlighted post-anesthetic assessment should become a hard blocker before copy/export.
- [] Decide whether topical products should use `ml` in output or a more clinically specific unit.

### Step 13: Continuity of Care
Clinical instruction:
- Record hygiene follow-up interval recommendations.

Required data to record:
- Section label: `Hygiene follow-up interval`.
- `disposition`: repeatable options initialized from `DISPOSITION_INTERVAL_OPTIONS`:
  - `DH Re-eval`
    - key: `reEval`
    - default interval: `4-6`
    - default unit: `weeks`
    - trailing label: empty
  - `DH Re-care`
    - key: `reCare`
    - default interval: `3-4`
    - default unit: `months`
    - trailing label: `interval`
- Each disposition option has:
  - `enabled`: checkbox.
  - `interval`: text input placeholder `e.g. 4-6`.
  - `unit`: select options: weeks, months.

Decision options:
- Disabled disposition options are hidden from summary.
- Enabled options generate a line with label, interval, unit, and trailing label when present.

Notes/events to generate:
- Summary block:
  - `Continuity of Care`
  - `DH Re-eval at 4-6 weeks`
  - `DH Re-care at 3-4 months interval`

Guards or required fields:
- If enabled with no interval and unit, output falls back to just the label.
- [] Decide whether enabled intervals require numeric/range validation.
- [] Decide whether both Re-eval and Re-care can be selected together or should be mutually exclusive.

### Step 14: Additional Clinical Documentation
Clinical instruction:
- Add any remaining clinical findings that do not fit the structured sections.

Required data to record:
- `otherClinicalFindings`: textarea label `Other clinical findings`; placeholder `Add any additional clinical findings.`

Decision options:
- Free-text field only.

Notes/events to generate:
- `Other clinical findings: {otherClinicalFindings}.`

Guards or required fields:
- [] Decide whether this field should be displayed near the end only or made available earlier as an overflow note.

### Step 15: Summary Preview and Actions
Clinical instruction:
- Provide chart-ready output and a structured review of selected tags.

Required data to record:
- `summaryTab`: `plain-text` or `tags`.
- `summaryText`: generated by `buildSummaryText(form, selectedFindings)`.
- `selectedFindings`: generated by `collectSelectedFindings(form.findings)`.
- `depositTagItems`: enabled Plaque, Calculus, and Extrinsic Stain cards.

Decision options:
- Tabs:
  - Plain text
  - Tags
- Actions:
  - Copy summary
  - Load demo
  - Reset form
- Very-short variant additionally places action buttons in the summary panel.
- `Load demo` and `Reset form` use confirmation before replacing current form data.
- Browser beforeunload warning text:
  - `WARNING: This will replace the current form and DELETE ALL ENTERED DATA. Do you want to continue?`

Notes/events to generate:
- Plain-text output joins non-empty summary blocks with blank lines.
- Tags output displays selected gingival findings and enabled deposit cards.
- If no gingival findings or deposit tags are selected, tags tab shows:
  - `No gingival findings or deposit tags selected yet.`

Guards or required fields:
- Copy summary uses Clipboard API when available, then falls back to temporary textarea and `document.execCommand("copy")`.
- After successful copy, button text changes from `Copy summary` to `✓ Copied!` temporarily.
- [] Decide whether generated summary should be copied as a single EMR note or split into EMR sections.
- [] Decide whether a JSON export should be added for implementation/testing.

## Shared Output Contract
- Empty blocks are omitted.
- Sentences are trimmed and duplicate trailing periods are removed before output.
- Most note fields are cleaned, capitalized, and given a final period.
- Blocks appear in this order:
  1. Header block: Date, Provider.
  2. Patient concerns.
  3. Medical history / vitals.
  4. EOE.
  5. IOE.
  6. Gingival Description.
  7. Calculus.
  8. Plaque.
  9. Extrinsic Stain.
  10. Periodontal diagnosis.
  11. Caries risk.
  12. OHE.
  13. Recommendations.
  14. Treatments completed today.
  15. Next Appointment.
  16. Local anesthetic administered.
  17. Other clinical findings.
  18. Continuity of Care.

## Open Implementation Questions
- [] Should patient identity, chart number, and appointment type live in this form or in a parent note wrapper? - this is one of the main workflows, but this should be part of any chart note output.
- [] Should consent be added as a required field, especially for fluoride varnish and local anesthesia?
- [] Should radiographs be part of this workflow, or only linked from another diagnostic module? - separate shared module, not fully implemented.
- [] Should periodontal charting measurements become structured inputs rather than just selectable care items? - EMR has separate periodontal chart.
- [] Should WNL toggles be allowed alongside findings, or should findings automatically unset WNL? Unset WNL, but allow user to check it back on.
- [] Should local anesthesia post-assessment be a hard validation blocker? - Yes, but anesthesia is it's own shared module.
- [] Should caries risk and periodontal status automatically suggest OHE topics/recommendations? - Yes, 
- [] Should Treatment Done Today and Next Appointment use the same shared care catalog object rather than duplicated field groups? - Not sure
- [] Should `very-short` be treated as a distinct workflow variant or only a display mode? - Neither. Can be omited as this was used in hygienenote.com when testing different variants. 
