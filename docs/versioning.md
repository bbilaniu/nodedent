# Versioning and releases

NodeDent uses Changesets to manage application releases while keeping application, workflow-definition, and persisted-data versions independent.

## Version model

### Application version

The root `package.json` and Changesets manage the semantic version of the complete released or deployed NodeDent application. The first formally tracked release is represented by the pending transition:

```text
0.1.0 → 0.2.0
```

This application version does not automatically determine workflow or persisted-data compatibility.

### Workflow-definition versions

Workflow source files define their own versions, for example:

```ts
endodonticRootWorkflowVersion = "0.1.0";
```

Bump a workflow version only when that workflow's behavior changes, including its clinical decisions or paths, event semantics, readiness or scope rules, note-output meaning, or workflow-data interpretation. General UI, build, documentation, and unrelated workflow changes must not automatically bump every workflow version.

### Persisted-data schema versions

Persisted and exported formats should use explicit schema versions that are independent of the application semantic version. Schema changes should use explicit migrations and occur only when persisted or imported data compatibility changes.

The general case JSON export does not currently expose a top-level schema version. Adding one requires a separately reviewed compatibility and migration change. Existing independently versioned user-catalog storage formats remain unchanged by the Changesets baseline.

## Pre-1.0 bump policy

### Patch

Use a patch bump for observable compatible corrections such as:

- visual or accessibility fixes;
- wording corrections;
- release-worthy documentation or test-backed corrections that accompany an observable patch; and
- bug fixes that do not alter persisted-data compatibility or clinical meaning.

Tests-only and documentation-only changes normally do not require a Changeset.

### Minor

Use a minor bump for:

- new workflows or shared modules;
- new persisted fields;
- changed clinical decision behavior;
- changed readiness or scope semantics;
- changed clinical-note meaning;
- compatibility or migration changes; and
- other breaking behavior while NodeDent remains below `1.0.0`.

After `1.0.0`, incompatible public behavior should use a major version.

## Contributor guidance

A Changeset is required for user-visible changes, new workflows or modules, changes to clinical behavior or note output, persistence/import/export changes, compatibility or migration changes, and significant bug fixes.

A Changeset is normally not required for internal refactoring with no observable behavior change, tests only, documentation only, formatting, or development tooling that does not affect released behavior.

Create a pending Changeset with:

```sh
npm run changeset
```

Use this reviewed release sequence from a clean release branch or release pull request:

```sh
npm run changeset
npm run version
npm run test
npm run typecheck
npm run build
npm run release
```

`npm run version` consumes pending Changesets and updates package versions and the changelog. `npm run release` creates Git tags only. NodeDent is private and nothing in this release flow publishes it to npm.
