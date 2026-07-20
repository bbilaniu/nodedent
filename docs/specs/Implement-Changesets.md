---
status: active
created_on: 2026-07-20
---

# Implement Changesets and establish the NodeDent release-versioning baseline  
  
## Goal  
  
Add Changesets to the NodeDent repository and establish a clean versioning baseline for future releases.  
  
NodeDent currently has Git history but has not used formal application release versioning. Do not fabricate historical semantic releases. Instead:  
  
1. Preserve previous development in a manually written historical section of ==CHANGELOG.md==.  
2. Add one retrospective/catch-up Changeset representing the first formally versioned NodeDent release.  
3. Configure Changesets for a private application that is versioned and tagged but never published to npm.  
4. Keep application, workflow, and persisted-data versions separate.  
  
## Current repository context  
  
The project currently appears to have:  
  
```
{
  "name": "systematic-endo-guide",
  "version": "0.1.0",
  "private": true
}

```
  
  
The repository also contains independently versioned workflow definitions, such as:  
  
```
endodonticRootWorkflowVersion = "0.1.0";

```
  
  
Those workflow versions must remain independent from the application package version.  
  
The current application includes, at minimum:  
  
- a workflow-neutral NodeDent Home screen;  
- an endodontic RCT primary workflow;  
- an operative direct-restoration primary workflow;  
- shared anesthesia, isolation, and radiology modules;  
- event-backed clinical documentation and readiness state;  
- local autosave and saved-case resume;  
- JSON import/export;  
- compact, full, patient, printable, event-log, and JSON output modes;  
- responsive layouts and dark mode;  
- automated domain and component-rendering tests.  
  
## Scope  
  
Implement only the release/versioning infrastructure described below.  
  
Do not:  
  
- change clinical workflow behavior;  
- automatically synchronize workflow versions with the application version;  
- alter persisted case schemas;  
- introduce an npm publishing workflow;  
- create Git tags or GitHub releases during this task;  
- commit or push changes;  
- rewrite Git history;  
- invent historical release numbers for previous commits.  
  
## Required changes  
  
### 1. Rename the package  
  
Change the package name from:  
  
```
"systematic-endo-guide"

```
  
  
to:  
  
```
"nodedent"

```
  
  
Keep:  
  
```
"private": true

```
  
  
Update references to the old package name only where necessary for package tooling or documentation. Do not rename storage keys, schema kinds, or unrelated historical identifiers as part of this task.  
  
### 2. Install and initialize Changesets  
  
Add ==@changesets/cli== as a development dependency.  
  
Add these scripts to ==package.json==:  
  
```
{
  "changeset": "changeset",
  "version": "changeset version",
  "release": "changeset tag"
}

```
  
  
If a script name conflicts with an existing script, preserve the existing behavior and choose a clear alternative.  
  
Initialize the ==.changeset== directory and add a configuration equivalent to:  
  
```
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": true
  }
}

```
  
  
Use the schema version installed by the package manager if it differs. Do not hard-code an incompatible schema URL.  
  
The configuration must:  
  
- version the private ==nodedent== package;  
- allow Changesets to generate Git tags when explicitly requested;  
- not publish the package to npm;  
- use ==main== as the base branch;  
- not automatically commit generated changes.  
  
### 3. Add a historical ==CHANGELOG.md==  
  
Create ==CHANGELOG.md== if it does not exist.  
  
Add a clearly labelled historical section that summarizes development before formal Changesets adoption.  
  
Use wording similar to:  
  
```
# Changelog

This project began using formal application release versioning with Changesets in 2026.

## Historical development before formal versioning

The following capabilities were developed before application releases were formally tracked with Changesets:

- Established the NodeDent clinical workspace and workflow-neutral home screen.
- Added the endodontic RCT workflow.
- Added the operative direct-restoration workflow.
- Added shared anesthesia, isolation, and radiology modules.
- Added event-backed clinical documentation and scoped readiness tracking.
- Added local autosave, saved-case resume, and JSON import/export.
- Added compact, full, patient, printable, event-log, and JSON outputs.
- Added responsive layouts, dark mode, and automated workflow tests.

This section is a retrospective summary of Git history. It does not represent separately issued historical semantic releases.

```
  
  
Adjust the wording if repository history shows that any listed item is inaccurate.  
  
Do not assign fake historical versions such as ==0.2.0==, ==0.3.0==, or ==0.4.0== to old commits.  
  
### 4. Add one catch-up Changeset  
  
Create one pending Changeset for package ==nodedent==.  
  
Use a **minor** bump from the current ==0.1.0==, so that running the version command later will produce ==0.2.0==.  
  
The Changeset should summarize the first formally tracked NodeDent application release.  
  
Use a structure similar to:  
  
```
---
"nodedent": minor
---

Establish the first formally versioned NodeDent clinical workspace release.

**User-visible changes**

- Added a workflow-neutral home screen for selecting primary workflows.
- Added endodontic RCT and operative direct-restoration workflows.
- Added shared anesthesia, isolation, and radiology modules.
- Added local autosave, saved-case resume, and JSON import/export.
- Added multiple clinical-note and data-output formats.
- Added responsive layouts and dark mode.

**Clinical architecture**

- Added event-backed workflow documentation.
- Added scoped shared-module readiness and capability tracking.

**Compatibility**

- This release establishes application-level versioning.
- Workflow-definition versions remain independently managed.
- No persisted-case schema migration is introduced by this Changeset.

```
  
  
Use an ordinary Changesets-generated filename rather than a fixed filename.  
  
Do not run ==changeset version== during this task. The Changeset must remain pending so it can be reviewed before producing ==0.2.0==.  
  
### 5. Document the versioning model  
  
Add a concise release/versioning document, preferably:  
  
```
docs/versioning.md

```

Add the new versioning guide to ==docs/README.md== under Engineering Guides so it is discoverable.
  
  
Document the distinction between:  
  
### Application version  
  
Managed through ==package.json== and Changesets:  
  
```
0.1.0 → 0.2.0

```
  
  
This identifies a released/deployed version of the complete NodeDent application.  
  
### Workflow versions  
  
Defined independently in workflow source files:  
  
```
endodonticRootWorkflowVersion = "0.1.0";

```
  
  
A workflow version should be bumped only when that workflow’s behavior changes, including:  
  
- clinical decisions or paths;  
- event semantics;  
- readiness or scope rules;  
- note-output meaning;  
- workflow data interpretation.  
  
A general UI, build, documentation, or unrelated workflow change must not automatically bump every workflow version.  
  
### Persisted-data schema version  
  
Persisted/exported formats should use their own explicit schema versions rather than reusing the application semantic version. The current general case JSON export does not expose a top-level schema version; introducing one and adding the corresponding migration behavior are outside the scope of this task. Existing independently versioned persisted formats, such as user-catalog storage, must remain unchanged.
  
Document that the schema version:  
  
- is independent of the application semantic version;  
- should use explicit migrations;  
- should change only when persisted/imported data compatibility changes.  
  
Do not implement a new schema version in this task.  
  
### 6. Document the bump policy  
  
In ==docs/versioning.md==, define the pre-1.0 policy:  
  
### Patch  
  
Examples:  
  
- visual fixes;  
- accessibility fixes;  
- wording corrections;  
- release-worthy documentation or test-backed corrections when they accompany an observable patch;
- bug fixes that do not alter persisted data or clinical meaning.  

Tests-only and documentation-only changes normally do not require a Changeset, as described in the contributor guidance below.
  
### Minor  
  
Examples:  
  
- new workflows or shared modules;  
- new persisted fields;  
- changed clinical decision behavior;  
- changed readiness or scope semantics;  
- changed clinical-note meaning;  
- compatibility or migration changes;  
- other breaking behavior while the application remains below ==1.0.0==.  
  
Also document that after ==1.0.0==, incompatible public behavior should use a major version.  
  
### 7. Add contributor guidance  
  
Add the contributor guidance below to ==docs/versioning.md== and link that guide from ==docs/README.md==. Do not treat the documentation index itself as the contributor guide.
  
Explain when a Changeset is required.  
  
A Changeset is required for:  
  
- user-visible changes;  
- new workflows or modules;  
- changes to clinical behavior;  
- changes to note output;  
- changes to persistence/import/export;  
- compatibility or migration changes;  
- significant bug fixes.  
  
A Changeset is normally not required for:  
  
- internal refactoring with no observable behavior change;  
- tests only;  
- documentation only;  
- formatting;  
- development tooling that does not affect released behavior.  
  
Document the command:  
  
```
npm run changeset

```
  
  
Also document the intended release sequence:  
  
```
npm run changeset
npm run version
npm run test
npm run typecheck
npm run build
npm run release

```
  
  
Clarify that:  
  
- ==npm run version== consumes pending Changesets and updates versions/changelog;  
- ==npm run release== creates Git tags only;  
- nothing is published to npm;  
- release commands should be run only from a reviewed, clean release branch or release pull request.  
  
### 8. Add validation for Changesets configuration  
  
Add a lightweight non-destructive validation script or test that confirms:  
  
- the package name is ==nodedent==;  
- the package version remains ==0.1.0==;
- the package remains private;  
- ==.changeset/config.json== exists;  
- private package versioning is enabled;  
- private package tagging is enabled;  
- the Changesets base branch is ==main==;  
- exactly one pending Changeset exists, excluding ==.changeset/README.md==;
- that pending Changeset references =="nodedent": minor==.
  
Prefer a small Node script such as:  
  
```
scripts/check-versioning.mjs

```
  
  
Add a package script:  
  
```
"versioning:check": "node scripts/check-versioning.mjs"

```
  
  
The script should return a non-zero exit code with actionable error messages when validation fails.  
  
Do not make this validation depend on network access.  
  
### 9. Preserve existing scripts and behavior  
  
Do not remove or weaken existing scripts such as:  
  
```
build
test
typecheck
docs:check
docs:workflow-graph

```
  
  
Do not modify clinical tests except where package renaming or versioning documentation requires it.  

### 10. Complete the spec-document lifecycle

This file is a tracked active implementation spec. After all acceptance criteria are satisfied:

- move ==docs/specs/Implement-Changesets.md== to ==docs/specs/archive/Implement-Changesets.md==;
- change its frontmatter status to ==implemented==;
- preserve ==created_on: 2026-07-20== and add the actual ==completed_on== date in ==YYYY-MM-DD== format;
- update ==docs/README.md== so the spec moves from Active Product And Implementation Specs to Archived Implemented Specs; and
- run ==npm run docs:check== after the move.
  
## Validation  
  
Run all relevant non-destructive checks:  
  
```
npm install
npm run versioning:check
npm run typecheck
npm test
npm run build
npm run docs:check

```
  
  
If ==npm install== changes the lockfile, include the lockfile changes.  
  
Also run:  
  
```
npx changeset status

```
  
  
Confirm that it reports one pending minor Changeset for ==nodedent==.  
  
Do not run:  
  
```
npm run version
npm run release
changeset version
changeset tag

```
  
  
because those would consume the retrospective Changeset or create release tags.  
  
## Acceptance criteria  
   
The task is complete when:  
  
- ==package.json== uses =="name": "nodedent"==.  
- The package remains private.  
- ==@changesets/cli== is installed as a development dependency.  
- ==.changeset/config.json== is configured for private application versioning and tagging.  
- A historical, non-versioned retrospective section exists in ==CHANGELOG.md==.  
- Exactly one catch-up Changeset is pending for a minor release of ==nodedent==.  
- The current package version remains ==0.1.0==.  
- Running ==changeset version== later would produce ==0.2.0==.  
- Workflow versions remain unchanged.  
- Persisted-data schemas remain unchanged.  
- ==docs/versioning.md== explains application, workflow, and schema versions.  
- ==docs/versioning.md== is linked from ==docs/README.md==.
- The bump and contributor policies are documented.  
- This implementation spec is archived with completed lifecycle metadata and its ==docs/README.md== entry is updated.
- ==npm run versioning:check== passes.  
- Existing typechecks, tests, builds, and documentation checks pass.  
- No Git tags, GitHub releases, commits, pushes, or npm publications are created.  
  
## Final response  
  
Report:  
  
1. Files added or changed.  
2. The package and Changesets configuration.  
3. The pending Changeset filename and intended bump.  
4. Validation commands and results.  
5. Any existing failures that were unrelated to this task.  
6. Confirmation that the package remains at ==0.1.0== and the catch-up Changeset was not consumed.  
