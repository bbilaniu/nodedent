# ADR 0007: Define the Supported Clinical-Data Deployment Mode

## Status

Accepted

## Context

NodeDent currently persists complete case records in browser `localStorage` and supports JSON and human-readable exports. The stored record can contain patient identifiers and clinical content. Record keys and export filenames can also expose patient-derived metadata.

That architecture is appropriate for a prototype only when its data boundary is explicit. It is not enough to add isolated storage controls before deciding whether NodeDent supports real patient information, which threat model applies, and who controls the storage key and device.

The historical [2026-07-11 website review](../reviews/2026-07-11-website-review.md) identified three materially different product modes:

1. Prototype/no-PHI mode, with a clear prohibition and persistent warning.
2. Local clinical mode, with protected local records, an independent key, inactivity locking, device/profile requirements, retention, and recovery policy.
3. Authenticated clinical mode, with durable server-side storage and intentionally limited local caching.

## Decision Drivers

- Whether real patient identifiers are permitted.
- Applicable privacy, security, and clinical-record obligations by jurisdiction and clinic environment.
- Shared-computer, lost-device, malicious-extension, XSS, browser-profile synchronization, backup, and exported-file risks.
- Offline and recovery requirements.
- Authentication, authorization, auditability, retention, deletion, and key-management responsibilities.
- The operational burden NodeDent is prepared to support.

## Decision

NodeDent supports **prototype/no-PHI mode** for its current release stage. Real patient identifiers and protected health information must not be entered, stored, imported, or transmitted through the application.

The product must make this boundary explicit with a persistent warning and must not represent the current browser-storage architecture as suitable for routine clinical recordkeeping. Acceptance of this ADR selects the supported mode; it does not mean that every enforcement and integrity control has already been implemented.

Local clinical mode and authenticated clinical mode remain possible future deployment models. Their requirements are retained below so that later implementation is deliberate rather than inferred from incremental storage changes.

Before NodeDent changes its supported mode or represents itself as suitable for routine use with real patient information:

1. Select either local clinical mode or authenticated clinical mode for that release stage.
2. Document permitted and prohibited uses and the supported device/profile environment.
3. Obtain a privacy/security review appropriate to the intended jurisdiction and clinic setting.
4. Define the threat model, retention/deletion rules, backup/recovery behavior, and export boundary.
5. Update product copy, persistence architecture, tests, and deployment controls to enforce the selected mode.

This ADR does not select encryption, server storage, authentication, or a specific regulatory framework for a future clinical mode.

## Consequences

- Privacy-sensitive persistence work must reference this ADR and avoid silently selecting a deployment model.
- Product copy and application surfaces must clearly prohibit use with real patient information until this decision is superseded and the replacement mode is implemented.
- Random encounter identifiers, safer filenames, import validation, destructive-action protection, and visible storage failures can proceed because they improve every mode.
- Encryption, authentication, server persistence, inactivity locking, telemetry, and offline guarantees remain blocked on the selected deployment mode and threat model.
- Local clinical and authenticated clinical requirements remain documented future options, not supported capabilities.
- Product metadata and public indexing decisions must remain consistent with the supported mode.

## Follow-Up

- Add and verify the persistent prototype/no-PHI warning.
- Implement mode-independent integrity and recovery work through [Local data integrity and recovery](../specs/local-data-integrity-and-recovery.md).
- Revisit and supersede this decision when server persistence, multi-user access, clinic synchronization, local clinical use, or formal clinical deployment is proposed.
