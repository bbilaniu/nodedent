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

The focused accessibility slice adds six scenarios: vault keyboard access and validation, case-import dialog errors and focus restoration, and anesthesia recording versus dismissal, each in desktop/light (1280×900) and narrow/dark (390×844) profiles. It uses real Tab/Shift+Tab/Enter/Space/Escape input, verifies focus indicators and wrapping, background suppression/restoration, error descriptions, and absence of page-level horizontal overflow. [axe's Playwright integration](https://playwright.dev/docs/accessibility-testing) scans the exercised states against WCAG 2.0/2.1 A/AA tags without rule exclusions. These two sampled profiles are not an exhaustive theme/viewport matrix or a substitute for manual accessibility review. One additional local scenario exercises the deployed-site checker against the production-built Sandbox and rejects a wrong expected commit. With the existing five cases, the browser suite now contains 12 scenarios. Full primary-workflow journeys are explicitly deferred.

Explicit-lock tests wait for the “Unlock clinical vault” heading before reloading or unlocking. Clicking “Lock vault” starts an asynchronous encrypted save; completion of the browser click alone does not mean that save has finished. The separate autosave scenario still verifies persistence without explicit locking. This test-only synchronization correction does not change application behavior or require a release Changeset under the [versioning policy](../versioning.md).

The stable `Quality` job runs on PRs and pushes to `main` and `beta`. It includes workflow validation, the local checks, matrix, and browser tests. Its PR artifact identifies `github.sha`, the merge commit that checkout tests. Pages builds and both automatic Beta sync jobs run the expanded local gate independently, including browser and matrix checks. The Sandbox browser build validates the same source but is not the Current/Beta artifact; those artifacts receive the deployment identity, origin, and security checks. The post-deployment smoke check described below complements these pre-deployment gates.

Read-only jobs use read-only tokens and disable persisted checkout credentials. Release/branch writers retain only contents write access; Changesets additionally needs pull-request write access. Pages deployment permissions are limited to the deployment job. Jobs have bounded timeouts, and manual Pages deployment is limited to `main`.

## Lint policy

ESLint enforces recommended JavaScript/TypeScript checks and the two core React Hooks contracts (`rules-of-hooks` and `exhaustive-deps`) as errors, with zero warnings allowed. Formatting, a blanket `no-explicit-any` policy, and React Compiler migration rules are not part of this gate. Review dependencies individually; do not blindly autofix effects. In this slice, operative memo dependencies use the complete case input and the Case Setup focus mapping is stable across renders.

## Dependency maintenance

Dependabot proposes weekly npm and GitHub Actions version updates against `beta`. Development patch/minor updates are grouped; major npm changes stay separate. Updates still require review and the same CI checks; automatic merging is not configured. As verified on 2026-09-07, the configuration is on `main` and [hosted Dependabot updates](https://github.com/bbilaniu/nodedent/actions/runs/34155653753) have created PRs. Read-only repository API checks also confirmed vulnerability alerts, secret scanning, and push protection are enabled; automatic Dependabot security-update PRs are disabled. Version-update automation and security-update automation are separate settings.

Run `npm audit` when updating dependencies and review advisories for runtime versus development exposure. Address relevant high/critical issues promptly; document any deferred finding and its rationale. Audit is not a required network-dependent gate in this slice. Do not run unattended `npm audit fix --force`. Existing GitHub Actions generally follow the major-tag convention; the new third-party expiry PR action is SHA-pinned. Broader immutable pinning and its maintenance policy remain a separate hardening option.

### Dated Dependabot deferrals

The `Review expired Dependabot ignores` workflow checks the default branch daily at 08:37 UTC, or on manual dispatch from that branch. GitHub schedules can be delayed; this is not a guarantee of an exact-time migration. A comment in the exact form `# ignore-until: YYYY-MM-DD`, immediately above an ignore entry at the same indentation, makes it eligible for a removal proposal on or after that UTC date. The Node-types hold uses **2026-10-28** to coordinate migration with the other projects. The Changesets CLI/action holds remain undated for their separate joint migration, and the TypeScript 7.0 exclusion remains subject to compatibility review.

The workflow ports HygieneNote's expiry script: a dependency-free preflight skips npm installation when no dates are due; due rules are removed only after YAML validation and a semantic comparison proving all other configuration is unchanged. One `automation/expired-dependabot-ignores` PR targets the default branch and changes only `.github/dependabot.yml`. This does not install upgraded application dependencies, merge the PR, change repository settings, or bypass `Quality`. Dependabot still proposes dependency updates against `beta`. Following a reviewed merge to Main, the existing validated Beta synchronization path applies; resolve divergence by merging Main into Beta, never force-pushing.

To defer further, extend the annotation on the default branch. The next run updates or closes the obsolete removal PR even if no annotations are due. Do not hand-edit the automation branch; its content is regenerated. Review the proposed removal alongside the coordinated Node runtime/type upgrades before merging. The date is automated by this workflow, not by Dependabot itself.

The job has a five-minute timeout, non-overlapping runs, no persisted checkout credentials, and only contents/PR write permissions. Repository workflow-PR creation permission was verified enabled on 2026-09-07; Main still required a PR and up-to-date `Quality`. No settings were changed. Bot-created PR checks can require **Approve workflows to run** before merge; see [GitHub's workflow-trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). Scheduled execution begins only after the workflow reaches the default branch.

Preview without changing configuration:

```sh
node scripts/expire-dependabot-ignores.mjs --check --date 2026-10-28
node scripts/expire-dependabot-ignores.mjs --preview --date 2026-10-28
```

`npm test` includes expiry boundary, idempotency, formatting, malformed-input, CLI safety, repository-rule, and workflow-scope regressions. Local validation on 2026-09-07 passed 205 tests (11 expiry tests), zero-warning lint, the production build, actionlint 1.7.12, and documentation/versioning checks. The existing bundle-size warning remains. Hosted scheduled execution and PR creation still require validation after merge; local tests do not exercise those GitHub writes. This is development-tooling-only work, with no application release Changeset required under the [versioning policy](../versioning.md).

## Read-only deployed-site smoke check

`npm run test:smoke` requires five independently selected expected values. For example, to verify the recorded v2.4.3 release (replace these expectations when checking another release):

```sh
NODEDENT_SMOKE_URL=https://nodedent.com \
NODEDENT_SMOKE_VERSION=2.4.3 \
NODEDENT_SMOKE_MODE=current \
NODEDENT_SMOKE_BRANCH=main \
NODEDENT_SMOKE_COMMIT=b3fcdd0a0982c868cc24915aa2c4fed214cacf06 \
npm run test:smoke
```

Do not derive the expected version or SHA from the site's own `deployment.json`: that would let a stale deployment validate itself. Use the reviewed release/checkout instead. HTTPS origins are required, except loopback HTTP for local verification. The command also supports independently configured Beta and Sandbox targets; it does not initiate their deployments.

The checker compares `deployment.json`, HTML metadata, title, visible footer mode/version/full commit label, and the rendered empty vault gate. It fails on mismatches, browser errors, failed resources, redirects, non-GET requests, or cross-origin requests. It uses a fresh disposable browser context with service workers blocked, never a personal/clinic profile. There are no clicks, typing, vault creation/unlock, imports, or exports. Loading the app may initialize an empty local IndexedDB in that disposable context; no clinical records are created and no server-side data is written. Only same-origin GET requests are permitted. See [Playwright request interception](https://playwright.dev/docs/api/class-browsercontext#browser-context-route) for the service-worker boundary.

The Pages workflow adds a read-only `smoke` job **after** successful deployment, with a five-minute job timeout. Its expected version comes from the checked-out package, SHA from `github.sha`, and origin from `NODEDENT_CURRENT_ORIGIN`. It retains the existing pre-deployment and Beta synchronization gates. A smoke failure makes the deployment workflow red **after publication**; it does not roll back the site or authorize a redeployment. Inspect the failure before promoting further changes. The standalone command is outside `ci:local:full` so local/PR checks never contact production; its local regression scenario remains inside the ordinary browser suite.

### First live observation (2026-09-07)

A local execution against `https://nodedent.com` confirmed the expected v2.4.3 metadata, title, footer, and vault gate, but the overall smoke check **failed**: the served page attempted to load `https://static.cloudflareinsights.com/beacon.min.js/...`, which the app CSP blocked (`csp`). No matching beacon reference was found in the checked-in application source, index, or Vite configuration; hosting-layer injection is a hypothesis to verify in the hosting configuration. Do not allowlist analytics or weaken the CSP to turn this green. Removing the injected analytics requires a separately authorized hosting change. Until resolved, the new post-deployment job is expected to report this existing problem. No deployment or repository/hosting setting was changed during this check.

## Recorded local validation

The focused accessibility/smoke implementation was locally validated on 2026-09-07 with Node 24.18.0: 12/12 Chromium scenarios using two workers and no retries, 194 unit/domain/tooling tests, zero-warning lint, TypeScript/production build, documentation and versioning checks, actionlint 1.7.12, and all four deployment-mode builds passed. npm reported no vulnerabilities when installing the axe integration. The live read-only smoke result is the separate failure documented above, and the new hosted post-deployment job remains unvalidated. These checks do not certify full WCAG conformance or clinical readiness.

Initial implementation validation on 2026-09-07 passed with Node 24.18.0 after a clean `npm ci`: actionlint 1.7.12, zero-warning ESLint, TypeScript, 191 existing tests, documentation checks, the production build, all four deployment modes, and all five Chromium scenarios. The complete gate ran with `CI=true` (two browser workers), synthetic Beta metadata, and a reserved `.invalid` origin. The deployment evidence in `dist/` remained unchanged by browser testing. npm reported no vulnerabilities during the clean install. This is local evidence, not a hosted Actions run or a deployable clinic configuration.

## Recorded hosted validation

The following evidence was checked on 2026-09-07; it replaces the earlier “first hosted run still required” status:

| Evidence | Result and limit |
| --- | --- |
| [Version PR Quality](https://github.com/bbilaniu/nodedent/actions/runs/34155215493) | Passed for PR head `0d1f565baba5f816b6d549ef794d878ccd60cc58`. PR builds record the temporary merge commit actually checked out, not this head SHA. |
| [Main Quality](https://github.com/bbilaniu/nodedent/actions/runs/34155429447) | Passed at v2.4.3 commit `b3fcdd0a0982c868cc24915aa2c4fed214cacf06`, including actionlint, Linux Chromium installation, browser tests, the deployment matrix, and deployment-evidence upload. |
| [Pages](https://github.com/bbilaniu/nodedent/actions/runs/34155429443) | Build and deploy jobs passed at the same release commit. This is deployment-workflow evidence, not a post-deployment browser smoke test. |
| [Version](https://github.com/bbilaniu/nodedent/actions/runs/34155429458) | Tagging, archive creation, and the release Beta fast-forward passed, including the exact-commit Beta quality gate and evidence upload. The non-release synchronization job was skipped in this run; do not count it as exercised by this evidence. |
| [Earlier failed browser run](https://github.com/bbilaniu/nodedent/actions/runs/34153443121) | Failure screenshots, error context, and trace were uploaded and downloaded for investigation. Retention is seven days, so this evidence is temporary. |

On 2026-09-07, the active default-branch ruleset required PRs and an up-to-date `Quality` check. No Beta branch rules were returned. Main and Beta both pointed to the v2.4.3 release commit above at the inspection time. No repository settings were modified. Keep the `Quality` name stable; any proposed Beta protection must account for the existing validated automatic fast-forward path.

## Timeout investigation

Two failures must not be conflated:

- **Explicit lock followed immediately by reload:** the hosted failure above reloaded about 42 ms after the lock click, while the workspace was still visible. After unlocking, it showed “Start a new case” rather than a saved active case. The test interrupted the asynchronous save. The explicit-lock helper now waits for “Unlock clinical vault” before navigation; the post-reload event equality assertion still checks that the recorded entry actually persisted.
- **Separate local unlock timeout:** after that correction, an earlier two-worker, five-repeat full-suite run passed 24/25 scenarios. The failing vault-access scenario timed out after 10 seconds waiting to click “Continue case” following reload and unlock. Its failure snapshot showed the saved case and that button, unlike the hosted missing-case failure. That snapshot alone does not establish when the button became available or whether storage, rendering, or browser scheduling caused the delay. The ordinary five-test rerun passed. The root cause remains unconfirmed; neither a blanket timeout increase nor retries have been introduced.

Follow-up investigation on 2026-09-07 used v2.4.3, Node 24.18.0/npm 11.16.0, and two Chromium workers on macOS. Temporary, payload-free timing probes observed the real Web Crypto operations, IndexedDB transaction completion, and persistent-storage requests. All 10 focused vault-access repetitions and all 25 mixed-suite repetitions passed. In the focused run, the maximum observed key derivation was 955 ms, transaction completion 20 ms, persistent-storage request 1.4 ms, and encryption/decryption under 2 ms. These are observed diagnostic timings, not performance guarantees; instrumentation can affect scheduling. No slow storage operation explaining the earlier 10-second timeout was reproduced. The probes were removed after investigation, and no application or test behavior was changed. Browser/process contention remains a hypothesis, not a demonstrated cause.

After removing the probes, another five repetitions of the unchanged full suite passed **25/25**, with `CI=true`, two workers, retained traces, and retries still disabled. This is local v2.4.3 evidence, separate from the hosted run links above. It does not erase the earlier failure or prove the intermittent issue resolved.

For another occurrence, preserve the trace and error context before starting a new run (the default output directory is replaced). Reproduce with `CI=true npm run test:e2e -- --grep 'vault creation' --repeat-each=10 --trace=on`, then with `CI=true npm run test:e2e -- --repeat-each=5 --trace=on` to exercise mixed scenarios with two workers. Use a separate `--output` directory when retaining multiple investigations. Inspect the unlock click, case-library loading state, locator resolution, and actual saved-case presence; a timeout on “Continue case” is not itself evidence of a failed passphrase or lost data. Instrumentation must use synthetic fixtures and record operation names/durations only, never passphrases, key material, or case payloads.

## Remaining assurance work

| Area | Remaining work |
| --- | --- |
| Reliability | Establish the cause of the separate intermittent unlock timeout; retain failure evidence and distinguish instrumented diagnostics from ordinary suite validation. |
| Browser journeys | Full endodontic and operative journeys are deferred by request. Broader continuation, shared-module scope, and destructive case/vault confirmations remain uncovered. |
| Accessibility and visuals | Focused axe and keyboard checks are implemented; broader surfaces, visual snapshots, additional viewport/theme combinations, and other browsers remain follow-up coverage. |
| Deployed behavior | The read-only checker and post-Pages job are implemented. Resolve the live blocked analytics resource and obtain a green hosted smoke result; this branch's new workflow is not yet hosted-validated. |
| Maintenance and settings | Triage dependency PRs without weakening checks; decide Beta protection and automatic security-update policy with explicit authorization. Keep Node type definitions aligned with the supported runtime. |
| Manual release evidence | Complete a release-specific [device/browser checklist](clinical-device-browser-and-synthetic-test-checklist.md), including screen reader, zoom, and chairside input checks. The existing record references v2.0.0 and is not evidence of v2.4.3 approval. Do not overwrite historical findings or invent sign-off. |

Keep the [automated assurance spec](../specs/automated-assurance.md) active until its remaining completion criteria are met.
