import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { expireDependabotIgnores, findExpiryMarkers } from "../expire-dependabot-ignores.mjs";

const permanent = `      # Coordinate this migration separately.
      - dependency-name: "@changesets/cli"
        update-types: [version-update:semver-major]
`;
const temporary = `      # ignore-until: 2026-10-28
      - dependency-name: "@types/node"
        versions: ["^26.0.0"]
`;
const future = `      # ignore-until: 2027-01-01
      - dependency-name: example
        versions:
          - "^2.0.0"
`;
const config = (entries: string) => `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    target-branch: beta
    schedule:
      interval: weekly
    ignore:
${entries}    open-pull-requests-limit: 5
`;

test("expiry preserves formatting and every rule before the UTC date", async () => {
  const source = config(permanent + temporary + future);
  assert.deepEqual(await expireDependabotIgnores(source, "2026-10-27"), { text: source, expired: [] });
  assert.equal(findExpiryMarkers(source, "2026-10-27").some(({ expired }) => expired), false);
});

for (const today of ["2026-10-28", "2026-10-29"]) {
  test(`expiry removes only the due entry on ${today} and is idempotent`, async () => {
    const result = await expireDependabotIgnores(config(permanent + temporary + future), today);
    assert.equal(result.text, config(permanent + future));
    assert.deepEqual(result.expired, [{ dependency: "@types/node", ecosystem: "npm", date: "2026-10-28" }]);
    assert.deepEqual(await expireDependabotIgnores(result.text, today), { text: result.text, expired: [] });
  });
}

test("expiry preserves CRLF and comments belonging to adjacent rules", async () => {
  const result = await expireDependabotIgnores(config(temporary + permanent).replaceAll("\n", "\r\n"), "2026-10-28");
  assert.equal(result.text, config(permanent).replaceAll("\n", "\r\n"));
});

test("expiry removes an emptied ignore key, preserving Beta and other settings", async () => {
  const result = await expireDependabotIgnores(config(temporary), "2026-10-28");
  assert.equal(result.text, config("").replace("    ignore:\n", ""));
  const update = parse(result.text).updates[0];
  assert.equal("ignore" in update, false);
  assert.equal(update["target-branch"], "beta");
  assert.equal(update["open-pull-requests-limit"], 5);
});

test("expiry handles multiple ecosystems and an entry ending at EOF", async () => {
  const source = config(temporary) + config(temporary)
    .replace("version: 2\nupdates:\n", "")
    .replace("npm", "github-actions")
    .replace("@types/node", "example/action")
    .replace("    open-pull-requests-limit: 5\n", "")
    .trimEnd();
  const result = await expireDependabotIgnores(source, "2026-10-28");
  assert.deepEqual(result.expired.map(({ ecosystem }) => ecosystem), ["npm", "github-actions"]);
  assert.ok(parse(result.text).updates.every((update: object) => !("ignore" in update)));
});

test("expiry rejects invalid dates and accepts leap days", async () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-2-01", "tomorrow"]) {
    assert.throws(() => findExpiryMarkers(config(temporary.replace("2026-10-28", date)), "2026-10-28"));
  }
  assert.throws(() => findExpiryMarkers(config(temporary), "2026-02-29"));
  assert.equal((await expireDependabotIgnores(config(temporary.replace("2026-10-28", "2028-02-29")), "2028-02-29")).expired.length, 1);
});

test("expiry refuses malformed, misplaced, ambiguous, or anchored annotations", async () => {
  for (const source of [
    config(temporary).replace("    ignore:", "    allow:"),
    config(temporary).replace("      - dependency", "        - dependency"),
    config(temporary).replace("      - dependency", "\n      - dependency"),
    config(temporary).replace("      - dependency", "      # ignore-until: 2026-11-01\n      - dependency"),
    config(temporary).replace('versions: ["^26.0.0"]', "versions: ["),
    config(temporary).replace("versions:", "dependency-name: duplicate\n        versions:"),
    config(temporary).replace('dependency-name: "@types/node"', 'dependency-name: &name "@types/node"').replace('versions: ["^26.0.0"]', 'versions: ["^26.0.0"]\n    labels: [*name]'),
  ]) {
    await assert.rejects(() => expireDependabotIgnores(source, "2026-10-28"));
  }
});

test("checked-in expiry preserves settings and supports removed or extended holds", async () => {
  const source = readFileSync(".github/dependabot.yml", "utf8");
  assert.equal((await expireDependabotIgnores(source, "1900-01-01")).text, source);
  const result = await expireDependabotIgnores(source, "2026-10-28");
  const expected = parse(source);
  // Removal PRs and reviewed extensions must pass without changing this test.
  assert.equal(result.expired.length, findExpiryMarkers(source, "2026-10-28").filter(({ expired }) => expired).length);
  for (const entry of result.expired) {
    const update = expected.updates.find((update: Record<string, unknown>) => update["package-ecosystem"] === entry.ecosystem);
    update.ignore = update.ignore.filter((rule: Record<string, unknown>) => rule["dependency-name"] !== entry.dependency);
    if (!update.ignore.length) delete update.ignore;
  }
  assert.deepEqual(parse(result.text), expected);
});

test("expiry CLI preflight and preview never edit; writes require full validation", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nodedent-expiry-"));
  try {
    const file = path.join(directory, "dependabot.yml");
    const output = path.join(directory, "output");
    const source = config(permanent + temporary);
    writeFileSync(file, source);
    const run = (mode: string, date = "2026-10-28") => execFileSync(process.execPath,
      ["scripts/expire-dependabot-ignores.mjs", mode, "--file", file, "--date", date],
      { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output }, stdio: "pipe" });
    run("--check", "2026-10-27");
    run("--check");
    assert.equal(readFileSync(output, "utf8"), "due=false\ndue=true\n");
    assert.equal(run("--preview"), config(permanent));
    assert.equal(readFileSync(file, "utf8"), source);
    run("--write");
    assert.equal(readFileSync(file, "utf8"), config(permanent));
    const invalid = config(temporary).replace("    ignore:", "    allow:");
    writeFileSync(file, invalid);
    assert.throws(() => run("--write"));
    assert.equal(readFileSync(file, "utf8"), invalid);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("expiry workflow only proposes a scoped default-branch PR", () => {
  const workflow = parse(readFileSync(".github/workflows/dependabot-expiry.yml", "utf8"));
  assert.deepEqual(Object.keys(workflow.on).sort(), ["schedule", "workflow_dispatch"]);
  assert.equal(workflow.on.schedule[0].cron, "37 8 * * *");
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs.review;
  assert.equal(job.if, "github.ref_name == github.event.repository.default_branch");
  assert.equal(job["timeout-minutes"], 5);
  assert.deepEqual(job.permissions, { contents: "write", "pull-requests": "write" });
  const checkout = job.steps.find((step: { uses?: string }) => step.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout.with["persist-credentials"], false);
  assert.equal(checkout.with.ref, "${{ github.event.repository.default_branch }}");
  const pr = job.steps.find((step: { uses?: string }) => step.uses?.startsWith("peter-evans/create-pull-request@"));
  assert.equal(pr.with.base, checkout.with.ref);
  assert.equal(pr.with["add-paths"], ".github/dependabot.yml");
  assert.equal(pr.with.branch, "automation/expired-dependabot-ignores");
  assert.equal(pr.if, undefined, "reconcile obsolete PRs even when no dates are due");
});
