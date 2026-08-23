# Deployment Mode Operations

## Purpose And Approval Boundary

This guide records the repository-side configuration for the Current, Beta, and
Sandbox modes defined by [ADR 0012](../adr/0012-define-current-beta-and-sandbox-deployment-modes.md).
It does not authorize real clinical data. Current and Beta remain subject to
[ADR 0008](../adr/0008-adopt-constrained-local-clinical-mode.md), clinic approval,
and an evidence record for each origin.

## Build Contract

Every published build must provide these values at build time:

| Variable | Current | Beta | Other branches |
| --- | --- | --- | --- |
| `NODEDENT_DEPLOYMENT_MODE` | `current` | `beta` | unset or `sandbox` |
| `NODEDENT_DEPLOYMENT_BRANCH` | `main` | `beta` | actual branch name |
| `NODEDENT_DEPLOYMENT_COMMIT` | exact source commit | exact source commit | exact source commit when available |
| `NODEDENT_DEPLOYMENT_ORIGIN` | approved Current HTTPS origin | approved Beta HTTPS origin | unset |

Vite also accepts Workers Builds' `WORKERS_CI_BRANCH` and
`WORKERS_CI_COMMIT_SHA`, classic Pages' `CF_PAGES_BRANCH` and
`CF_PAGES_COMMIT_SHA`, or GitHub's `GITHUB_REF_NAME` and `GITHUB_SHA` as branch
and commit fallbacks. Explicit `NODEDENT_*` metadata takes precedence. Platform
metadata never selects Current or Beta by itself: privileged mode and expected
origin remain explicit. Missing, unknown, or malformed mode input becomes
Sandbox; an incomplete or contradictory Current/Beta build fails. At runtime,
a Current or Beta origin mismatch blocks vault access.

The built `deployment.json` contains only mode, branch, source commit,
application version, expected clinical origin when applicable, and Sandbox
kind. It is deployment evidence and must never contain credentials or vault,
case, operator, clinic, or patient metadata.

## Reproducible Checks

Use Node 24 and the locked npm dependencies:

```sh
npm ci
npm run ci:local
npm run deployment:matrix
```

`ci:local` runs versioning, type, domain-test, documentation, build,
deployment-identity, and clinical-security checks. `deployment:matrix` builds
and inspects synthetic Current, Beta, development Sandbox, and historical
Sandbox artifacts. Current and Beta test origins use reserved `.invalid`
hostnames and do not authorize a deployment.

## GitHub Configuration

Create these repository variables before enabling the corresponding branch
workflow:

- `NODEDENT_CURRENT_ORIGIN`: exact Current HTTPS origin, without a trailing
  slash or path;
- `NODEDENT_BETA_ORIGIN`: exact stable Beta HTTPS origin, without a trailing
  slash or path.

Quality runs for pull requests and pushes to `main` and `beta`. Pull requests
build as Sandbox. Push builds use Current only for `main` and Beta only for
`beta`, then retain `deployment.json`, `index.html`, and `_headers` when present
as exact-commit evidence. The GitHub Pages workflow repeats the complete gate
for the exact `main` commit before uploading that artifact.

After a `Version Packages` merge, the Version workflow retains the canonical
`vM.m.p` tag behavior and creates `archive/vM.m.p` from that exact tag. It
first builds that tagged commit with an explicit Historical Sandbox identity
and checks the generated deployment metadata and security boundary. It refuses
to overwrite an archive branch pointing elsewhere. The workflow summary records
the artifact validation separately from the still-pending external Cloudflare
branch build. Repository branch protection or a ruleset must separately prevent
ordinary edits to `archive/*`.

## Cloudflare Workers Builds Configuration

The Cloudflare project must be reviewed against this table. Do not put secrets
or private account identifiers in this repository.

| Setting | Required configuration |
| --- | --- |
| Production branch | `beta`, at one stable approved Beta origin; Current remains reconciled with the GitHub Pages `main` route |
| Non-production branches | Enabled when development and historical Sandbox previews are wanted; restrict them with Cloudflare Access where operationally available |
| Build command | `npm ci && npm run ci:local` |
| Production deploy command | `npx wrangler deploy` |
| Non-production version command | `npx wrangler versions upload`; uploads a preview version without promoting it over Beta |
| Static asset directory | `dist`, declared in `wrangler.toml` |
| Node version | `NODE_VERSION=24` |
| Production build variables | `NODEDENT_DEPLOYMENT_MODE=beta` and `NODEDENT_DEPLOYMENT_ORIGIN=<stable Beta origin>` |
| Preview build variables | `NODEDENT_DEPLOYMENT_MODE=sandbox`; leave `NODEDENT_DEPLOYMENT_ORIGIN` unset |
| Injected source metadata | Allow `WORKERS_CI_BRANCH` and `WORKERS_CI_COMMIT_SHA` to provide branch and commit; do not replace them with static values |
| Branch control | `*` is acceptable when every non-production branch should receive a Sandbox preview; use an `archive/*` branch rule only if previews should be historical-only |
| Build watch paths | Keep include path `*`; this matches changed files, not branch names. Do not enter `archive/*` here |
| Search exclusion | Preserve generated `_headers` and verify `X-Robots-Tag` plus HTML robots metadata for Beta/Sandbox |
| Failed builds | Publication must stop; the prior sound deployment remains the recovery route |
| Retention/rollback | Record retained deployment behavior and verify it without using real data |

A separately passing GitHub workflow is not evidence that an independently
published Cloudflare artifact passed. Workers Builds must run the complete
command above, or publication must be moved behind an exact-commit GitHub
check/deploy integration. Production and preview build variables must be scoped
separately; applying Beta mode to every preview must fail rather than make a
non-`beta` branch clinical-capable. Before clinical Beta activation,
deliberately fail one synthetic Beta build and confirm Cloudflare does not
publish it.

## Origin And Rollback Rules

Current and Beta origins own separate IndexedDB vaults. Code promotion does not
move cases, passphrases, catalogues, or settings. Do not change a clinical
origin as an ordinary deployment action.

Before a Beta build with persistence or migration risk is used clinically:

1. create and verify an encrypted backup under the prior approved Beta build;
2. test the upgrade with synthetic fixtures;
3. determine whether the previous build can open the upgraded IndexedDB schema;
4. record the recovery route if it cannot; and
5. record the approving person and exact commit before real-data use.

A code rollback does not roll back browser data. If the origin, build identity,
artifact, or vault behavior is unexpected, stop clinical use, preserve only
approved evidence, use the documented backup/recovery path, and follow the
clinic incident procedure.

## External Evidence Record

Complete this outside the public repository when values are sensitive; public
records may use opaque references.

| Field | Current | Beta | Sandbox example |
| --- | --- | --- | --- |
| Branch, tag if applicable, and full commit | Pending | Pending | Pending |
| Exact origin | Pending | Pending | Pending |
| Visible mode/title/footer verified | Pending | Pending | Pending |
| `deployment.json` and artifact digest | Pending | Pending | Pending |
| Quality/security run | Pending | Pending | Pending |
| Search metadata/header result | N/A unless separately required | Pending | Pending |
| Stable-origin and separate-storage evidence | Pending | Pending | Pending |
| Access restriction | Pending | Pending | Pending |
| Failed-build publication test | Pending | Pending | Pending |
| Rollback/retained-deployment test | Pending | Pending | Pending |
| Clinic authorization for real data | Pending | Pending | Prohibited |
