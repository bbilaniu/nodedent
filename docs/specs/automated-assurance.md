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

The `CI` workflow now provides a stable `Quality` job on pull requests and pushes to `main`. It installs locked dependencies and runs versioning validation, typechecking, domain tests, documentation lifecycle validation, the production build, and the clinical security boundary check as separately named steps. The security check verifies the production network-blocking CSP, rejects common network APIs in the clinical source tree, and guards the case-storage boundary. The existing Pages workflow builds and security-checks the exact commit it deploys.

The September 2026 CI implementation adds zero-warning JavaScript/TypeScript and core React Hooks linting, actionlint workflow validation, the four-build deployment matrix, and a Chromium suite against production-built synthetic Sandbox assets. The existing `Quality` check includes all of these checks. Pages deployment and both automatic Beta synchronization paths run `ci:local:full`; the browser build uses `.e2e-dist/` so it cannot replace the privileged artifact in `dist/`. PR identity now records the checked-out merge commit rather than the PR head.

The live ruleset inspected on 2026-09-07 requires the up-to-date `Quality` check and a pull request on the default branch. No Beta protection was returned. Repository settings were not changed. Hosted validation of this implementation remains required before claiming the new gates are operational.

The remaining work in this spec includes broader browser and accessibility coverage, focused visual snapshots, deployed-site smoke testing, release evidence, and a decision about Beta branch protection. See the [CI verification guide](../guides/ci-verification.md) for commands, current browser coverage, dependency maintenance, and verification limits.

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
