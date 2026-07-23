# ADR 0009: Defer Structured EMR Interoperability

## Status

Accepted

## Context

ClearDent and Dentrix are clinic systems that hold official clinical records. NodeDent generates clinical notes and workflow data, but direct interoperability would require vendor-specific APIs or file formats, patient matching, authentication and authorization, audit behavior, retry and reconciliation rules, contractual review, and jurisdiction-specific privacy assessment.

Treating copied text or a NodeDent JSON backup as structured EMR integration would obscure those responsibilities and create avoidable record-integrity risk.

## Decision

For the current product stage, NodeDent supports EMR transfer only as clinician-mediated plain text:

- The clinician copies or downloads a generated text note.
- The clinician places it in the matching ClearDent or Dentrix patient record.
- The clinician reviews the destination patient, content, and successful save in the EMR.
- NodeDent does not look up EMR patients, write directly to an EMR, claim delivery, or reconcile later EMR changes.
- NodeDent JSON or encrypted case exports are NodeDent backup/continuation artifacts and are not EMR interchange formats.

Text output should remain predictable and easy to verify, but NodeDent will not implement ClearDent- or Dentrix-specific structured formats in the current local clinical storage work.

## Future Reconsideration

Structured interoperability requires a new proposal that addresses at least:

- supported vendor, product version, API, and contractual access;
- authoritative patient and encounter matching;
- minimum necessary data mapping and terminology ownership;
- authentication, authorization, user identity, and audit trails;
- transport security, residency, subprocessors, and information-manager responsibilities;
- duplicate writes, partial failures, retry idempotency, correction, and reconciliation;
- clinician preview, confirmation, and proof of destination save;
- sandbox and production integration testing;
- Alberta and target-jurisdiction privacy/security review.

That proposal may supersede this ADR only for explicitly supported integrations. Plain-text transfer remains the fallback boundary.

## Consequences

- Current development can focus on safe local workflow state and reliable note output.
- Clinicians retain responsibility for selecting the correct EMR record and verifying transferred text.
- There is no automatic assertion that NodeDent data has become part of the official record.
- Future interoperability remains possible without prematurely coupling the clinical model to one vendor.
