After those PRs, I would shift from **building the endodontic guide** to **hardening it into a reusable clinical decision-guide framework**.

Recommended sequence:

```text
1. Verify refactor PR
2. Disinfection + cone-fit workflow
3. Sealer + obturation completion workflow
4. Closure + post-op workflow
5. Multi-visit resume workflow
6. Clinical scenario regression fixtures
7. Generalize the guide engine
8. Add authoring/documentation tools
9. Start the next clinical guide
```

## PR 7 — Generalize the guide engine
 
```git
refactor(clinical-guides): generalize decision engine beyond endodontics
```

Scope:

```text
endo-guide/
  becomes one implementation of a broader guide framework

clinical-guides/
  engine/
  schemas/
  notes/
  components/
  shared/
```

Goal: make the engine reusable for other guides without copying endo-specific logic everywhere.

This PR should separate:

```text
Generic:
- protocol nodes
- decision options
- guards
- events
- note fragments
- phase maps
- validation engine
- continuation logic pattern

Endo-specific:
- canal records
- EAL / patency / shaping
- cone fit
- irrigation
- obturation
```

## PR 8 — Add protocol authoring helpers

```git
feat(clinical-guides): add protocol authoring utilities
```

Scope:

```text
- protocol node linting
- missing nextNodeId detection
- orphan node detection
- unreachable node detection
- required field validation checks
- event type consistency checks
- note-fragment coverage checks
```

This would help prevent future clinical guides from becoming fragile.

Example checks:

```text
Every nextNodeId exists
Every noteEvent has a note fragment or accepted fallback
Every guard references a valid field
Every terminal node is intentional
Every phase has at least one reachable node
```

## PR 9 — Improve clinical note templates

```git
feat(endo-guide): add configurable clinical note templates
```

Scope:

```text
- compact note
- full SOAP/procedure note
- specialist referral note
- patient summary
- next-visit note
- multi-visit continuation note
```

This is where you make the generated note truly chart-ready.

## PR 10 — Add print/export support

```git
feat(endo-guide): add print and export outputs
```

Scope:

```text
- printable chairside summary
- printable case summary
- markdown export
- structured JSON export
- copy-to-clipboard variants
```

I would still leave PDF export for later unless your app already has a markdown-to-PDF utility.

## PR 11 — Build the next guide using the same engine

The best next clinical guide would probably be **pulp diagnosis**, because it feeds naturally into the endodontic workflow.

```git
feat(pulp-guide): add pulp diagnosis decision guide
```

Scope:

```text
- chief complaint
- pain history
- cold test
- percussion
- palpation
- bite test
- probing
- radiographic findings
- pulpal diagnosis
- apical diagnosis
- recommended treatment
- note output
```

Then later:

```git
feat(operative-guide): add restorative procedure decision-note guide
feat(caries-guide): add caries risk and lesion management guide
feat(extraction-guide): add extraction workflow and note generator
```

## My preferred long-term order

```text
1. Finish endodontic guide end-to-end
2. Add scenario regression tests
3. Generalize the guide engine
4. Add protocol authoring/linting tools
5. Improve note templates
6. Add print/export outputs
7. Build pulp diagnosis guide
8. Build operative dentistry guide
9. Build caries management guide
10. Integrate guides together
```

The integration step is where it gets really powerful:

```text
Pulp diagnosis
→ recommends endodontic treatment
→ starts endodontic chairside guide
→ generates procedure note
→ generates next restoration recommendation
```

That would turn this from a single endo app into a broader DML clinical workflow system.
