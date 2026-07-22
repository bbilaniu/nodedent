# Versioning and releases

NodeDent uses Changesets to manage application releases while keeping application, workflow-definition, and persisted-data versions independent.

## Version model

### Application version

The root `package.json` and Changesets manage the semantic version of the complete released or deployed NodeDent application. The first formally tracked application release is:

```text
1.0.0
```

The catch-up Changeset that established this baseline has been consumed. There is no pending baseline transition. Future application releases start from `1.0.0` and follow ordinary semantic versioning.

The global application footer displays `NodeDent v{version}` using this `package.json` value. Changesets updates the displayed value when it versions the application. The footer version does not automatically determine workflow-definition or persisted-data compatibility, and clinical notes and structured exports do not automatically include it.

### Workflow-definition versions

Workflow source files define their own versions, for example:

```ts
endodonticRootWorkflowVersion = "0.1.0";
```

Bump a workflow version only when that workflow's behavior changes, including its clinical decisions or paths, event semantics, readiness or scope rules, note-output meaning, or workflow-data interpretation. General UI, build, documentation, and unrelated workflow changes must not automatically bump every workflow version.

### Persisted-data schema versions

Persisted and exported formats should use explicit schema versions that are independent of the application semantic version. Schema changes should use explicit migrations and occur only when persisted or imported data compatibility changes.

The general case JSON export exposes its independent top-level `schemaVersion: 1`. Future incompatible schema changes require separately reviewed compatibility and migration work. Existing independently versioned user-catalog storage formats remain independent from the application version.

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
npm install --package-lock-only --ignore-scripts
npm run versioning:check
npm run test
npm run typecheck
npm run build
npm run docs:check
npm run release
```

`npm run version` consumes pending Changesets and updates package versions and the changelog. Changesets does not reliably synchronize the root version metadata in `package-lock.json` for this private single-package application, so refresh the lockfile metadata and run the invariant check before validation. Commit and review the generated version, lockfile, and changelog changes before tagging. `npm run release` creates Git tags only and should run only from the reviewed release commit. NodeDent is private and nothing in this release flow publishes it to npm.

## Ongoing versioning validation

Run:

```sh
npm run versioning:check
```

The ongoing check validates:

- package name, privacy, semantic version, Changesets dependency, and release scripts;
- root package name/version alignment between `package.json` and `package-lock.json`;
- a matching current-version heading in `CHANGELOG.md`;
- the repository's Changesets configuration; and
- every pending Changeset when zero or more are present.

For this single-package repository, each pending Changeset must target `nodedent` exactly once, use a patch, minor, or major bump, and include a non-empty release summary. The check intentionally allows no pending Changesets between feature changes and after a versioning release.
