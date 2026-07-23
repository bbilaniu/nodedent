# Local Clinical Deployment Guide

## Current Gate

NodeDent's protected local clinical mode is technically implemented but is not authorized for real patient data by the repository decision alone. [ADR 0007](../adr/0007-define-clinical-data-deployment-mode.md) remains controlling until [ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md) is accepted and its clinic-specific implementation gate is complete.

This guide is an operational baseline, not a compliance certification or legal opinion. The initial assessment is for an Alberta clinic. Deployment elsewhere in Canada requires a jurisdiction-specific review; Quebec requires review under its applicable private-sector and health and social services information regimes.

## Permitted Data After Approval

After the clinic approves clinical deployment, NodeDent may contain:

- the clinic patient chart number;
- the minimum clinical facts required by the workflow;
- generated clinical notes and workflow events.

Do not enter names, exact dates of birth, addresses, telephone numbers, email addresses, provincial health numbers, insurance identifiers, or unrelated identifying information. A chart number plus clinical facts is still identifying health information because the clinic can link it to a patient.

ClearDent or Dentrix is the sole official clinical record. NodeDent is temporary working storage and does not prove that a note was saved to the EMR.

## Device And Browser Baseline

Before unlocking NodeDent with approved clinical data, the clinic must verify:

- the device is clinic-controlled and uses supported operating-system security updates;
- full-disk encryption and automatic screen locking are enabled;
- each authorized user has an appropriate operating-system/browser profile;
- physical access is controlled and browser synchronization is disabled or reviewed;
- browser extensions are restricted to a clinic-approved list;
- NodeDent is served over HTTPS from a reviewed build;
- the deployed page contains the production CSP, including `connect-src 'none'`;
- host-level headers add protections unavailable from a CSP meta element, including anti-framing policy where required;
- the clinic has approved retention, backup, secure deletion, incident response, and downtime procedures.

Run `npm run build` followed by `npm run security:check` against the exact artifact before deployment. Review dependency advisories and build provenance under the clinic's release process.

## Vault Setup And Daily Use

1. Create a unique vault passphrase of at least 12 characters. NodeDent does not store or recover it.
2. Store any recovery copy of the passphrase through the clinic's approved secret-management process, separate from encrypted vault backups.
3. Confirm whether the browser grants persistent storage. If it does not, export encrypted backups regularly because the browser may evict storage under pressure.
4. Enter only the chart number in the patient field and only minimum necessary clinical content elsewhere.
5. Copy or download the final plaintext note, select the matching ClearDent or Dentrix chart, verify the patient and content, and confirm the EMR save.
6. Delete temporary NodeDent cases according to clinic policy. Items marked past the retention review date require a deliberate review; NodeDent does not silently purge them.
7. Lock the vault before leaving the device. NodeDent also locks after 15 minutes without interaction, when hidden, when leaving the page, and when another tab becomes active.

The unlocked key exists only in browser memory. Encryption protects the locked records at rest; it does not protect an unlocked session from a compromised device, malicious same-origin build, hostile extension, screen capture, clipboard access, or an authorized user.

## Exports, Clipboard, And Browser Storage

- The encrypted `.nodedent` whole-vault backup is the preferred recovery artifact. It requires the original passphrase.
- Plaintext `.txt` and `.json` downloads contain identifying clinical information. The system clipboard and Downloads folder are outside the encrypted vault.
- Plaintext filenames use `YYYY_MM_DD_<chart-number>_<discipline>_<encounter-suffix>`. They omit names, dates of birth, diagnosis, detailed procedure, area, and tooth, but the chart number remains identifying.
- A NodeDent JSON file is an application continuation/backup artifact, not an EMR format.
- Existing prototype `localStorage` data is never migrated. The lock screen may offer a raw plaintext legacy backup or confirmed deletion; use clinic-approved storage and handling for that backup.
- The display theme and reusable anesthesia/isolation shortcut catalogs remain outside the clinical vault as non-patient preferences. Never put a chart number, patient-specific fact, or other identifier into a reusable shortcut label.

## Backup, Recovery, And Deletion

- Test encrypted backup restore with synthetic data before clinical approval and periodically afterward.
- Authenticate and restore backups only on an approved clinic device. NodeDent validates the vault verifier and every encrypted case before replacing an existing vault.
- Keep at least one approved recovery copy when the clinic's downtime plan requires it, and securely delete expired copies.
- Clear-current, delete-case, reset-all, legacy deletion, and vault replacement are distinct actions. Read the displayed scope before confirming.
- If corruption or passphrase loss makes the vault unusable, the lock screen can delete the entire encrypted vault after a typed confirmation. This is irreversible and should follow the clinic's recovery and retention process.
- If autosave reports failure or conflict, do not assume the draft is durable. If clinic policy allows, export the current plaintext JSON to an approved destination, then lock and reopen the latest protected record.
- Loss of both the passphrase and an unlocked session makes encrypted records unrecoverable.

## Incident And Change Response

Stop using NodeDent for clinical data and follow the clinic's incident process if a device, browser profile, passphrase, plaintext export, backup, extension, or deployed build may be compromised. Preserve only the minimum evidence permitted by clinic policy; do not paste clinical data into public issue trackers, analytics, remote logs, or support chats.

The current build sends no application telemetry and blocks application network connections. Re-run the privacy/security assessment before changing the hosting origin, CSP, analytics/telemetry policy, storage model, browser profile model, retention period, data fields, supported province, or EMR transfer method. Any future operational telemetry must exclude patient data and linkable clinical identifiers, be documented in the product privacy policy, and be technically verified before activation. Structured EMR connectivity requires a separate decision under [ADR 0009](../adr/0009-defer-structured-emr-interoperability.md).

Official background sources are linked from [ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md), including Alberta OIPC guidance and the applicable federal and Quebec materials. The clinic must determine which obligations apply to its organization and intended deployment.
