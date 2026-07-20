#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "package.json");
const CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const errors = [];

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${label} could not be read as JSON: ${error.message}`);
    return null;
  }
}

const packageJson = readJson(PACKAGE_PATH, "package.json");

if (packageJson) {
  if (packageJson.name !== "nodedent") {
    errors.push(`package.json name must be "nodedent"; received ${JSON.stringify(packageJson.name)}.`);
  }
  if (packageJson.version !== "0.1.0") {
    errors.push(`package.json version must remain "0.1.0" while the catch-up Changeset is pending; received ${JSON.stringify(packageJson.version)}.`);
  }
  if (packageJson.private !== true) {
    errors.push('package.json must keep "private": true.');
  }
}

if (!fs.existsSync(CONFIG_PATH)) {
  errors.push(".changeset/config.json is missing.");
} else {
  const config = readJson(CONFIG_PATH, ".changeset/config.json");
  if (config) {
    if (config.baseBranch !== "main") {
      errors.push(`Changesets baseBranch must be "main"; received ${JSON.stringify(config.baseBranch)}.`);
    }
    if (config.privatePackages?.version !== true) {
      errors.push("Changesets privatePackages.version must be true.");
    }
    if (config.privatePackages?.tag !== true) {
      errors.push("Changesets privatePackages.tag must be true.");
    }
  }
}

let pendingChangesets = [];
if (!fs.existsSync(CHANGESET_DIR)) {
  errors.push(".changeset directory is missing.");
} else {
  pendingChangesets = fs
    .readdirSync(CHANGESET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort();
}

if (pendingChangesets.length !== 1) {
  errors.push(`Expected exactly one pending Changeset; found ${pendingChangesets.length}: ${pendingChangesets.join(", ") || "none"}.`);
} else {
  const changesetName = pendingChangesets[0];
  const changeset = fs.readFileSync(path.join(CHANGESET_DIR, changesetName), "utf8");
  const frontmatter = changeset.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1] ?? "";
  if (!/^"nodedent":\s*minor\s*$/mu.test(frontmatter)) {
    errors.push(`${changesetName} must contain the frontmatter entry '"nodedent": minor'.`);
  }
}

if (errors.length > 0) {
  console.error("Versioning configuration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Versioning configuration check passed with pending Changeset ${pendingChangesets[0]}.`);
}
