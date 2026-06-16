# AGENTS.md

## Repository Expectations

- Use `npm` for package scripts and dependency management; do not switch package managers.
- Keep changes scoped and consistent with the existing React, TypeScript, Vite, and documentation patterns.
- Prefer existing modules and helpers over introducing new abstractions.
- Do not edit clinical source material in `docs/source/` unless explicitly requested.
- Do not invent clinical guidance. When changing clinical workflow behavior, ground it in the source material, active specs, or ADRs.

## Verification

- Run `npm run build` for full verification after code or config changes.
- Run `npm test` when changing the workflow engine or other tested logic.
- Run `npm run docs:check` after documentation lifecycle or structure changes.
- Run `npm run docs:workflow-graph` after workflow/protocol graph changes that should update generated docs.

## Documentation Layout

- Keep active product and implementation specs in `docs/specs/`.
- Keep architectural decisions in `docs/adr/`.
- Keep clinical source material in `docs/source/`.
- Keep generated documentation in `docs/generated/`.
- Move implemented or historical specs to `docs/specs/archive/`.
- Update `docs/README.md` when adding or moving documentation that should be discoverable.
