---
status: implemented
created_on: 2026-07-20
completed_on: 2026-07-22
---

# Add a global footer with the NodeDent application version

## Goal

Add a quiet, globally visible footer to the NodeDent clinical workspace that identifies the deployed application version, for example:

```text
NodeDent v0.1.0
```

The displayed value must come from the root `package.json` version so it changes automatically when Changesets versions the application. It identifies only the complete NodeDent application release; it must not be presented as a workflow-definition or persisted-data schema version.

## Context and sequencing

NodeDent currently has no global footer. The application shell is rendered by `src/nodedent/NodeDentApp.tsx`, and the application version is stored in the root `package.json`.

Implement this spec after, or in the same change as, the Changesets baseline described in `docs/specs/Implement-Changesets.md`.

- If implemented in the Changesets-baseline change, include the footer in the retrospective minor Changeset and preserve that spec's requirement to have exactly one pending Changeset.
- If implemented after the Changesets baseline has been released, add a separate patch Changeset for the user-visible footer.
- Do not consume a pending Changeset, create a Git tag, publish to npm, commit, or push as part of this task.

## Scope

Implement only the global application footer and application-version presentation described here.

Do not:

- change clinical workflow behavior;
- change workflow-definition versions;
- add or change persisted-data schema versions;
- include the application version in clinical notes, printable summaries, event logs, or JSON exports;
- add release dates, environment names, commit hashes, build times, or update-checking behavior;
- expose the full contents of `package.json` to application UI;
- duplicate the application version as a manually maintained string; or
- copy unrelated links or branding from the Pulp footer.

## Required changes

### 1. Add a single application-version source

Read the version from the root `package.json` and expose only a validated application-version string to the footer.

Prefer a small module such as:

```text
src/nodedent/applicationVersion.ts
```

That module should:

- import the root `package.json`;
- return its `version` only when it is a non-empty string; and
- avoid a second hard-coded version fallback that could drift from `package.json`.

Enable TypeScript JSON-module resolution in `tsconfig.json` if the selected import requires it. Keep the configuration change minimal and compatible with the existing Vite build.

Do not read the version from `window`, local storage, workflow data, persisted cases, or runtime network requests.

### 2. Add a reusable footer component

Add a focused component, preferably:

```text
src/nodedent/components/AppFooter.tsx
```

The component should:

- render semantic `<footer>` markup;
- display `NodeDent v{version}` when a valid version is available;
- identify the value accessibly as the application version, using visible text, an `aria-label`, or an equivalent concise accessible name;
- render nothing, or omit only the version metadata, if no valid version is available; and
- remain free of clinical case state and workflow state.

Keep the component small. Do not introduce a general metadata framework or footer configuration system for this requirement.

### 3. Integrate the footer globally

Render the footer from `NodeDentApp.tsx` so it remains visible at the bottom of the application shell regardless of which primary workflow or shared module is active.

Place it in normal document flow after the main workspace content. It must not:

- be fixed or sticky;
- overlap workflow controls, dialogs, or mobile browser chrome;
- appear inside modal content;
- become part of copied or exported clinical output; or
- depend on whether a case or workflow is active.

### 4. Match NodeDent visual language

Use the existing NodeDent Tailwind tokens and responsive layout patterns.

The footer should be deliberately lower emphasis than clinical content:

- small text;
- `text-brand-slate` or the closest existing muted semantic color;
- centered or end-aligned within the existing maximum-width application shell;
- comfortable vertical spacing and mobile wrapping;
- no prominent card, alert, badge, or primary-action treatment; and
- readable contrast in both light and dark modes.

The preferred visible label is:

```text
NodeDent v0.1.0
```

Do not display the package name `nodedent` as if it were a workflow identifier. Do not label the value simply as `Version` when the context could be confused with workflow or schema versions.

### 5. Add regression coverage

Extend the existing Node test suite using its React server-rendering pattern.

At minimum, verify that:

- the footer renders semantic footer markup;
- the visible label contains `NodeDent v` followed by the current `package.json` version;
- the accessible label identifies it as the application version;
- the displayed version is sourced from the same imported package metadata used by the component; and
- the footer does not require case or workflow props.

Prefer a focused component-rendering test. Do not snapshot the entire `NodeDentApp` or couple the test to unrelated clinical markup.

### 6. Document the visible application version

Update `docs/versioning.md` if that guide exists when this spec is implemented. State that:

- the global footer displays the application semantic version from `package.json`;
- Changesets updates that value during application versioning;
- the footer version is not a workflow-definition version or persisted-data schema version; and
- clinical notes and structured exports do not automatically include the application version.

If `docs/versioning.md` does not yet exist because the Changesets baseline has not been implemented, add this requirement to that implementation rather than creating a competing versioning document.

### 7. Complete the spec-document lifecycle

After all acceptance criteria are satisfied:

- move this file to `docs/specs/archive/global-footer-and-application-version.md`;
- change its frontmatter status to `implemented`;
- preserve `created_on: 2026-07-20` and add the actual `completed_on` date in `YYYY-MM-DD` format;
- move its entry in `docs/README.md` from Active Product And Implementation Specs to Archived Implemented Specs; and
- run `npm run docs:check` after the move.

## Validation

Run:

```sh
npm run typecheck
npm test
npm run build
npm run docs:check
```

Also verify manually at narrow and wide viewport widths that:

- the version is readable in light and dark modes;
- the footer does not obscure workspace controls;
- the footer remains below the application content; and
- opening workflows and modals does not duplicate the footer inside those surfaces.

Do not run release or tag commands merely to test that the visible version changes. The component-rendering test and direct `package.json` source are sufficient.

## Acceptance criteria

The task is complete when:

- a semantic global footer is rendered by the NodeDent application shell;
- the footer shows `NodeDent v{package.json version}`;
- there is no separately maintained application-version string;
- the version is clearly identified as the application version for assistive technology;
- the footer is responsive and readable in light and dark modes;
- the footer does not appear in clinical notes or data exports;
- workflow and persisted-data versions are unchanged;
- focused regression coverage passes;
- the relevant Changeset policy above is followed;
- `docs/versioning.md` describes the visible version when available;
- this spec is archived with completed lifecycle metadata; and
- all validation commands pass.

## Final response

Report:

1. Files added or changed.
2. How the application version is sourced from `package.json`.
3. Where and how the footer is rendered.
4. Accessibility and responsive-visual decisions.
5. Tests and validation results.
6. Changeset handling and confirmation that no release or tag command was run.
7. Confirmation that workflow and persisted-data versions were not changed.
