# Local Clinical Threat Model

## Scope And Assets

This threat model covers NodeDent's constrained local clinical mode on one clinic-controlled device and browser profile. The protected assets are the chart number, clinical workflow facts, generated notes, encrypted vault, vault passphrase/key, plaintext exports, and the integrity of the draft transferred to ClearDent or Dentrix.

ClearDent or Dentrix remains the official record. NodeDent has no server account, server-side clinical storage, synchronization, application telemetry, remote logging, or structured EMR connection in the current build. A future deployment may add separately reviewed operational telemetry only when it contains no patient data or linkable clinical identifier and the provider, purpose, fields, retention, access, processing location, and product notice are documented.

## Trust Boundaries

1. **Reviewed static build and origin:** JavaScript executes with access to decrypted data while unlocked. The production CSP blocks network connections but cannot make malicious same-origin code trustworthy.
2. **Browser profile and IndexedDB:** encrypted envelopes and minimum vault metadata persist here. Browser deletion or eviction can remove them.
3. **In-memory unlocked session:** the non-extractable Web Crypto key and decrypted React state exist until lock or page teardown.
4. **Device and operating system:** disk encryption, account access, screen lock, malware controls, backups, and physical access are clinic responsibilities.
5. **Clipboard and Downloads:** copied or downloaded outputs leave the vault as plaintext and inherit operating-system and clinic controls.
6. **ClearDent or Dentrix:** the clinician selects the destination chart and verifies the saved note; NodeDent receives no confirmation from the EMR.

## Threats, Controls, And Residual Risk

| Threat | Implemented control | Residual risk / required operation |
|---|---|---|
| Disk or browser-profile inspection while locked | AES-256-GCM records; PBKDF2-SHA-256 at 600,000 iterations; random salt and IV; no persisted usable key | Passphrase quality, endpoint compromise, memory capture, and offline guessing remain relevant. Use disk encryption and controlled accounts. |
| Record or backup tampering | AES-GCM additional authenticated data binds encounter ID and revision; restore authenticates verifier and every case before replacement | Authorized deletion and total storage loss are still possible. Maintain tested approved backups. |
| Patient facts exposed through storage keys or indexes | Random encounter UUID is the IndexedDB key; summaries are inside encrypted payloads | Vault metadata exposes format, KDF parameters, retention setting, and a random active encounter ID. |
| Stale tab overwrites newer work | Monotonic revisions, transactional comparison, conflict refusal, single-active-tab broadcast | Broadcast delivery is best-effort; a stale tab can still require manual export/reopen. No silent overwrite is allowed. |
| Unattended unlocked workspace | Explicit lock, 15-minute inactivity lock, hidden-tab/page-exit lock, cross-tab lock | Device sleep/lock behavior remains an OS responsibility. Browser/runtime failure may affect timers. |
| Browser eviction or local corruption | Persistent-storage request, visible denial warning, authenticated encrypted backup/restore | Browser persistence is not guaranteed; backup frequency and secure storage are clinic decisions. |
| Accidental network disclosure | Current production CSP uses `connect-src 'none'`; the static source check rejects common network APIs; current application telemetry and analytics are absent | CSP meta cannot replace all hosting headers and cannot protect against a malicious or replaced build that removes it. Verify the deployed artifact. Enabling non-patient operational telemetry requires a new reviewed allowlist, data-flow verification, notice update, and tests; no patient field or linkable clinical identifier may enter it. |
| XSS or compromised dependency/build | Strict production script/style sources and no network connections | Same-origin malicious code can read unlocked state, alter outputs, or create plaintext downloads. Dependency and build-provenance review is required. |
| Hostile browser extension or device malware | None inside the web app | Restrict extensions, patch and protect the endpoint, and use clinic incident controls. |
| Clipboard/download disclosure | Persistent warnings and explicit confirmation; filenames minimize patient facts beyond chart number | Clipboard managers, backups, sync agents, and Downloads remain outside the vault. Use approved destinations and secure deletion. |
| Wrong EMR patient or incomplete transfer | Text-only workflow requires destination and content verification; no delivery claim | Human matching error remains. Structured matching/reconciliation is deferred by ADR 0009. |
| Legacy plaintext browser records | Detection by key only; no parse/copy/migration; explicit raw backup or typed-confirmation deletion | A requested legacy backup is plaintext. Old records remain exposed until the clinic handles or deletes them. |
| Patient data entered into reusable preferences | Case data is routed to the encrypted vault; theme and reusable catalog storage is structurally separate | Catalog labels are plaintext non-patient preferences. Users must not place a chart number, patient fact, or identifier in a reusable shortcut. |
| Forgotten passphrase | Explicit no-recovery warning and encrypted backup support | Without the passphrase, backups are also unrecoverable. Clinic secret custody is required. |

## Excluded Or Deferred Scenarios

- multi-user authorization and audit identity;
- server compromise, cloud synchronization, or cross-device data sharing;
- direct ClearDent or Dentrix APIs and automated patient matching;
- a claim of anonymization or de-identification;
- protection of an unlocked compromised browser or endpoint;
- jurisdictional compliance certification.

## Review Gate

Before ADR 0008 is accepted, reviewers must verify this model against the actual hosting origin, built artifact, clinic device/profile configuration, backup and deletion process, incident workflow, dependency inventory, and Alberta privacy assessment. Quebec or another jurisdiction requires an additional applicable-law and operational review. Findings that change assets, trust boundaries, or expected attackers must update this document and the implementation before clinical approval.
