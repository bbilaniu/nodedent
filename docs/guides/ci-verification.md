# CI verification and dependency maintenance

Use Node 24 and npm with the committed lockfile. No specific local Node version manager is required.

```sh
npm ci
npx playwright install chromium
npm run ci:local:full
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium`.

## Checks and artifacts

- `npm run ci:local`: versioning, ESLint, TypeScript, domain/UI markup tests, documentation lifecycle, production build, deployment identity, and clinical security checks.
- `npm run deployment:matrix`: build and validate Current, Beta, development Sandbox, and historical Sandbox in temporary directories. These builds do not replace `dist/`.
- `npm run test:e2e`: build a production Sandbox into `.e2e-dist/`, serve it only on `127.0.0.1:4175`, and run Chromium. The server never reuses an existing process. Every test starts with isolated browser storage and synthetic data.
- `npm run workflows:check`: run actionlint installed on your PATH. CI uses the versioned `rhysd/actionlint:1.7.12` container; for local parity install actionlint 1.7.12 from its verified release or your package manager. This external-tool check is separate from the npm-only `ci:local:full` command.

Browser coverage exercises vault creation, locking and failed unlock, autosave across reload without explicit locking, anesthesia draft dismissal versus committed recording, case JSON export/import and rejection feedback, and encrypted backup restoration into a fresh browser profile. Failure traces and screenshots are retained under `test-results/`, with an HTML report under `playwright-report/`; hosted workflows retain these synthetic artifacts for seven days. Retries are disabled so failures are visible. Do not point these tests at a clinic profile or use real clinical data in fixtures.

Explicit-lock tests wait for the “Unlock clinical vault” heading before reloading or unlocking. Clicking “Lock vault” starts an asynchronous encrypted save; completion of the browser click alone does not mean that save has finished. The separate autosave scenario still verifies persistence without explicit locking. This test-only synchronization correction does not change application behavior or require a release Changeset under the [versioning policy](../versioning.md).

The stable `Quality` job runs on PRs and pushes to `main` and `beta`. It includes workflow validation, the local checks, matrix, and browser tests. Its PR artifact identifies `github.sha`, the merge commit that checkout tests. Pages builds and both automatic Beta sync jobs run the expanded local gate independently, including browser and matrix checks. The Sandbox browser build validates the same source but is not the Current/Beta artifact; those artifacts receive the deployment identity, origin, and security checks. Production-origin behavior still needs deployed-site verification.

Read-only jobs use read-only tokens and disable persisted checkout credentials. Release/branch writers retain only contents write access; Changesets additionally needs pull-request write access. Pages deployment permissions are limited to the deployment job. Jobs have bounded timeouts, and manual Pages deployment is limited to `main`.

## Lint policy

ESLint enforces recommended JavaScript/TypeScript checks and the two core React Hooks contracts (`rules-of-hooks` and `exhaustive-deps`) as errors, with zero warnings allowed. Formatting, a blanket `no-explicit-any` policy, and React Compiler migration rules are not part of this gate. Review dependencies individually; do not blindly autofix effects. In this slice, operative memo dependencies use the complete case input and the Case Setup focus mapping is stable across renders.

## Dependency maintenance

Dependabot proposes weekly npm and GitHub Actions version updates against `beta`. Development patch/minor updates are grouped; major npm changes stay separate. Updates still require review and the same CI checks; automatic merging is not configured. The configuration takes effect after reaching the repository's default branch. It configures version updates, not proof that GitHub security alerts/updates are enabled.

Run `npm audit` when updating dependencies and review advisories for runtime versus development exposure. Address relevant high/critical issues promptly; document any deferred finding and its rationale. Audit is not a required network-dependent gate in this slice. Do not run unattended `npm audit fix --force`. GitHub Actions currently follow the existing major-tag convention; immutable SHA pinning and its maintenance policy remain a separate hardening option.

## Hosted validation and remaining work

Local validation on 2026-09-07 passed with Node 24.18.0 after a clean `npm ci`: actionlint 1.7.12, zero-warning ESLint, TypeScript, 191 existing tests, documentation checks, the production build, all four deployment modes, and all five Chromium scenarios. The complete gate ran with `CI=true` (two browser workers), synthetic Beta metadata, and a reserved `.invalid` origin. The deployment evidence in `dist/` remained unchanged by browser testing. npm reported no vulnerabilities during the clean install. This is local evidence, not a hosted Actions run or a deployable clinic configuration.

On 2026-09-07, the active default-branch ruleset required PRs and an up-to-date `Quality` check. Classic protection endpoints returned no protection, and no Beta ruleset was listed. No repository settings were modified. Keep the `Quality` name stable. The first hosted PR run must confirm Linux browser dependencies, container execution, artifact uploads, and the required check result. Local checks cannot prove these hosted integrations or authorize release deployment.

This slice does not complete the [automated assurance spec](../specs/automated-assurance.md). Full primary-workflow journeys, accessibility/axe checks, visual snapshots, additional browsers, deployed-site smoke tests, and manual device/release evidence remain follow-up work.
