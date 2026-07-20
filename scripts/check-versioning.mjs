#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "package.json");
const PACKAGE_LOCK_PATH = path.join(ROOT, "package-lock.json");
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const CONFIG_PATH = path.join(CHANGESET_DIR, "config.json");
const CHANGESET_LEVELS = new Set(["patch", "minor", "major"]);
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const errors = [];

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${label} could not be read as JSON: ${error.message}`);
    return null;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function validatePackage(packageJson) {
  if (!packageJson) return;

  if (packageJson.name !== "nodedent") {
    errors.push(`package.json name must be "nodedent"; received ${JSON.stringify(packageJson.name)}.`);
  }
  if (typeof packageJson.version !== "string" || !SEMVER_PATTERN.test(packageJson.version)) {
    errors.push(`package.json version must be valid semantic versioning; received ${JSON.stringify(packageJson.version)}.`);
  }
  if (packageJson.private !== true) {
    errors.push('package.json must keep "private": true.');
  }
  if (!packageJson.devDependencies?.["@changesets/cli"]) {
    errors.push('package.json must include "@changesets/cli" in devDependencies.');
  }

  const requiredScripts = {
    changeset: "changeset",
    version: "changeset version",
    release: "changeset tag",
    "versioning:check": "node scripts/check-versioning.mjs",
  };
  for (const [name, command] of Object.entries(requiredScripts)) {
    if (packageJson.scripts?.[name] !== command) {
      errors.push(`package.json script ${JSON.stringify(name)} must be ${JSON.stringify(command)}.`);
    }
  }
}

function validatePackageLock(packageJson) {
  const packageLock = readJson(PACKAGE_LOCK_PATH, "package-lock.json");
  if (!packageJson || !packageLock) return;

  const rootPackage = packageLock.packages?.[""];
  if (packageLock.name !== packageJson.name || rootPackage?.name !== packageJson.name) {
    errors.push(`package-lock.json root package name must match package.json (${JSON.stringify(packageJson.name)}).`);
  }
  if (packageLock.version !== packageJson.version || rootPackage?.version !== packageJson.version) {
    errors.push(`package-lock.json root version must match package.json (${JSON.stringify(packageJson.version)}).`);
  }
}

function validateChangelog(packageJson) {
  if (!packageJson || typeof packageJson.version !== "string") return;
  if (!fs.existsSync(CHANGELOG_PATH)) {
    errors.push("CHANGELOG.md is missing.");
    return;
  }

  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const versionHeading = new RegExp(`^##\\s+${escapeRegExp(packageJson.version)}(?:\\s|$)`, "mu");
  if (!versionHeading.test(changelog)) {
    errors.push(`CHANGELOG.md must contain a level-two heading for the current application version ${packageJson.version}.`);
  }
}

function validateConfig(packageJson) {
  if (!fs.existsSync(CONFIG_PATH)) {
    errors.push(".changeset/config.json is missing.");
    return;
  }

  const config = readJson(CONFIG_PATH, ".changeset/config.json");
  if (!config) return;

  if (config.baseBranch !== "main") {
    errors.push(`Changesets baseBranch must be "main"; received ${JSON.stringify(config.baseBranch)}.`);
  }
  if (config.commit !== false) {
    errors.push("Changesets commit must remain false so generated release changes are reviewed explicitly.");
  }
  if (config.access !== "restricted") {
    errors.push(`Changesets access must be "restricted"; received ${JSON.stringify(config.access)}.`);
  }
  if (config.changelog !== "@changesets/cli/changelog") {
    errors.push(`Changesets changelog must be "@changesets/cli/changelog"; received ${JSON.stringify(config.changelog)}.`);
  }
  if (config.privatePackages?.version !== true) {
    errors.push("Changesets privatePackages.version must be true.");
  }
  if (config.privatePackages?.tag !== true) {
    errors.push("Changesets privatePackages.tag must be true.");
  }
  if (packageJson?.name && Array.isArray(config.ignore) && config.ignore.includes(packageJson.name)) {
    errors.push(`Changesets must not ignore the application package ${JSON.stringify(packageJson.name)}.`);
  }
}

function parseChangeset(file, packageName) {
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u);
  const label = path.relative(ROOT, file).split(path.sep).join("/");
  if (!match) {
    errors.push(`${label} must contain YAML frontmatter followed by a summary.`);
    return;
  }

  const entries = [];
  for (const rawLine of match[1].split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = line.match(/^"?([^":]+)"?\s*:\s*([a-z]+)$/u);
    if (!entry) {
      errors.push(`${label} contains an unsupported frontmatter line: ${JSON.stringify(rawLine)}.`);
      continue;
    }
    entries.push({ packageName: entry[1].trim(), level: entry[2] });
  }

  if (entries.length !== 1) {
    errors.push(`${label} must contain exactly one package bump entry for this single-package repository.`);
  }
  const [entry] = entries;
  if (entry && entry.packageName !== packageName) {
    errors.push(`${label} must target ${JSON.stringify(packageName)}; received ${JSON.stringify(entry.packageName)}.`);
  }
  if (entry && !CHANGESET_LEVELS.has(entry.level)) {
    errors.push(`${label} bump must be patch, minor, or major; received ${JSON.stringify(entry.level)}.`);
  }
  if (!match[2].trim()) {
    errors.push(`${label} must include a non-empty release summary.`);
  }
}

function validatePendingChangesets(packageJson) {
  if (!fs.existsSync(CHANGESET_DIR)) {
    errors.push(".changeset directory is missing.");
    return [];
  }

  const pendingChangesets = fs
    .readdirSync(CHANGESET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort();

  if (packageJson?.name) {
    for (const changesetName of pendingChangesets) {
      parseChangeset(path.join(CHANGESET_DIR, changesetName), packageJson.name);
    }
  }
  return pendingChangesets;
}

const packageJson = readJson(PACKAGE_PATH, "package.json");
validatePackage(packageJson);
validatePackageLock(packageJson);
validateChangelog(packageJson);
validateConfig(packageJson);
const pendingChangesets = validatePendingChangesets(packageJson);

if (errors.length > 0) {
  console.error("Versioning configuration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const pendingLabel = pendingChangesets.length === 0
    ? "no pending Changesets"
    : `${pendingChangesets.length} valid pending Changeset${pendingChangesets.length === 1 ? "" : "s"}`;
  console.log(`Versioning configuration check passed for ${packageJson.name}@${packageJson.version} with ${pendingLabel}.`);
}
