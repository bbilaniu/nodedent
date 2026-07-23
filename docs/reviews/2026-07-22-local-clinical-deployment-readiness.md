---
document_type: review
status: in-progress
reviewed_on: 2026-07-22
reviewed_commit: 7d4f4568c88d33afa8d3e64c3969da10bf38e2db
reviewed_url: https://nodedent.com
review_method: source-ci-live-host-and-readiness-review
---

# Local Clinical Deployment Readiness Review

> This is the audit index for the proposed constrained local clinical deployment
> of NodeDent `1.0.0` at commit
> `7d4f4568c88d33afa8d3e64c3969da10bf38e2db`. It records verified controls,
> evidence, limitations, and outstanding approval gates for the intended Alberta
> clinic deployment.

## Current Decision

**Not yet authorized for real patient information.**

[ADR 0007](../adr/0007-define-clinical-data-deployment-mode.md) remains
controlling, and [ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md)
remains Proposed. Production testing must use synthetic data until every
outstanding item in this record and ADR 0008's implementation gate is completed,
reviewed, and approved.

The deployed technical controls, CI, and initial live-host checks have passed.
Clinic-device testing, manual failure testing, operational procedures,
independent security and dependency review, and the clinic's Alberta privacy
assessment and PIA determination remain pending.

## Scope

This review covers:

- the production application build and deployment workflow;
- the public hosting path through Cloudflare and GitHub Pages;
- the protected browser vault and its documented security boundaries;
- automated source, domain, storage, documentation, and deployment checks;
- the synthetic tests required on the intended clinic device and browser profile;
- clinic backup, deletion, retention, incident, and downtime procedures;
- the evidence required before ADR 0008 can be accepted.

This review does not certify compliance, replace a Privacy Impact Assessment,
provide a legal opinion, or authorize NodeDent as an official clinical record.
ClearDent or Dentrix remains the sole official record.

## Evidence Handling

This repository is public. Do not commit patient information, credentials,
private network details, passphrases, staff identifiers, confidential
configuration exports, screenshots containing secrets, incident records, or the
clinic's complete privacy assessment or PIA.

Sensitive evidence must remain in the clinic's approved compliance repository.
This record should contain only its document identifier, owner or role, review
date, approval status, and a non-sensitive summary.

| External evidence | Clinic-controlled reference | Status |
| --- | --- | --- |
| Alberta privacy assessment | Pending | Not recorded |
| PIA determination or submitted PIA | Pending | Not recorded |
| Device and browser configuration evidence | Pending | Not recorded |
| Backup, restore, retention, and deletion procedure | Pending | Not recorded |
| Incident and downtime procedure | Pending | Not recorded |
| Independent threat and dependency review | Pending | Not recorded |

## Release And Deployment Identity

| Item | Verified value | Status |
| --- | --- | --- |
| Application version | `1.0.0` | Verified |
| Production commit | `7d4f4568c88d33afa8d3e64c3969da10bf38e2db` | Verified |
| Pull request | [#13 — Add protected local clinical mode](https://github.com/bbilaniu/nodedent/pull/13) | Merged |
| Production URL | [https://nodedent.com](https://nodedent.com) | Verified |
| PR quality run | [GitHub Actions run 29971877766](https://github.com/bbilaniu/nodedent/actions/runs/29971877766) | Passed |
| Post-merge CI run | [GitHub Actions run 29971915839](https://github.com/bbilaniu/nodedent/actions/runs/29971915839) | Passed |
| Pages deployment run | [GitHub Actions run 29971915861](https://github.com/bbilaniu/nodedent/actions/runs/29971915861) | Passed |
| Deployed `index.html` SHA-256 | `3f46e4c7b03d4560fe0aa1663cc1b8bd4b6fa8f7ab9a1b0a53ae6ffc4dccbc8f` | Matched reviewed local artifact |
| Deployed JavaScript asset | `assets/index-CIKgYYh0.js` | Observed |
| Deployed CSS asset | `assets/index-B3etOoyY.css` | Observed |

The Pages workflow installed locked dependencies, built the identified commit,
ran the clinical security check against that build, and deployed its `dist`
artifact. A live fetch of production `index.html` matched the locally reviewed
artifact hash above.

## Live Hosting Verification

These results were observed against the public host after deployment and after
the Cloudflare configuration changes made on 2026-07-22.

| Control | Observation | Status |
| --- | --- | --- |
| Canonical HTTPS application | `https://nodedent.com/` returned `200` | Pass |
| HTTP transport | `http://nodedent.com/` returned `301` to `https://nodedent.com/` | Pass |
| `www` HTTP transport | `http://www.nodedent.com/` redirected to HTTPS | Pass |
| Canonical host | `https://www.nodedent.com/` returned `301` to `https://nodedent.com/` | Pass |
| Application CSP | Production HTML includes `script-src 'self'` and `connect-src 'none'` | Pass |
| Anti-framing CSP | Response includes `Content-Security-Policy: frame-ancestors 'none'` | Pass |
| Legacy anti-framing compatibility | Response includes `X-Frame-Options: DENY` | Pass |
| MIME-sniffing protection | HTML, JavaScript, CSS, and manifest responses include `X-Content-Type-Options: nosniff` with compatible declared MIME types | Pass |
| Cloudflare NEL | `NEL` header absent after the zone setting was disabled | Pass for new policy delivery |
| Cloudflare reporting endpoint | `Report-To` header absent after NEL was disabled | Pass for new policy delivery |
| Application telemetry and analytics | None found by the source/security review | Pass for reviewed release |
| HSTS | HTTPS responses include `Strict-Transport-Security: max-age=2592000`; the HTTP redirect correctly omits it | Pass, staged one-month policy |

### Hosting Trust Boundary

The live path includes Cloudflare, GitHub Pages, and GitHub Pages' delivery
infrastructure. Cloudflare performs the canonical redirects and adds the
host-level HSTS, anti-framing, and MIME-sniffing-protection headers. The
production application remains a static build and has no NodeDent server-side
clinical storage or application API.

GitHub Pages reported its own custom-domain HTTPS enforcement as disabled because
it did not hold the custom-domain certificate. Cloudflare terminates the public
HTTPS connection and enforces the observed HTTP-to-HTTPS redirect. Changes to
Cloudflare proxying, certificates, redirect rules, response-header rules, NEL,
DNS, or the GitHub Pages custom-domain configuration require a renewed live-host
review.

Browsers that received the earlier NEL policy may retain it for its previous
seven-day TTL because the disabling response did not send an explicit
`max_age: 0` removal policy. Final clinic-profile testing must use a fresh
profile or occur after that TTL has expired.

Before ADR acceptance, update the
[local clinical threat model](../security/local-clinical-threat-model.md) and
[deployment guide](../guides/local-clinical-deployment.md) if the hosting review
changes any documented trust boundary, expected attacker, operational
dependency, or residual risk.

## Implemented Application Controls

The following controls are implemented in the reviewed source and covered by
automated checks where indicated.

### Protected Storage And Key Lifecycle

- Clinical cases and encrypted indexes use transactional IndexedDB rather than
  plaintext case JSON in `localStorage`.
- Case records use random encounter identifiers unrelated to chart number,
  tooth, procedure, or diagnosis.
- Case payloads and indexes use authenticated AES-256-GCM envelopes.
- PBKDF2-SHA-256 derives the vault key using a random salt and 600,000
  iterations.
- The usable non-extractable Web Crypto key is retained only in browser memory.
- The vault supports explicit locking, inactivity locking, hidden/page-exit
  locking, and cross-tab locking.
- Monotonic revisions and transactional comparisons reject stale-tab
  overwrites.
- Storage failures and conflicts are surfaced rather than treated as successful
  saves.

### Backup, Import, Export, And Deletion

- Encrypted whole-vault backup and authenticated restore are implemented.
- Restore verifies the vault verifier and every encrypted case before replacing
  the current vault.
- Loss of the vault passphrase is explicitly described as unrecoverable.
- Plaintext note and JSON exports warn that they contain identifying clinical
  information.
- Default filenames minimize patient facts while retaining the chart number
  required by the approved filing model.
- Legacy prototype `localStorage` data is detected without parsing, copying, or
  migrating it into the protected vault.
- Legacy export and deletion remain explicit user actions.
- Delete-case, clear-current, reset-vault, legacy deletion, and backup
  replacement have distinct scopes and destructive confirmations.

### Network And Browser Boundaries

- The production CSP uses `connect-src 'none'`.
- The application source check rejects common network APIs and absolute network
  URLs in the clinical source tree.
- The reviewed build contains no application analytics, telemetry, remote
  logging, synchronization, server storage, or structured EMR integration.
- Case state remains outside `localStorage`; only approved non-patient
  preferences and legacy handling use that storage boundary.
- Browser-held data, Downloads, clipboard content, extensions, the operating
  system, and the unlocked runtime remain outside the protection supplied by
  vault encryption.

### Product Notice And Record Boundary

- The application identifies chart-number records and clinical facts as
  identifying clinical information.
- The privacy policy is accessible before vault access and from the global
  footer.
- Product notices prohibit unnecessary direct identifiers.
- The application states that ClearDent or Dentrix remains the official record.
- The application does not claim that a copied note was successfully saved to
  the official record.

## Automated Verification

| Check | Result for reviewed source or commit |
| --- | --- |
| `git diff --check origin/main...HEAD` before PR | Pass |
| `npm run versioning:check` | Pass |
| `npm run typecheck` | Pass in CI |
| `npm test` | Pass, 124 tests |
| `npm run docs:check` | Pass |
| `npm run build` | Pass |
| `npm run security:check` | Pass |
| PR `Quality` job | Pass |
| Post-merge `Quality` job | Pass |
| Pages build and security check | Pass |
| Pages deployment | Pass |

The automated suite covers encrypted persistence, authenticated restore, wrong
passphrases, stale writes, legacy storage separation and deletion, export
filenames, privacy-policy text, application-version display, domain logic, case
schema validation, notes, workflow routing, and the production network/storage
boundary.

### Automated-Assurance Limitations

- Automated browser end-to-end coverage is not yet recorded for the vault and
  production deployment.
- Accessibility automation and the documented manual assistive-technology
  checks remain incomplete.
- The dependency install reported one low-severity advisory; this record does not
  assess its reachability or clinical relevance.
- GitHub Actions emitted Node.js runtime-deprecation annotations for current
  action versions; the runs passed, but action upgrades should be tracked.
- GitHub-hosted CI logs and artifacts have provider-defined retention. Durable
  audit evidence must be exported or referenced through the clinic's approved
  evidence-retention process.

## Synthetic Clinic-Device Test Record

All test identifiers and clinical facts must be unmistakably synthetic. Do not
use a real chart number, patient name, clinical note, date of birth, address,
contact detail, government identifier, insurance identifier, or copied EMR
content.

| Scenario | Expected evidence | Result | Evidence reference |
| --- | --- | --- | --- |
| Approved device, OS account, and browser profile | Configuration checklist and reviewer | Pending | Pending |
| Disk encryption and automatic screen lock | Clinic-controlled configuration evidence | Pending | Pending |
| Browser updates, sync setting, and extension allowlist | Profile configuration evidence | Pending | Pending |
| First vault creation and unlock | Synthetic vault opens and reloads | Pending | Pending |
| Wrong passphrase | Unlock is rejected without disclosure | Pending | Pending |
| Explicit lock | Decrypted workspace becomes unavailable | Pending | Pending |
| Fifteen-minute inactivity lock | Vault locks after the configured interval | Pending | Pending |
| Tab switch, hidden page, and navigation | Vault locks as documented | Pending | Pending |
| Reload and browser restart | Locked encrypted records persist | Pending | Pending |
| Persistent-storage denial | Warning and backup guidance remain visible | Pending | Pending |
| Multi-tab conflict | Stale write is refused without silent overwrite | Pending | Pending |
| Synthetic endodontic case | Workflow, autosave, note, reload, and resume succeed | Pending | Pending |
| Synthetic operative case | Workflow, autosave, note, reload, and resume succeed | Pending | Pending |
| Plaintext note and JSON exports | Warning, content, and filename are correct | Pending | Pending |
| Clipboard and Downloads handling | Clinic procedure is usable and followed | Pending | Pending |
| Encrypted backup and restore | Restored vault matches the synthetic source | Pending | Pending |
| Wrong-passphrase and tampered-backup restore | Restore is rejected without replacement | Pending | Pending |
| Delete one case | Only the selected synthetic case is removed | Pending | Pending |
| Clear current case | Scope and result match the confirmation | Pending | Pending |
| Delete entire vault | Typed confirmation and recovery procedure are followed | Pending | Pending |
| Legacy data path | No silent migration; export/delete scopes are correct | Pending | Pending |
| Simulated save failure or conflict | UI does not claim the draft is durable | Pending | Pending |
| EMR handoff rehearsal | Synthetic note is matched and verified manually | Pending | Pending |
| Browser network inspection | No unexpected application connections or reports | Pending | Pending |
| VoiceOver/NVDA, keyboard, zoom, touch, and target device | Manual accessibility record | Pending | Pending |

## Operational And Privacy Approval Gates

| Gate | Required record | Status |
| --- | --- | --- |
| Minimum-necessary data policy | Permitted and prohibited fields approved by clinic | Pending |
| Retention period | Defined for browser cases, exports, and backups | Pending |
| Routine case deletion | Owner, frequency, confirmation, and exception process | Pending |
| Secure export deletion | Downloads, clipboard, backup, and synced-folder handling | Pending |
| Backup custody | Location, frequency, encryption, access, and recovery owner | Pending |
| Passphrase custody | Approved recovery method separate from backups | Pending |
| Downtime process | Procedure when NodeDent or local records are unavailable | Pending |
| Incident response | Device, profile, passphrase, export, backup, extension, and build events | Pending |
| Dependency review | Inventory, advisories, provenance, disposition, reviewer, and date | Pending |
| Threat-model review | Independent review of assets, boundaries, attackers, and residual risks | Pending |
| Alberta privacy assessment | Qualified clinic privacy-lead review | Pending |
| PIA determination | Requirement and submission/approval status recorded | Pending |
| Professional and clinic-policy review | Intended chairside use approved | Pending |
| Final release verification | Version, commit, artifact, URL, and configuration rechecked | Pending |

Deployment in Quebec or another jurisdiction requires an additional
applicable-law and operational review and is not covered by this Alberta
readiness record.

## Known Residual Risks

The detailed analysis remains in the
[local clinical threat model](../security/local-clinical-threat-model.md).
Acceptance cannot imply that these risks are eliminated:

- malicious same-origin code or a compromised build can access an unlocked
  workspace;
- a hostile browser extension, compromised endpoint, screen capture, clipboard
  manager, or authorized-user misuse remains outside application encryption;
- browser eviction, corruption, device loss, or user deletion can remove local
  records;
- loss of the passphrase can make the vault and its backups unrecoverable;
- plaintext exports leave the encrypted vault and inherit clinic and operating
  system controls;
- the clinician can select the wrong EMR chart or fail to verify the transferred
  note;
- NodeDent remains temporary working storage and cannot establish that the
  official record was updated.

## Approval Record

| Approval | Name or controlled record reference | Date | Status |
| --- | --- | --- | --- |
| Technical implementation reviewer | Pending | Pending | Pending |
| Independent security/dependency reviewer | Pending | Pending | Pending |
| Clinic operations lead | Pending | Pending | Pending |
| Clinic privacy lead | Pending | Pending | Pending |
| Clinical owner | Pending | Pending | Pending |
| PIA determination | Pending | Pending | Pending |
| ADR 0008 acceptance | Pending | Pending | Proposed |
| Accepted application release/tag | Pending | Pending | Pending |

## Acceptance Procedure

1. Complete the synthetic clinic-device test record and attach controlled
   evidence references.
2. Complete the operational, dependency, threat, and Alberta privacy gates.
3. Resolve each finding or record its approved disposition and residual risk.
4. Reverify the production URL, headers, artifact identity, and Cloudflare/GitHub
   configuration against the release proposed for approval.
5. Update the threat model, deployment guide, product policy, and implementation
   for any changed asset, trust boundary, expected attacker, data flow, or
   operational dependency.
6. Record final reviewer approvals in this document.
7. Change ADR 0008 to Accepted with a link to this record, mark ADR 0007
   Superseded, and bind approval to a tagged application release.

Any later change to the hosting origin, Cloudflare behavior, CSP, telemetry,
storage model, browser-profile model, retention, data fields, supported
jurisdiction, dependency boundary, or EMR transfer method requires a new or
amended dated readiness review before clinical use continues.
