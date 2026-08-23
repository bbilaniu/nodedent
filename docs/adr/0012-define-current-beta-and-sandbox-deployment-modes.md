# ADR 0012: Define Current, Beta, And Sandbox Deployment Modes

## Status

Proposed

## Context

NodeDent is built from several Git branches. The current application is released
from `main`, pre-release changes are exercised on `beta`, and Cloudflare Pages
can build other branches at separate branch-deployment origins. Tagged releases
may also be retained on `archive/vM.m.p` branches so prior interfaces and
behavior remain available for comparison.

These deployments do not all have the same purpose or data boundary. The
current application is the supported release. Beta is the final proving ground
for changes intended for production imminently and needs realistic clinical use.
Other branch deployments exist for development or historical comparison and do
not need real clinical data.

Separate origins isolate IndexedDB, local storage, caches, and service workers,
but origin isolation does not identify a deployment's intended use. An operator
can follow an old link or bookmark, and an undisclosed branch URL is not an
access-control boundary. Each build therefore needs an explicit mode with
visible identity, safe defaults, and deployment-specific controls.

[ADR 0007](0007-define-clinical-data-deployment-mode.md) and
[ADR 0008](0008-adopt-constrained-local-clinical-mode.md) remain authoritative
for whether real clinical data is permitted at all. This ADR classifies
deployment channels; it does not independently complete ADR 0008's approval
gate or make NodeDent the official clinical record.

## Decision

NodeDent should define exactly three deployment modes:

| Mode | Branch classification | Purpose | Data boundary |
| --- | --- | --- | --- |
| **Current** | Reviewed release from `main` at the current application origin | Supported clinical workspace | Real clinical data is permitted after the ADR 0008 and clinic deployment gates are complete |
| **Beta** | `beta` at its stable beta origin | Pre-release clinical validation for changes intended for production imminently | Real clinical data is permitted under the same gates and safeguards as Current |
| **Sandbox** | Every other branch, including `archive/*`, `codex/*`, and feature branches | Historical comparison, development preview, and synthetic testing | Synthetic data only |

Mode selection must fail safely. Only an explicit, reviewed allowlist may produce
Current or Beta. An absent, malformed, unknown, or unapproved branch/mode value
must build Sandbox.

The mode should be embedded at build time and exposed through a central typed
application configuration. User-facing code must not infer clinical permission
from the hostname alone. The build and deployment checks should verify that the
declared mode matches the expected branch and origin before publication.

## Current Mode

Current is the supported released application. It should:

- use the reviewed production origin and release commit from `main`;
- display the released application version;
- provide the complete approved clinical workspace, protected vault, import,
  export, locking, retention, and recovery behavior;
- retain the no-clinical-network boundary, restrictive content security policy,
  and other safeguards required by ADR 0008; and
- remain a temporary workflow workspace while ClearDent or Dentrix remains the
  sole official clinical record.

Only a reviewed versioned release may be classified as Current. A feature,
archive, or ad hoc branch must not acquire Current behavior by using a production
hostname or setting an ordinary client-side preference.

## Beta Mode

Beta is a fully functional pre-release clinical workspace. It may create and
edit protected vaults and may contain real clinical data after the same clinical
deployment gates as Current are complete and the clinic's recorded approval
explicitly includes the beta origin and operating procedure.

Beta must preserve every clinical-data safeguard required in Current, including:

- encrypted IndexedDB storage and memory-only usable keys;
- explicit, inactivity, hidden-page, navigation, and cross-tab locking;
- production-equivalent content security policy and no clinical-data network
  transmission;
- authenticated backup, restore, conflict, recovery-history, retention, and
  deletion behavior;
- the approved device, operating-system account, browser profile, extension,
  physical-access, and EMR-transfer boundaries; and
- the same privacy policy, threat-model, and incident-response scope, amended to
  identify the beta origin where required.

Beta must remain visibly distinct from Current. Every application screen should
show a persistent **Beta — pre-release clinical workspace** indicator, and the
page title, footer, version details, and deployment information should expose
the beta status and source commit without placing those values in clinical
notes.

Real data in Beta creates additional release risk. Accordingly:

- every beta deployment must pass the same required build, domain-test,
  documentation, versioning, and clinical-security checks as Current before it
  becomes available;
- workflow, persistence, import/export, or note-semantics changes require their
  normal review and versioning before clinical beta deployment;
- a failing or partially deployed beta build must leave the previous approved
  beta deployment available or provide the documented recovery route;
- the beta origin must remain stable so a routine code deployment does not
  silently abandon its browser-held vault; and
- operators must create and verify an encrypted backup before testing a change
  with material persistence or migration risk.

Current and Beta have separate browser origins and therefore separate vaults.
Neither deployment may imply that its cases, passphrase, active encounter,
catalogues, or settings automatically appear in the other. Any transfer must use
an explicit supported export/import or backup workflow and must retain the
existing warnings and conflict controls.

Beta is not a rollback copy of Current, and its clinical data does not become the
official record. The operator must continue transferring and verifying the final
note in ClearDent or Dentrix.

## Sandbox Mode

Sandbox is the mandatory default for every branch other than the explicitly
approved Current and Beta branches. It includes both:

- **Development sandbox** for feature, `codex/*`, and other preview branches;
  and
- **Historical sandbox** for frozen `archive/vM.m.p` branches created from
  released tags.

Sandbox may retain full application interaction—including vault creation, case
editing, workflow continuation, autosave, import/export exercises, and settings—
because those behaviors are useful for comparison and testing. It must be
presented and operated as synthetic-data software only.

Every Sandbox build must:

- show a persistent **Sandbox — synthetic data only** indicator on every screen;
- distinguish development from historical sandbox where the branch metadata is
  available;
- display its application version and source commit;
- warn before vault creation and file import that real patient or clinic data is
  prohibited;
- describe its browser storage as disposable and isolated to that branch origin;
- avoid links or wording that present it as the current supported application;
- include `noindex`, `nofollow`, and `noarchive` directives in both page metadata
  and deployment headers where supported;
- retain the production network-blocking content security policy and prohibit
  telemetry or remote clinical logging; and
- use Cloudflare Access or an equivalent access restriction for non-public
  comparison deployments where operationally available.

Not advertising Sandbox URLs reduces accidental discovery but is not a security
control. Search directives, access restrictions, persistent mode identity, and
the synthetic-only rule remain required. A person who reaches a Sandbox URL must
not reasonably mistake it for Current or Beta.

Sandbox imports are permitted only for synthetic fixtures. The interface must
not offer direct discovery, automatic copying, or migration from a Current or
Beta vault. Removing a branch or deployment may make that origin's sandbox data
unavailable without recovery; this is acceptable only because Sandbox data must
not contain clinical records.

## Release Tags And Historical Sandboxes

The Git tag is the canonical identity of a historical release. An archive branch
and its Cloudflare deployment are derived comparison surfaces.

When a released version is selected for historical comparison:

1. Merge the reviewed `Version Packages` pull request so `main` contains the
   released version, lockfile, and changelog.
2. Create and push `vM.m.p` at that exact commit and refuse to move or reuse it.
3. Create `archive/vM.m.p` from the tag, never from an earlier unversioned
   `main`, a later `beta`, or another branch.
4. Protect or freeze the archive branch against ordinary development changes.
5. Build and deploy it as Sandbox, not Current or Beta.
6. Record the tag, source commit, archive branch, deployment origin, version,
   lockfile digest, and retained artifact digest where available.

The archive deployment may provide the original application's complete editing
behavior for synthetic comparison. It is not an approved historical clinical
workspace, an old-vault recovery promise, or a substitute for current data
migrations. Historical vault compatibility remains the responsibility of the
currently supported storage and backup contracts unless a separate ADR defines
another recovery architecture.

A failed historical-sandbox deployment need not block a clinical release when
the immutable source tag and current deployment are sound. The failure must be
visible and retriable; it must not move the release tag or silently deploy a
different commit.

## Deployment And Build Controls

The repository should expose one typed deployment-mode value with no runtime UI
control for changing it. Build configuration should follow this precedence:

1. a reviewed Current configuration for `main` and the approved current origin;
2. a reviewed Beta configuration for `beta` and the approved beta origin; and
3. Sandbox for everything else.

Current and Beta selection should require positive assertions of both the branch
and intended deployment channel. Sandbox should require no privileged setting.
A build that claims Current or Beta from an unexpected branch or origin must
fail rather than downgrade its warning or continue ambiguously.

Deployment evidence should record mode, branch, commit, application version,
origin, build result, security-check result, and deployment time without putting
those values into clinical notes or patient-facing exports. The application
footer or an accessible deployment-information surface should expose enough of
that identity to investigate a stale tab or unexpected deployment.

Current and Beta must use stable origins. Sandbox branches must not share an
origin with Current or Beta, because URL paths do not isolate IndexedDB, local
storage, caches, or service workers.

## Relationship To Other Decisions

[ADR 0008](0008-adopt-constrained-local-clinical-mode.md) remains authoritative
for the clinical-data, encryption, network, device, privacy, deployment, and EMR
boundaries in both Current and Beta. If ADR 0008 still prohibits real data, this
ADR does not override that prohibition merely by naming a mode PHI-capable.

[ADR 0010](0010-configure-clinical-vault-lock-policy.md) applies independently
to each Current or Beta vault if configurable lock policy is implemented.

[ADR 0011](0011-define-isolated-local-vault-profiles.md) concerns multiple vault
profiles within one origin. It does not merge or synchronize vaults across
Current, Beta, or Sandbox origins.

The operational release and tagging process remains in the
[versioning guide](../versioning.md). This ADR owns deployment classification and
the associated data boundaries.

## Implementation Gate

This ADR is not implemented until:

1. A typed deployment-mode configuration defaults unknown branches and missing
   values to Sandbox and cannot be changed through ordinary browser state.
2. Current, Beta, and Sandbox expose automated and accessible mode identity,
   version, and commit information.
3. Current and Beta run the same required quality and clinical-security gates
   before deployment, including pushes to the `beta` branch.
4. The Cloudflare branch/origin configuration and repository build configuration
   agree on the allowlisted Current and Beta mappings.
5. Sandbox builds display the synthetic-only boundary, discourage clinical file
   import, include search-engine exclusion controls, and use distinct origins.
6. Automated tests prove that unknown, feature, `codex/*`, and `archive/*`
   branches cannot produce Current or Beta mode.
7. Browser tests cover mode identity, stale bookmarks, vault creation warnings,
   import warnings, keyboard and screen-reader access, zoom, and narrow layouts.
8. The privacy policy, threat model, deployment guide, operator training,
   release checklist, and applicable clinic approval explicitly cover the beta
   clinical origin and Sandbox synthetic-only boundary.
9. The clinic records how Beta backups, failed deployments, origin continuity,
   migration testing, incident handling, and transfer to the official EMR are
   managed before real clinical data is entered there.

Until these gates and ADR 0008's controlling gates are complete, existing
deployment restrictions remain in force.

## Consequences

- Beta can exercise imminent production changes with realistic encrypted local
  clinical data and workflow conditions.
- Current and Beta both become clinical deployment surfaces requiring equivalent
  safeguards, evidence, stable origins, and operational ownership.
- Separate origins prevent accidental storage sharing but require explicit
  backup/import when data must move between Current and Beta.
- Historical and development branches can retain complete interactive behavior
  for comparison without becoming supported clinical workspaces.
- Persistent Sandbox identity and access controls add visible friction even when
  branch URLs are intentionally not advertised.
- Historical deployments are comparison aids, not a backward-compatibility or
  clinical-recovery guarantee.

## Alternatives Considered

- **Allow real data only in Current:** offers the smallest approved surface, but
  does not meet the requirement to validate imminent production behavior under
  realistic beta conditions.
- **Treat Beta as an ordinary Sandbox:** rejected because it would prohibit the
  intended pre-production clinical validation and obscure Beta's operational
  responsibilities.
- **Treat every branch as clinical-capable:** rejected because feature and
  historical branches do not receive the review, stability, and support required
  for real clinical data.
- **Hide branch URLs without labeling or access controls:** rejected because
  obscurity does not prevent bookmarks, link sharing, indexing, or confusion.
- **Disable editing in historical deployments:** safer for clinical recovery,
  but unnecessary for synthetic comparison and prevents faithful interaction
  with earlier workflows.
- **Use historical branches as old-vault recovery readers:** deferred. That is a
  separate compatibility and conversion decision and is not implied by Sandbox.
- **Host all modes under paths on one origin:** rejected because paths do not
  isolate browser-held vaults or other origin-scoped state.

## Future Reconsideration

Revisit this decision if Beta becomes long-lived experimental development rather
than imminent pre-production validation, if Cloudflare branch-origin behavior
changes, or if NodeDent introduces accounts, centralized storage, managed
deployment, or cross-device synchronization. Those changes may require separate
authorization, audit, migration, and data-residency decisions.
