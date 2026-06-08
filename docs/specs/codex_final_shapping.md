Update the endodontic guide terminology so the final shaping step is not limited to `.04` taper systems.

Context:
The current protocol includes a step titled something like:

```text
Create final .04 shape
```

and decision options such as:

```text
.04 file reached shaping length
.04 file did not reach shaping length
```

This is too specific. The guide should support `.04` rotary cases, but also system-specific and variable-taper systems such as ProTaper Next, ProTaper Gold, WaveOne Gold, Reciproc, etc.

Goal:
Rename and generalize the final shaping step, related labels, validation messages, note fragments, and UI field labels so they support any final shaping file/system.

Required changes:

1. Rename the protocol step title

Change:

```text
Create final .04 shape
```

to:

```text
Complete final shaping
```

2. Update the chairside instruction

Replace `.04`-specific instruction text with system-flexible wording, for example:

```text
Select the final shaping file according to the canal anatomy, glide path, gauging result, and file system being used. Shape to the recorded shaping length. Record the final shaping file/system.
```

3. Rename decision options

Change:

```text
.04 file reached shaping length
.04 file did not reach shaping length
```

to:

```text
Final shaping file reached shaping length
Final shaping file did not reach shaping length
```

Keep the same transition behavior unless existing tests indicate a better node mapping.

4. Rename UI field label

Change the Measurements label:

```text
Final shape
```

to:

```text
Final shaping file
```

This field should accept either simple size/taper values or system-specific labels, for example:

```text
30/.04
PTN X2 25/.06
PTG F2 25/.08
WaveOne Gold Primary 25/.07
Reciproc R25
```

5. Relax final-shape validation if needed

If validation currently only accepts a strict size/taper format such as `30/.04`, update it so it also accepts system-based strings.

Suggested rule:

* Required when the user selects `Final shaping file reached shaping length`.
* Must be non-blank.
* Should accept:

  * `30/.04`
  * `25/.06`
  * `PTN X2 25/.06`
  * `PTG F2 25/.08`
  * `WaveOne Gold Primary 25/.07`
  * `Reciproc R25`

Do not over-validate brand/system names in this PR. A non-blank string is acceptable as long as tests cover common examples.

6. Update types/schemas if needed

If the schema or type name is currently `finalShape`, it can remain as the internal field name for compatibility, but comments, labels, and note output should describe it as the final shaping file.

If you decide to rename the internal field to `finalShapingFile`, preserve backward compatibility with existing saved JSON/imported cases by mapping old `finalShape` values into the new field or keeping `finalShape` as an alias.

Prefer the smallest safe change:

* UI label: `Final shaping file`
* Internal field: keep `finalShape` unless there is already a migration pattern.

7. Update note fragments/output

Where notes currently say:

```text
Final .04 shape achieved...
```

or similar, update to:

```text
Final shaping completed with [finalShapingFile/finalShape].
```

Examples:

```text
MB: Final shaping completed with 30/.04.
MB: Final shaping completed with PTN X2 25/.06.
```

8. Update tests

Add or update tests for:

```text
- Protocol node title is "Complete final shaping"
- Decision option label is "Final shaping file reached shaping length"
- Blank final shaping file blocks the successful final-shaping decision
- `30/.04` is accepted
- `PTN X2 25/.06` is accepted
- `PTG F2 25/.08` is accepted
- Full/compact note output includes the recorded final shaping file
```

9. Preserve behavior

Do not add new clinical workflow branches in this PR.

Do not change:

* Node IDs unless necessary
* Transition targets
* Canal status derivation
* Note output modes
* JSON import/export behavior
* Responsive layout

Acceptance criteria:

* The guide no longer implies final shaping must be `.04`.
* The workflow still functions exactly as before.
* The field clearly supports system-specific final shaping files.
* Existing saved cases with `finalShape` still work.
* Tests pass.
