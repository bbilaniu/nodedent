---
status: active
created_on: 2026-07-20
---

# Automated Assurance

## Goal

Establish required pull-request and deployment evidence for NodeDent's existing domain tests, documentation checks, browser workflows, and accessibility behavior.

This spec owns ASSURE-01 and ASSURE-02 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md).

## Baseline Before Implementation

The repository has a GitHub Pages workflow that runs `npm ci` and `npm run build` after pushes to `main`. Because `build` includes TypeScript checking, deployment receives a build/type gate, but there is no pull-request trigger and no explicit domain-test, documentation-lifecycle, end-to-end, or accessibility gate.

## Implementation Progress

The `CI` workflow now provides a stable `Quality` job on pull requests and pushes to `main` and `beta`. It installs locked dependencies and runs versioning validation, typechecking, domain tests, documentation lifecycle validation, the production build, and the clinical security boundary check as separately named steps. The security check verifies the production network-blocking CSP, rejects common network APIs in the clinical source tree, and guards the case-storage boundary. The existing Pages workflow builds and security-checks the exact commit it deploys.

The September 2026 CI implementation adds zero-warning JavaScript/TypeScript and core React Hooks linting, actionlint workflow validation, the four-build deployment matrix, and a Chromium suite against production-built synthetic Sandbox assets. The existing `Quality` check includes all of these checks. Pages deployment and both automatic Beta synchronization paths run `ci:local:full`; the browser build uses `.e2e-dist/` so it cannot replace the privileged artifact in `dist/`. PR identity now records the checked-out merge commit rather than the PR head.

Hosted validation is now recorded for v2.4.3 at `b3fcdd0a0982c868cc24915aa2c4fed214cacf06`: [main Quality](https://github.com/bbilaniu/nodedent/actions/runs/34155429447), [Pages build and deployment](https://github.com/bbilaniu/nodedent/actions/runs/34155429443), and [release tagging, archive creation, and validated Beta fast-forward](https://github.com/bbilaniu/nodedent/actions/runs/34155429458) passed. The guide links PR and failure-artifact evidence separately. These runs demonstrate the implemented gates, not complete browser coverage, clinical approval, or resolution of every intermittent failure.

The live ruleset inspected on 2026-09-07 requires the up-to-date `Quality` check and a pull request on the default branch. No Beta branch rules were returned. Dependabot version-update PRs and vulnerability alerts are operational; automatic security-update PRs are disabled. Repository settings were not changed.

The focused accessibility slice adds real keyboard interaction, axe WCAG 2.0/2.1 A/AA scans, and desktop/light plus narrow/dark checks for vault access, case-import dialogs, and anesthesia record-versus-close behavior. Regressions found during implementation prompted light-theme contrast corrections and dialog background suppression across ancestor siblings. These application corrections are separate from CI/test plumbing and do not alter workflow or persisted-data semantics.

A read-only deployed-site checker now verifies loading, application version, deployment mode, and full commit identity against independent expectations. It runs locally against synthetic production assets as part of `Quality`, and the Pages workflow adds a separate post-deployment smoke job. Its first local run against the live v2.4.3 site validated identity but failed on a CSP-blocked Cloudflare Insights resource. The new hosted job has not yet run; a green deployed smoke result remains outstanding. No hosting settings or CSP exceptions were changed.

Full endodontic and operative browser journeys are **deferred by user request**, not completed or removed from the assurance requirements. Remaining work includes broader browser/accessibility coverage, focused visual snapshots, resolving and validating the live smoke finding, manual release evidence, and a decision about Beta branch protection. See the [CI verification guide](../guides/ci-verification.md) for commands, current browser coverage, dependency maintenance, and verification limits.

The original explicit-lock/reload test race has been corrected. A separate local unlock timeout remains an investigation item; do not mark it resolved solely because subsequent runs pass. See the guide's timeout evidence and reproduction instructions.

## Required Outcomes

- Add pull-request and default-branch CI for:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run docs:check`
  - `npm run versioning:check`
  - `npm run deployment:matrix`
  - `npm run test:e2e`
- Validate GitHub Actions workflow syntax with actionlint.
- Keep deployment dependent on a passing build of the exact deployed commit.
- Define branch-protection checks after stable job names exist.
- Add Playwright coverage for neutral-case launch, both primary workflows, autosave reload, scoped shared modules, continuation, import/export, destructive confirmation, and representative viewport sizes.
- Add automated axe checks and focused visual snapshots for light/dark, focus, dialog, and responsive states.
- Add a deployed-site smoke test that does not create or transmit clinical content.
- Split the large Node test file only when doing so improves ownership and diagnostics; do not make test-file reorganization a prerequisite for safety coverage.
- Document dependency-audit policy before making audit output a required gate.

## Evidence Requirements

- CI failures must identify the failing command or browser scenario.
- Browser tests must use synthetic non-patient fixtures.
- Deployment evidence must identify the application version and commit without placing those values in clinical notes.
- Manual VoiceOver/NVDA, zoom, touch, and gloved-device checks remain documented release evidence even where automation cannot replace them.

## Validation

Run the complete required workflow locally where practical and verify the GitHub Actions workflow on a pull request before requiring its checks.

## Completion

Archive this spec when required PR checks, browser/accessibility coverage, deployment dependency, and non-PHI smoke testing are operational and documented.
