# ADR 0008: Adopt a Constrained Local Clinical Mode

## Status

Proposed

## Context

NodeDent is intended to support real chairside workflows on a clinic-controlled device and browser profile. ClearDent or Dentrix remains the sole official clinical record. NodeDent is a temporary workflow and note-generation workspace, not an electronic medical record and not an authoritative retention system.

The intended data set excludes names, exact dates of birth, addresses, telephone numbers, email addresses, provincial health numbers, insurance identifiers, and other direct identifiers. It permits a clinic patient chart number and the minimum clinical facts needed to run the selected workflow and generate a note.

A chart number combined with clinical details is still identifying health information because the clinic can link it to a person. Removing names and dates of birth does not make the record anonymous or de-identified. The initial jurisdiction is Alberta, where implementation of a new system that processes identifying health information may require a Privacy Impact Assessment before use. NodeDent should preserve a conservative technical baseline for later assessment elsewhere in Canada, including Quebec, without claiming that one implementation automatically satisfies every provincial law.

Relevant official guidance includes:

- [Alberta OIPC Privacy Impact Assessment FAQ](https://oipc.ab.ca/resource/privacy-impact-assessments-frequently-asked-questions/)
- [Alberta OIPC Electronic Health Record Systems Guidance](https://oipc.ab.ca/resource/electronic-health-record-systems/)
- [Office of the Privacy Commissioner of Canada fair information principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [Quebec Act respecting the protection of personal information in the private sector](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)
- [Quebec Act respecting health and social services information](https://www.legisquebec.gouv.qc.ca/en/document/cs/R-22.1)

These sources inform the design baseline but do not replace a clinic-specific privacy, security, professional, or legal review.

## Decision

After the implementation gate below is complete, NodeDent will support a **constrained local clinical mode** with these boundaries:

- Real clinic chart numbers and necessary clinical workflow facts are permitted.
- Names, exact dates of birth, addresses, contact details, government health numbers, insurance identifiers, and other unnecessary direct identifiers are prohibited.
- Real clinical data may be used only on a clinic-controlled device, operating-system account, and browser profile over HTTPS.
- The clinic must apply device encryption, automatic screen locking, controlled physical access, approved browser extensions, and a retention/deletion policy.
- NodeDent does not send clinical data to a NodeDent server, telemetry service, analytics service, or structured EMR integration.
- ClearDent or Dentrix remains the official clinical record. The clinician transfers the final plain-text note and verifies it in that system.
- NodeDent must state that browser-held and exported records contain identifying clinical information; it must not describe chart-number records as anonymous, de-identified, or non-PHI.

NodeDent will use a new protected clinical-storage namespace. Existing prototype `localStorage` records will **not** be migrated, copied, or silently imported into it. The application may detect legacy data and offer explicit export or deletion, but clinical mode starts with an empty protected store. Legacy deletion must remain an explicit, confirmed user action.

The protected store will be designed around:

- random immutable encounter identifiers unrelated to chart number, tooth, procedure, or diagnosis;
- transactional IndexedDB storage rather than case JSON in `localStorage`;
- authenticated encryption of case records and indexes using browser Web Crypto primitives;
- an unlock secret whose usable encryption key is retained only in memory;
- inactivity locking and explicit locking;
- versioned encrypted envelopes, atomic writes, structured storage failures, conflict detection, and recoverable backups;
- minimum unencrypted metadata limited to what is required to locate and decrypt the vault;
- an explicit retention and purge workflow consistent with ClearDent or Dentrix being the official record.

Application encryption protects data at rest while the vault is locked. It does not protect an unlocked session from malicious same-origin code, compromised dependencies, hostile browser extensions, an already-compromised device, or an authorized user misusing data. Content security policy, dependency controls, device safeguards, short retention, and operational review remain necessary.

## Export Boundary

EMR transfer is limited to clinician-mediated plain text under [ADR 0009](0009-defer-structured-emr-interoperability.md).

NodeDent case exports are application backup/continuation artifacts, not EMR integrations. A plaintext case export must require an explicit warning that the file contains identifying clinical information. Its default filename will use this structure:

`YYYY_MM_DD_<chart-number>_<discipline>_<encounter-suffix>.json`

- Date is the encounter date used for filing, not a birth date.
- Chart number is sanitized for cross-platform filename safety.
- Discipline is a short controlled code such as `ENDO`, `OPERATIVE`, or `HYGIENE`; detailed procedure, diagnosis, area, and tooth are excluded from the default filename.
- Encounter suffix is short, random, and non-identifying so same-day files cannot collide.
- Blank or invalid chart numbers use a generic fallback and must not silently insert another patient fact.

An encrypted NodeDent backup format may later become the default. A separate share-safe or de-identified export must not be offered until its removal rules and re-identification risks are specified and tested.

## Canadian Compatibility Boundary

The product architecture will support data minimization, explicit purposes, limited retention, access control, safeguards proportional to sensitivity, traceable failures, and confidentiality-incident response. These are portability goals, not a representation of compliance.

Before clinical deployment in another province or territory, the clinic or deployer must evaluate the applicable health-information, private-sector privacy, professional, retention, breach-notification, residency, and cross-border-processing requirements. Quebec deployment must receive a Quebec-specific assessment of the current private-sector and health and social services information regimes before real data is enabled there.

## Implementation Gate

This ADR does not authorize real patient data immediately. [ADR 0007](0007-define-clinical-data-deployment-mode.md) remains controlling until all of the following are complete:

1. The protected storage, locking, failure, export, deletion, and legacy-data boundaries are implemented and tested.
2. Product warnings and deployment documentation match this decision.
3. NodeDent has no unintended clinical-data network transmission.
4. A threat-model review and dependency/security review are complete.
5. The Alberta clinic completes the privacy and operational review required for its intended use, including a PIA where applicable.
6. This ADR is accepted and ADR 0007 is marked superseded.

## Consequences

- Local clinical support is materially more complex than retaining plaintext browser records.
- Loss of the unlock secret can make local records unrecoverable; backup and recovery behavior must be explicit.
- Browser storage remains temporary working storage and cannot replace the clinic EMR.
- No legacy storage migration will be built or tested.
- Structured ClearDent or Dentrix integration remains outside this decision.
