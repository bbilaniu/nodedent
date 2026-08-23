# Clinical Operator Training And Collection-Notice Package

## Approval Boundary

This is a clinic-customizable training and notice package for NodeDent v2.0.0.
It is not legal advice and is not approved merely because it is committed to the
repository. The clinic privacy lead must confirm the applicable law, legal
authority, wording, delivery method, contact details, and records before
clinical use.

The Alberta Health Information Act guidance describes three elements for a
direct-collection notice: the purpose, the specific legal authority, and the
title/business address/business telephone number of a knowledgeable contact.
See the Government of Alberta
[Health Information Act Guidelines and Practices Manual](https://open.alberta.ca/dataset/50877846-0fba-4dbb-a99f-eeb651533bc4/resource/3e16d527-2618-48ae-80b8-93f69973878e/download/hia-guidelines-practices-manual.pdf)
and its
[sample section 22(3) collection notice](https://www.alberta.ca/system/files/custom_downloaded_images/hia-appx1-2-forms-letters.pdf).

## Training Scope

Every operator must demonstrate the following before receiving approval to use
NodeDent with clinical information:

1. Explain that NodeDent is temporary workflow and note-drafting storage and
   that ClearDent or Dentrix remains the sole official record.
2. Enter only the chart number and minimum necessary workflow facts; never enter
   names, exact birth dates, addresses, contact details, government health
   numbers, insurance identifiers, or unrelated facts.
3. Use only the approved device, account, browser, profile, origin, extension
   set, and passphrase-custody process.
4. Create, unlock, explicitly lock, and recognize automatic vault locking.
5. Respond correctly to persistent-storage denial, save failure, stale-tab
   conflict, and unavailable records.
6. Explain that clipboard, print output, and downloaded text/JSON are plaintext
   outside the vault.
7. Create and restore an encrypted backup using only approved storage and
   custody procedures.
8. Distinguish delete-case, clear-current, reset-vault, legacy deletion, and
   backup replacement scopes.
9. Transfer a synthetic note to the correct test/training EMR chart, verify its
   contents, and confirm the official-record save.
10. Follow the approved retention, secure deletion, downtime, and incident
    procedures without placing clinical information in public issues, support
    chats, analytics, or remote logs.
11. State how and when the clinic provides its collection notice and where
    privacy questions are directed.
12. Distinguish Current, Beta, development Sandbox, and historical Sandbox from
    their visible title, banner, footer mode, version, and commit; never enter
    or import real data into Sandbox.
13. Explain that Current and Beta have separate local vaults, that Beta requires
    explicit clinic authorization, and that promoting or rolling back code does
    not transfer or roll back browser data.

## Instructor Walkthrough

Use the approved v2.0.0 release and the target-device checklist:

1. Show the collection notice and confirm where it is delivered before or at
   the applicable collection point.
2. Review the permitted/prohibited data boundary and have the trainee classify
   sample fields.
3. Create a vault with synthetic data and demonstrate passphrase custody.
4. Complete one synthetic endodontic or operative workflow.
5. Trigger explicit lock, wrong-passphrase rejection, and at least one
   interruption/recovery scenario.
6. Demonstrate plaintext warnings, approved Downloads/clipboard handling, and
   secure deletion.
7. Export and restore an encrypted backup.
8. Rehearse manual EMR matching, transfer, content verification, and save
   confirmation.
9. Locate the downtime, incident, retention, backup, and deletion procedures.
10. Complete the competency check and record any remediation.
11. Open approved Current and Beta examples plus a synthetic Sandbox example,
    verify their visible identity, and rehearse closing an unexpected or stale
    deployment without unlocking it.

## Competency Check

| ID | Demonstration | Result | Controlled evidence |
| --- | --- | --- | --- |
| TRN-01 | Identifies permitted and prohibited data without prompting | Pending | Pending |
| TRN-02 | Uses only the approved device/browser/profile and canonical HTTPS origin | Pending | Pending |
| TRN-03 | Unlocks and locks the vault and explains automatic locking | Pending | Pending |
| TRN-04 | Responds safely to wrong passphrase, save failure, and conflict | Pending | Pending |
| TRN-05 | Handles clipboard and plaintext downloads under clinic procedure | Pending | Pending |
| TRN-06 | Creates and restores an encrypted synthetic backup | Pending | Pending |
| TRN-07 | Selects the correct destructive action and explains its scope | Pending | Pending |
| TRN-08 | Completes and verifies a synthetic EMR handoff | Pending | Pending |
| TRN-09 | Locates and explains downtime and incident escalation | Pending | Pending |
| TRN-10 | Explains the collection notice and privacy contact route | Pending | Pending |
| TRN-11 | Identifies Current, Beta, and Sandbox and refuses real data in Sandbox | Pending | Pending |
| TRN-12 | Explains separate Current/Beta vaults and the Beta backup/rollback procedure | Pending | Pending |

The training owner records trainee and instructor identities, completion date,
release, configuration identifier, remediation, expiry/renewal, and signatures
in the clinic-controlled training record.

## Clinic Collection-Notice Template

**Do not deploy this template with placeholders.**

> **Collection of health information**
>
> [CLINIC/CUSTODIAN LEGAL NAME] collects your [APPROVED DESCRIPTION OF THE
> CHART NUMBER AND MINIMUM CLINICAL WORKFLOW INFORMATION] for [PRIVACY-LEAD
> APPROVED PURPOSE, INCLUDING HOW NODEDENT SUPPORTS TREATMENT AND DRAFT
> DOCUMENTATION].
>
> This information is collected under [SPECIFIC LEGAL AUTHORITY CONFIRMED BY
> THE CLINIC PRIVACY LEAD].
>
> Questions about this collection may be directed to [CONTACT TITLE] at
> [BUSINESS ADDRESS] or [BUSINESS TELEPHONE NUMBER].

The privacy lead must decide whether the clinic collects the information
directly from the individual for the purpose of the applicable notice rule, how
the clinic's existing notice applies, and whether NodeDent requires an amended
or supplemental notice. Do not assume that the software developer can select
the clinic's legal authority.

## Supplemental NodeDent Transparency Text

The clinic may use this only after privacy-lead review and alignment with the
signed PIA and collection notice:

> NodeDent is a temporary clinical workflow and note-drafting tool used on an
> approved clinic device and browser profile. It may hold a chart number and the
> minimum clinical facts needed for the selected workflow. The locked local
> vault is encrypted, but copied, printed, or downloaded text and JSON are
> plaintext. NodeDent does not replace the clinic's official dental record. The
> clinician verifies transfer of the final note to the correct official chart.
> The clinic controls access, retention, backup, deletion, incident response,
> and privacy requests.

The privacy lead should also decide whether the notice must describe the static
hosting request path. Loading NodeDent from its public static origin causes
ordinary web requests that can expose technical metadata such as IP address,
request time, browser information, and requested asset, but the reviewed
application does not place patient data in URLs and its CSP blocks application
network connections.

## Notice Approval And Deployment Record

| Field | Controlled record reference or status |
| --- | --- |
| Applicable legislation and section confirmed | Pending |
| Collection purpose approved | Pending |
| Specific legal authority approved | Pending |
| Knowledgeable contact title/address/phone approved | Pending |
| Alignment with signed PIA confirmed | Pending |
| Existing clinic notice reviewed for overlap | Pending |
| Delivery point and method approved | Pending |
| Patient-facing and staff-facing wording consistent | Pending |
| Effective date/version | Pending |
| Privacy-lead approval | Pending |
| Authorized custodian representative approval | Pending |
| Deployed notice evidence | Pending |

## Training Rollout Record

| Field | Controlled record reference or status |
| --- | --- |
| Training content approved | Pending |
| Instructor authorized | Pending |
| Required operator population identified | Pending |
| Initial training completed | Pending |
| Competency exceptions remediated | Pending |
| Refresher/retraining triggers defined | Pending |
| Training evidence package | Pending |
| Clinical-owner approval | Pending |
| Privacy-lead approval | Pending |

Retraining triggers should include material changes to the NodeDent release,
permitted data, device/browser configuration, storage/export behavior,
retention, backup, incident process, collection notice, or EMR handoff.
