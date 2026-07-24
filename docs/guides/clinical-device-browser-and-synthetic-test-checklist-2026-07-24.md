# Clinical Device, Browser, And Synthetic-Test Checklist

## Use Of This Record

Complete this checklist on every device/browser configuration proposed for
NodeDent v2.0.0 clinical use. Use only unmistakably synthetic data. Keep device
identifiers, screenshots, configuration exports, extension lists, staff names,
and signatures in the clinic-controlled compliance repository.

This public template records opaque evidence references only. A configuration is
not approved because the application opens or the automated suite passes.

## Test Record Identity

| Field | Value |
| --- | --- |
| Release | `2.0.0` |
| Reviewed commit | `a75f87c716cae4920f0a65093e378908890774b2` |
| Public URL | `https://nodedent.com/` |
| Clinic-controlled device reference | DR2 |
| OS name/build and patch date | 2026-07 Update (KB5121767) (26200.8894) |
| Browser name/version/update channel | Microsoft Edge for Business, Version 150.0.4078.83 (Official build) (64-bit) |
| Browser-profile reference | dr.borys.bilaniuk@aponiadental.com |
| Test date | 2026-07-24 |
| Tester controlled reference | Borys Bilaniuk |
| Witness/reviewer controlled reference | Dr Brian Wong |
| Evidence-package identifier | Screenshot collection |

If the public artifact does not match the approved release or the browser/OS
changes after approval, stop and determine whether retesting is required.

## Device And Operating-System Configuration

Record Pass, Fail, Not applicable, or Pending with an evidence reference.

| ID | Control | Acceptance criterion | Result | Evidence |
| --- | --- | --- | --- | --- |
| DEV-01 | Clinic control | Device ownership, support, and authorized use are documented | PASS | N/A |
| DEV-02 | Supported OS | OS is within vendor security support and fully patched under clinic policy | PASS | N/A |
| DEV-03 | Full-disk encryption | Approved full-disk encryption is enabled and recovery custody is documented | PASS | N/A. SSD uses hardware encryption not software encryption |
| DEV-04 | User account | Access uses an approved non-shared or otherwise controlled account model | PASS | N/A |
| DEV-05 | Screen lock | Automatic screen lock interval and reauthentication meet clinic policy | PASS | N/A. ten minutes |
| DEV-06 | Physical control | Storage, positioning, theft prevention, and public viewing risks are addressed | PASS | N/A. Computer is physically bolted down |
| DEV-07 | Endpoint protection | Malware protection, firewall, patching, and incident reporting meet clinic policy | PASS | N/A. Firewalled and updated regularly |
| DEV-08 | Clipboard | Clipboard history/manager behavior is disabled or explicitly approved | PASS | N/A Explicitly approved |
| DEV-09 | Downloads | Plaintext export destination, access, sync, retention, and secure deletion are approved | PASS | N/A. Saved files cannot be moved off the computer |
| DEV-10 | Backup | Encrypted NodeDent backup destination, frequency, access, retention, and restore owner are approved | Not applicable | N/A. computer is not backed up |
| DEV-11 | Passphrase custody | Recovery method is approved and separated from encrypted backups | Not Applicable | N/A.  |
| DEV-12 | Downtime/incident | Staff can access approved procedures without relying on NodeDent | PASS | N/A. Alternate templates and guides available. |

## Browser And Profile Configuration

| ID | Control | Acceptance criterion | Result | Evidence |
| --- | --- | --- | --- | --- |
| BRW-01 | Approved browser | Clinic records the supported browser, version floor, update channel, and owner | PASS | N/A |
| BRW-02 | Dedicated profile | Profile access and use are limited to the approved clinical operating model | PASS | N/A | |
| BRW-03 | Updates | Automatic or managed browser security updates are enabled and monitored | PASS | N/A |
| BRW-04 | Synchronization | History, passwords, extensions, settings, and other sync are disabled or specifically assessed and approved | PASS | N/A |
| BRW-05 | Extensions | Only the controlled extension allowlist is installed; each extension has a documented need and risk disposition | PASS | N/A |
| BRW-06 | Password manager | Browser/passphrase storage behavior follows the approved secret-custody process | PASS | N/A |
| BRW-07 | Site permissions | NodeDent origin permissions are restricted to those required and approved | PASS | N/A |
| BRW-08 | Storage clearing | Exit/cleanup tools and policies do not unexpectedly remove the approved vault or undermine retention | PASS | N/A |
| BRW-09 | Persistent storage | Grant/denial and the corresponding backup procedure are documented | Not Applicable | N/A |
| BRW-10 | HTTPS/origin | Only the approved canonical HTTPS origin is used | PASS | N/A |
| BRW-11 | Developer tools | Access and use are controlled so staff do not copy clinical data into consoles or support channels | PASS | N/A |
| BRW-12 | Printing/PDF | Browser print destinations and generated files are disabled or approved under clinic policy | PASS | N/A. are approved, but only on clinic printers |

## Synthetic Test Data Rules

- Use an obvious chart number such as `SYNTH-V2000-001`.
- Do not use a real name, chart number, date of birth, address, contact detail,
  health number, insurance identifier, note, image, or copied EMR content.
- Mark screenshots and exports `SYNTHETIC TEST DATA`.
- Delete synthetic plaintext exports and test vaults after the approved evidence
  is retained.
- Never place vault passphrases, browser secrets, or private configuration in
  this repository.

## Synthetic Functional And Failure Tests

For each scenario, record Pass, Fail, Not applicable, or Pending. A failure
requires a finding and approved disposition; it cannot be silently omitted.

| ID | Scenario | Expected result | Result | Evidence/finding |
| --- | --- | --- | --- | --- |
| SYN-01 | Create first vault | Vault is created with an approved synthetic passphrase and opens without plaintext case storage | PASS | created |
| SYN-02 | Wrong passphrase | Unlock is rejected without revealing case facts | PASS | rejected |
| SYN-03 | Explicit lock | Workspace becomes unavailable and requires the passphrase | PASS | required |
| SYN-04 | Inactivity lock | Vault locks after the documented 15-minute inactivity interval | PASS | locked |
| SYN-05 | Hide/switch/navigate | Tab hiding, leaving, or another active tab locks as documented | PASS | locked |
| SYN-06 | Reload/restart | Encrypted records persist but remain locked after reload and browser restart | PASS | locked |
| SYN-07 | Persistent-storage denial | Warning and approved backup response remain clear and usable | PASS | clear and usable |
| SYN-08 | Multi-tab conflict | Stale write is refused without silent overwrite | PASS | conflict avoided with lockout on tab switch |
| SYN-09 | Synthetic endodontic case | Setup, workflow, autosave, note, reload, and resume work as expected | PASS | downloaded |
| SYN-10 | Synthetic operative case | Setup, workflow, autosave, note, reload, and resume work as expected | FAIL | fixed in v2.0.2 |
| SYN-11 | Plaintext note export | Warning, contents, filename, approved destination, and deletion procedure are correct | PASS | Pending |
| SYN-12 | Plaintext JSON export/import | Warning, round trip, approved destination, and deletion procedure are correct | PASS | Pending |
| SYN-13 | Clipboard handoff | Warning and approved clipboard handling are followed | PASS | Pending |
| SYN-14 | Encrypted backup/restore | Restored vault matches the synthetic source on the approved device/profile | FAIL | fixed in v2.0.1 |
| SYN-15 | Wrong-passphrase restore | Restore is rejected without replacing the existing vault | PASS | rejected |
| SYN-16 | Tampered-backup restore | Restore is rejected without replacing the existing vault | PASS | rejected |
| SYN-17 | Delete one case | Only the selected case is removed | PASS | Pending |
| SYN-18 | Clear current case | Confirmation scope and result are correct | PASS | Pending |
| SYN-19 | Delete entire vault | Typed confirmation, backup decision, and recovery procedure work as documented | PASS | Pending |
| SYN-20 | Legacy-data path | No silent migration occurs; raw backup and deletion scopes are correct | PASS | Pending |
| SYN-21 | Save failure/conflict | UI does not claim the draft is durable; approved recovery procedure is usable | Pending | Pending |
| SYN-22 | EMR handoff rehearsal | Synthetic note is matched, transferred, reviewed, and confirmed in a training/test destination | Pending | Pending |
| SYN-23 | Network inspection | No unexpected application connections, telemetry, analytics, or reports are observed | Pending | Pending |
| SYN-24 | Backup loss/unavailability | Staff can follow the downtime and recovery procedure without inventing data | Pending | Pending |

## Accessibility And Chairside Use

| ID | Scenario | Acceptance criterion | Result | Evidence/finding |
| --- | --- | --- | --- | --- |
| ACC-01 | Keyboard only | All required actions, dialogs, and confirmations are reachable with visible focus | Pending | Pending |
| ACC-02 | Zoom/reflow | Required workflows remain usable at the approved zoom and viewport settings | Pending | Pending |
| ACC-03 | Screen reader | Approved VoiceOver/NVDA configuration announces controls, status, errors, and dialogs meaningfully | Pending | Pending |
| ACC-04 | Touch/target device | Controls remain reliable with the intended chairside input method | Pending | Pending |
| ACC-05 | Colour/contrast | Status is not conveyed by colour alone and remains distinguishable in the approved setup | Pending | Pending |
| ACC-06 | Interruption recovery | A user can resume safely after lock, interruption, save conflict, or workflow switch | Pending | Pending |

## Configuration Approval

All failed or not-applicable scenarios must have an approved rationale and
finding reference before sign-off.

| Approval | Controlled record reference | Date | Decision |
| --- | --- | --- | --- |
| Tester completion | Pending | Pending | Pending |
| Independent witness/reviewer | Pending | Pending | Pending |
| Clinic operations lead | Pending | Pending | Pending |
| Clinic privacy lead | Pending | Pending | Pending |
| Clinical owner | Pending | Pending | Pending |

Approved configuration identifier: **Pending**

Approval applies only to the release, device, OS, browser version policy,
profile, extensions, settings, and procedures recorded above.

