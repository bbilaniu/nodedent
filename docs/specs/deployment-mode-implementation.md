---
status: active
created_on: 2026-08-22
---

# Deployment Mode Implementation

## Goal

Implement the Current, Beta, and Sandbox deployment model defined by
[ADR 0012](../adr/0012-define-current-beta-and-sandbox-deployment-modes.md)
without weakening the constrained local clinical-data boundary in
[ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md).

The implementation must make deployment identity explicit, default unknown
builds to Sandbox, give Current and Beta equivalent clinical safeguards, and
keep every other branch synthetic-only while preserving complete interactive
behavior for development and historical comparison.

## Controlling Boundary

Technical mode implementation may proceed while ADR 0012 is Proposed. Real
clinical data must not be enabled in Current or Beta until ADR 0008's gate is
complete, ADR 0008 is accepted, ADR 0007 is superseded, and the clinic's recorded
approval explicitly includes each clinical origin and its operating procedure.

This spec does not treat a build-time label as clinical authorization. Mode,
code safeguards, deployment evidence, and operational approval must agree.

## Baseline

The current repository has:

- one application build with no typed deployment-mode configuration;
- package-version display in the global footer but no branch, commit, or channel
  identity;
- one production HTML title and metadata set;
- a Quality workflow for pull requests and pushes to `main`, but not pushes to
  `beta`;
- a GitHub Pages workflow for `main` that builds and runs the clinical security
  check;
- external Cloudflare configuration that can deploy `beta` and other branches
  at separate origins;
- an automated `vM.m.p` tag step after a `Version Packages` merge; and
- encrypted IndexedDB vaults whose contents are isolated by browser origin.

The current clinical security check verifies the production CSP, rejects common
network APIs in clinical source, and guards the local-storage boundary. It does
not yet verify deployment mode, branch/origin claims, Sandbox search exclusion,
or mode identity in the built artifact.

## Required Outcomes

### Typed deployment identity

Add one central deployment configuration module, preferably
`src/nodedent/deploymentMode.ts`, that exposes immutable build-time values:

```ts
type DeploymentMode = "current" | "beta" | "sandbox";

type DeploymentIdentity = {
  mode: DeploymentMode;
  branch: string;
  commitSha: string;
  expectedOrigin?: string;
  sandboxKind?: "development" | "historical";
};
```

The exact names may change to fit implementation, but all application surfaces
must consume the same validated object. Do not read deployment permission from
`localStorage`, IndexedDB, query parameters, URL fragments, cookies, or a user
preference.

Build configuration should inject the mode, branch, commit, and expected origin
through Vite configuration rather than scattering direct `import.meta.env`
access through components. Add TypeScript declarations for injected constants
or environment fields.

Mode selection must follow a fail-safe allowlist:

- Current requires the reviewed `main` branch and configured Current origin.
- Beta requires the reviewed `beta` branch and configured Beta origin.
- `archive/*` produces historical Sandbox.
- every other branch, including `codex/*`, feature branches, missing branch
  metadata, and unknown values, produces development Sandbox.

Current or Beta builds must fail when branch, mode, commit, or expected-origin
metadata is absent or contradictory. Sandbox must remain the default without a
privileged setting. At runtime, a Current or Beta artifact served from an
unexpected origin must block vault access and show a deployment-configuration
error; it must not continue as a clinical workspace.

The application version remains independent from deployment mode and commit.
Mode and commit metadata must never be written into clinical notes, case data,
encrypted vault records, or patient-facing exports.

### Visible application identity

Add a reusable deployment-identity surface rather than duplicating strings
across screens.

- Current may keep the ordinary product header, but its accessible deployment
  information must identify Current, application version, and commit.
- Beta must show a persistent `Beta — pre-release clinical workspace` indicator
  on the lock screen, privacy page, case-entry screen, and unlocked workspace.
- Sandbox must show a persistent `Sandbox — synthetic data only` indicator on
  every application surface.
- Sandbox should distinguish `Historical sandbox` from `Development sandbox`
  when validated branch metadata permits it.
- The global footer should expose mode, version, and a shortened commit with an
  accessible full value or equivalent deployment-information view.
- The document title should include `Beta` or `Sandbox`; Current may retain the
  ordinary NodeDent title.
- A stale or bookmarked tab must remain identifiable without requiring the
  operator to open a menu.

The indicator must not rely on color alone. It must preserve the existing light
and dark themes, keyboard focus, high contrast, 200% zoom, narrow layouts, and
chairside touch behavior. Prefer an `aria-label` or visible expansion for any
shortened commit value.

### Sandbox synthetic-data boundary

Sandbox retains full interaction for comparison. It may create and unlock its
own origin-isolated vault, edit cases, autosave, exercise workflows, manage
catalogues, and test imports and exports using synthetic fixtures.

Add explicit synthetic-only warnings:

- before creating the first Sandbox vault;
- beside or immediately before plaintext case import;
- beside or immediately before encrypted-backup restore/import; and
- on privacy and deployment-information surfaces.

Do not imply that the application can technically determine whether a selected
file contains real data. The warning defines the permitted use; existing schema,
passphrase, authentication, size, and conflict validation must remain unchanged.

Sandbox must not discover, copy, or migrate Current or Beta browser storage.
Its storage copy should explain that branch deletion, origin changes, or browser
cleanup can make its synthetic vault unavailable.

Add Sandbox search exclusion to the built HTML:

- `robots` metadata containing `noindex`, `nofollow`, and `noarchive`; and
- equivalent deployment headers where Cloudflare configuration supports them.

Do not add those search directives to Current unless separately intended.
Whether Beta is indexed should be an explicit deployment decision; the initial
implementation should apply `noindex`, `nofollow`, and `noarchive` to Beta
because it is not the current public release.

No Current or Beta application surface should advertise or enumerate Sandbox
URLs. Historical and preview links may remain in controlled development or
release evidence outside the clinical application.

### Current and Beta clinical equivalence

Current and Beta must use the same clinical application code and safeguards.
Mode-specific presentation must not disable encryption, locking, retention,
backup authentication, import validation, destructive confirmations, CSP, or
the network prohibition in either clinical-capable mode.

Beta must have a stable origin. A code deployment must not change the origin
that owns its IndexedDB vault. Documentation must state that Current and Beta
origins hold separate vaults and that code promotion does not move cases,
passphrases, catalogues, or settings between them.

Before a Beta deployment containing persistence or migration changes is used
with real data:

- create and verify an encrypted backup under the prior approved Beta build;
- verify upgrade behavior with synthetic fixtures first;
- document whether application rollback can still open the upgraded IndexedDB
  schema; and
- identify the recovery path if the previous code cannot safely reopen it.

A code rollback is not a data rollback. The interface and operator guidance must
not suggest otherwise.

### Build and artifact validation

Extend Vite build configuration to emit deployment-specific HTML and a
machine-readable, non-clinical build identity. The identity may be embedded in
the bundle or emitted as a static artifact, but it must include only mode,
branch, commit, application version, and expected origin.

Add a repository validation script, preferably
`scripts/check-deployment-mode.mjs`, that can inspect source configuration and
the built artifact. It should verify:

- mode is one of the three allowed values;
- Current and Beta branch/origin assertions are exact;
- unknown and absent metadata resolve to Sandbox;
- built title, identity, and robots behavior match the selected mode;
- the built artifact contains the expected version and commit;
- Sandbox cannot claim Current or Beta through a runtime value; and
- no clinical note/export template contains deployment metadata.

Extend `scripts/check-clinical-security.mjs` only for safeguards it already owns,
such as ensuring every mode retains the production CSP and network boundary.
Keep deployment classification tests in the deployment-specific check so the
security script does not become an unrelated catch-all.

Provide reproducible commands or a small matrix runner for building and checking
Current, Beta, development Sandbox, and historical Sandbox artifacts. Current
and Beta commands must require explicit expected origins; Sandbox commands must
work without privileged configuration.

### CI and deployment gates

Update `.github/workflows/ci.yml` so the stable Quality job runs on pushes to
both `main` and `beta`, in addition to pull requests. Add the deployment-mode
check to the Quality job.

Create or reuse one local aggregate command for the exact required quality
sequence where doing so keeps GitHub and Cloudflare behavior aligned. The
sequence must cover at least:

- locked dependency installation in the deployment environment;
- versioning validation;
- typechecking;
- domain tests;
- documentation lifecycle validation;
- the mode-specific production build;
- deployment-mode artifact validation; and
- the clinical security check against that built artifact.

Cloudflare must not publish a Beta artifact before this sequence succeeds for
the exact commit. Satisfy this through one reviewed mechanism:

- deploy Beta from a GitHub workflow that depends on the Quality job;
- configure the Cloudflare build itself to execute the complete required gate
  before publication; or
- use another documented check/deploy integration that proves the published
  commit passed the same commands.

Do not assume that a separately running GitHub check protects an independently
published Cloudflare branch build. Record the selected mechanism and test a
deliberately failing Beta commit with synthetic data before clinical activation.

The `main` deployment must likewise remain tied to a passing check of the exact
artifact it publishes. Reconcile the existing GitHub Pages deployment and the
external Cloudflare delivery path in the deployment evidence rather than
assuming either one covers the other automatically.

### Cloudflare branch configuration

Record, without checking secrets into the repository:

- the Current origin and source branch;
- the Beta origin and source branch;
- how other branch deployments receive Sandbox configuration by default;
- whether preview deployments require Cloudflare Access;
- branch build inclusion/exclusion rules;
- search-engine response headers for Beta and Sandbox;
- build command, Node version, environment-variable ownership, and artifact
  directory;
- rollback and retained-deployment behavior; and
- evidence that Current, Beta, and Sandbox use distinct origins.

Cloudflare configuration is external state. Add a checked-in verification
checklist or deployment record, but do not place credentials, account IDs that
are not intended for publication, patient data, or vault metadata in it.

The branch URL being unadvertised is not sufficient evidence. Prefer Cloudflare
Access or equivalent restriction for development and historical Sandbox
deployments where operationally available.

### Release tags and historical Sandbox

Retain the existing `vM.m.p` release-tag behavior. Archive automation is a later
phase and must not precede deployment-mode enforcement.

After Sandbox mode is implemented and verified, add an archive step that can:

1. resolve the just-created release tag;
2. refuse an existing `archive/vM.m.p` branch at another commit;
3. create the archive branch from the tag;
4. allow Cloudflare to build it with historical Sandbox identity; and
5. record the tag, commit, branch, URL, and artifact evidence.

Because tags pushed with the workflow's `GITHUB_TOKEN` do not normally trigger
another workflow, keep archive creation downstream in the Version workflow or
invoke it explicitly. A failed comparison deployment should be visible and
retriable but need not move the tag or block a sound clinical release.

Do not automatically publish releases from before Sandbox mode can identify and
warn users correctly. Historical source tags may exist without a public
historical deployment.

### Documentation and approval

Update these documents before clinical Beta activation:

- the product privacy policy, to identify Current and Beta as separate local
  clinical origins and Sandbox as synthetic-only;
- the local clinical threat model, to cover wrong-origin use, stale tabs,
  preview links, Beta updates, and branch-deployment configuration;
- the local clinical deployment guide, to cover mode verification, stable
  origins, backup before risky Beta changes, rollback limits, and incident
  handling;
- operator training and the device/browser checklist, to distinguish Current,
  Beta, and Sandbox visibly; and
- release-readiness evidence, to record branch, mode, commit, origin, checks,
  and approval.

The clinic's recorded review must explicitly decide who may use Beta with real
data, on which device/profile, for what pre-production purpose, with what backup
procedure, and how a failed or abandoned Beta vault is recovered or deleted.

## Delivery Sequence

### Phase 1: Mode foundation

- Add the typed deployment identity and fail-safe resolver.
- Inject validated build metadata through Vite.
- Add unit tests for the complete branch/mode matrix.
- Add the deployment-mode artifact check.

### Phase 2: Application identity and warnings

- Add the reusable mode indicator and footer identity.
- Update document title and robots metadata by mode.
- Add Sandbox vault and clinical-file warnings.
- Add component and accessibility tests.

### Phase 3: Quality and deployment enforcement

- Run Quality on `beta` pushes.
- Make Current and Beta deployment depend on exact-commit quality and security
  evidence.
- Record and verify Cloudflare branch/origin configuration.
- Test fail-closed mode and deliberately failing deployment scenarios.

### Phase 4: Clinical Beta readiness

- Update privacy, threat-model, deployment, and operator documentation.
- Complete synthetic upgrade, rollback, backup, stale-tab, and origin-isolation
  testing.
- Complete the clinic review for the Beta origin.
- Accept the controlling ADRs before entering real data.

### Phase 5: Historical Sandbox automation

- Create protected `archive/vM.m.p` branches from release tags.
- Verify Cloudflare builds them as historical Sandbox.
- Record deployment and artifact evidence.
- Keep historical URLs outside the clinical application.

## Test Matrix

At minimum, automated tests must cover:

| Input | Expected result |
| --- | --- |
| `main` + Current configuration + approved origin | Current |
| `beta` + Beta configuration + approved origin | Beta |
| `main` + Beta configuration | Build failure |
| `beta` + Current configuration | Build failure |
| Current or Beta with missing commit/origin | Build failure |
| Current or Beta artifact served from another origin | Vault access blocked |
| `archive/v2.2.1` without privileged configuration | Historical Sandbox |
| `codex/example`, feature branch, unknown branch, or missing branch | Development Sandbox |
| Sandbox with a forged query/hash/storage value | Remains Sandbox |

Also test:

- title, footer, banner, warning, and robots output for every mode;
- light, dark, keyboard, screen-reader, 200% zoom, and narrow layouts;
- mode persistence across lock, unlock, privacy-policy navigation, and fatal
  error recovery;
- Sandbox warnings on vault creation and every clinical file-import route;
- unchanged vault cryptography, lock, backup, restore, conflict, and deletion
  behavior in Current and Beta;
- production CSP and no-network checks for all build modes;
- separate-origin behavior using synthetic fixtures only; and
- build and deployment failure without partially publishing a clinical-capable
  artifact.

## Non-Goals

- Accepting ADR 0008 or completing the clinic's operational/privacy approval by
  code change alone.
- Multiple vault profiles within one origin; that remains owned by ADR 0011.
- Synchronizing or automatically copying Current and Beta vaults.
- Using historical Sandbox as an old-vault recovery reader.
- Changing clinical decision paths, note semantics, or workflow versions.
- Adding accounts, server persistence, telemetry, or remote clinical logging.
- Advertising or indexing preview and historical Sandbox deployments.

## Validation

During implementation, run:

- `npm run versioning:check`
- `npm run typecheck`
- `npm test`
- `npm run docs:check`
- `npm run build`
- `npm run security:check`
- the new deployment-mode build/check matrix
- browser and accessibility tests added for the mode surfaces

Verify at least one synthetic Current build, one synthetic Beta build, one
development Sandbox branch, and one historical Sandbox branch at their actual
deployment origins before clinical Beta activation.

## Implementation Progress

Repository implementation completed on 2026-08-22:

- typed, immutable build identity with exact Current/Beta branch, commit, and
  HTTPS-origin validation plus fail-safe Sandbox fallback;
- runtime Current/Beta origin blocking, persistent mode banners, footer identity,
  mode-specific titles, Sandbox warnings, and Beta/Sandbox search exclusion;
- `deployment.json`, deployment artifact validation, resolver/component tests,
  and a reproducible four-mode build matrix;
- Quality coverage for `main` and `beta`, an exact-artifact GitHub Pages gate,
  and release-tag-derived `archive/vM.m.p` branch automation; and
- privacy, threat-model, deployment, training, device-checklist, and Cloudflare
  operations documentation.

The spec remains active. The following external gates cannot be completed by a
repository change and must be recorded before clinical Beta activation:

- configure and verify the Current/Beta repository origins and Cloudflare branch
  variables, complete build command, access restrictions, and retained deployment
  behavior;
- prove with a deliberately failing synthetic commit that Cloudflare does not
  publish Beta before the exact-commit gate succeeds;
- perform actual-origin, browser, accessibility, separate-storage, migration,
  rollback, and recovery testing with synthetic fixtures;
- protect or freeze `archive/*` branches and verify a future release archive at
  its Cloudflare historical Sandbox origin; and
- complete the ADR 0008/0007 transition and clinic approval record for each
  clinical origin and Beta operating procedure.

## Completion

Archive this spec only after all five phases are complete or remaining work has
been moved to another active owning spec with links and rationale. Code and
documentation completion alone do not authorize real data; the controlling ADR
and clinic approval records must also be complete.
