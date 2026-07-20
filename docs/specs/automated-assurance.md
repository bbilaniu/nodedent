---
status: active
created_on: 2026-07-20
---

# Automated Assurance

## Goal

Establish required pull-request and deployment evidence for NodeDent's existing domain tests, documentation checks, browser workflows, and accessibility behavior.

This spec owns ASSURE-01 and ASSURE-02 from the [2026-07-11 website review](../reviews/2026-07-11-website-review.md).

## Current Baseline

The repository has a GitHub Pages workflow that runs `npm ci` and `npm run build` after pushes to `main`. Because `build` includes TypeScript checking, deployment receives a build/type gate, but there is no pull-request trigger and no explicit domain-test, documentation-lifecycle, end-to-end, or accessibility gate.

## Required Outcomes

- Add pull-request and default-branch CI for:
  - `npm ci`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run docs:check`
  - `npm run versioning:check`
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
