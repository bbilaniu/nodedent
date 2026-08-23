#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const commitSha = "0123456789abcdef0123456789abcdef01234567";
const matrix = [
  { name: "current", mode: "current", branch: "main", origin: "https://current.example.invalid" },
  { name: "beta", mode: "beta", branch: "beta", origin: "https://beta.example.invalid" },
  { name: "development Sandbox", mode: "sandbox", branch: "feature/deployment-mode" },
  { name: "historical Sandbox", mode: "sandbox", branch: "archive/v2.2.1" },
];
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "nodedent-deployment-matrix-"));

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  for (const entry of matrix) {
    const outputDirectory = path.join(temporaryRoot, entry.name.replaceAll(" ", "-"));
    const environment = { ...process.env };
    environment.NODEDENT_DEPLOYMENT_MODE = entry.mode;
    environment.NODEDENT_DEPLOYMENT_BRANCH = entry.branch;
    environment.NODEDENT_DEPLOYMENT_COMMIT = commitSha;
    if (entry.origin) environment.NODEDENT_DEPLOYMENT_ORIGIN = entry.origin;
    else delete environment.NODEDENT_DEPLOYMENT_ORIGIN;

    console.log(`\nBuilding ${entry.name}…`);
    run("npm", ["run", "build", "--", "--outDir", outputDirectory], environment);
    run(process.execPath, ["scripts/check-deployment-mode.mjs", "--dir", outputDirectory], environment);
    run(process.execPath, ["scripts/check-clinical-security.mjs", "--dir", outputDirectory], environment);
  }
  console.log("\nDeployment build matrix passed.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
