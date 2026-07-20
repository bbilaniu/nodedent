# Versioning and releases

NodeDent uses Changesets to manage application releases while keeping application, workflow-definition, and persisted-data versions independent.

## Version model

### Application version

The root `package.json` and Changesets manage the semantic version of the complete released or deployed NodeDent application. The first formally tracked application release is:

```text
1.0.0
```

The catch-up Changeset that established this baseline has been consumed. There is no pending baseline transition. Future application releases start from `1.0.0` and follow ordinary semantic versioning.

The application version does not automatically determine workflow-definition or persisted-data compatibility.

### Workflow-definition versions

Workflow source files define their own versions, for example:

```ts
endodonticRootWorkflowVersion = "0.1.0";
```

Bump a workflow version only when that workflow's behavior changes, including its clinical decisions or paths, event semantics, readiness or scope rules, note-output meaning, or workflow-data interpretation. General UI, build, documentation, and unrelated workflow changes must not automatically bump every workflow version.

### Persisted-data schema versions

Persisted and exported formats should use explicit schema versions that are independent of the application semantic version. Schema changes should use explicit migrations and occur only when persisted or imported data compatibility changes.

The general case JSON export does not currently expose a top-level schema version. Adding one requires a separately reviewed compatibility and migration change. Existing independently versioned user-catalog storage formats remain unchanged by the Changesets baseline.

## Semantic version bump policy

### Patch

Use a patch bump for observable compatible corrections such as:

- visual or accessibility fixes;
- wording corrections;
- release-worthy documentation or test-backed corrections that accompany an observable patch; and
- bug fixes that do not alter persisted-data compatibility or clinical meaning.

Tests-only and documentation-only changes normally do not require a Changeset.

### Minor

Use a minor bump for:

- backward-compatible new workflows or shared modules;
- new user-visible capabilities;
- compatible persisted fields with explicit defaults and migrations where required;
- backward-compatible extensions to clinical decision behavior, readiness, or scope semantics;
- backward-compatible additions to clinical-note output; and
- other substantial user-visible changes that preserve existing supported behavior and data compatibility.

Clinically meaningful workflow changes may also require the affected workflow-definition version to change. That decision remains independent of the application-version bump.

### Major

Use a major bump for incompatible released behavior after the `1.0.0` baseline, including:

- persisted or exported schema changes that cannot preserve supported data through migration;
- removed or incompatibly renamed public keys, workflow IDs, event types, or output contracts;
- changed clinical decision, readiness, scope, or note semantics that invalidate existing supported interpretations;
- removal of supported workflows or capabilities without a compatible transition; and
- other changes that require users, integrations, stored records, or documented operating procedures to migrate incompatibly.

A major application bump does not replace explicit persisted-data migrations or affected workflow-definition version changes.

## Contributor guidance

A Changeset is required for user-visible changes, new workflows or modules, changes to clinical behavior or note output, persistence/import/export changes, compatibility or migration changes, and significant bug fixes. Choose patch, minor, or major from the released compatibility impact described above.

A Changeset is normally not required for internal refactoring with no observable behavior change, tests only, documentation only, formatting, or development tooling that does not affect released behavior.

When a feature or fix requires a release entry, create a pending Changeset on that feature branch with:

```sh
npm run changeset
```

Do not run `npm run version` on ordinary feature or documentation branches. It consumes all pending Changesets and belongs in an intentional release-preparation branch or pull request.

From a clean release-preparation branch, review all pending Changesets, then use:

```sh
npm run version
npm run test
npm run typecheck
npm run build
npm run docs:check
npm run release
```

`npm run version` consumes pending Changesets and updates package versions and the changelog. Commit and review those generated version/changelog changes before tagging. `npm run release` creates Git tags only and should run only from the reviewed release commit. NodeDent is private and nothing in this release flow publishes it to npm.

## Current tooling follow-up

`scripts/check-versioning.mjs` was written as a one-time baseline validator. It still expects package version `0.1.0` and exactly one pending minor Changeset, so those assertions are obsolete after the `1.0.0` baseline was established. Do not treat that script's current failure as evidence that a new Changeset is required. Generalize the script in a separate tooling change before making `npm run versioning:check` a required ongoing CI gate.
