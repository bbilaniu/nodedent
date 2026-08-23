#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const applicationVersion = packageJson.version;

const directoryArgumentIndex = process.argv.indexOf("--dir");
const buildDirectory = directoryArgumentIndex >= 0
  ? path.resolve(process.argv[directoryArgumentIndex + 1] || "")
  : path.resolve("dist");
const indexPath = path.join(buildDirectory, "index.html");
const identityPath = path.join(buildDirectory, "deployment.json");
const headersPath = path.join(buildDirectory, "_headers");
const errors = [];

function requireFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${description} is missing at ${path.relative(process.cwd(), filePath)}.`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

const index = requireFile(indexPath, "Built index");
const identityText = requireFile(identityPath, "Deployment identity artifact");
let identity;
try {
  identity = JSON.parse(identityText);
} catch {
  errors.push("deployment.json is not valid JSON.");
}

const allowedModes = new Set(["current", "beta", "sandbox"]);
if (identity && !allowedModes.has(identity.mode)) errors.push(`Unsupported deployment mode ${JSON.stringify(identity.mode)}.`);

if (identity) {
  if (identity.applicationVersion !== applicationVersion) errors.push("deployment.json does not contain the package application version.");
  if (typeof identity.branch !== "string" || !identity.branch) errors.push("deployment.json is missing its source branch.");
  if (typeof identity.commitSha !== "string" || !identity.commitSha) errors.push("deployment.json is missing its source commit.");

  const expectedMode = process.env.NODEDENT_DEPLOYMENT_MODE?.trim().toLowerCase();
  const privilegedExpectedMode = expectedMode === "current" || expectedMode === "beta" ? expectedMode : "sandbox";
  if (identity.mode !== privilegedExpectedMode) errors.push(`Built mode ${identity.mode} does not match expected ${privilegedExpectedMode}.`);

  if (identity.mode === "current" && identity.branch !== "main") errors.push("Current artifact does not identify the main branch.");
  if (identity.mode === "beta" && identity.branch !== "beta") errors.push("Beta artifact does not identify the beta branch.");
  if (identity.mode !== "sandbox" && identity.expectedOrigin !== process.env.NODEDENT_DEPLOYMENT_ORIGIN?.replace(/\/$/, "")) {
    errors.push("Clinical-capable artifact does not contain the configured expected origin.");
  }
  if (identity.mode === "sandbox" && identity.expectedOrigin) errors.push("Sandbox artifact must not claim a privileged expected origin.");

  const expectedTitle = identity.mode === "current"
    ? "NodeDent"
    : identity.mode === "beta"
      ? "NodeDent Beta"
      : `NodeDent ${identity.sandboxKind === "historical" ? "Historical " : "Development "}Sandbox`;
  if (!index.includes(`<title>${expectedTitle}</title>`)) errors.push(`Built title does not identify ${expectedTitle}.`);
  for (const [name, value] of [
    ["nodedent-deployment-mode", identity.mode],
    ["nodedent-deployment-branch", identity.branch],
    ["nodedent-deployment-commit", identity.commitSha],
    ["nodedent-application-version", applicationVersion],
  ]) {
    if (!index.includes(`name="${name}"`) || !index.includes(`content="${value}"`)) {
      errors.push(`Built HTML is missing ${name}=${value}.`);
    }
  }

  const hasRobotsMeta = /<meta[^>]+name=["']robots["'][^>]+noindex[^>]+nofollow[^>]+noarchive/iu.test(index);
  if (identity.mode === "current" && hasRobotsMeta) errors.push("Current artifact must not inherit Sandbox search exclusion.");
  if (identity.mode !== "current" && !hasRobotsMeta) errors.push(`${identity.mode} artifact is missing search exclusion metadata.`);
  if (identity.mode === "current" && fs.existsSync(headersPath)) errors.push("Current artifact must not emit a search-exclusion _headers file.");
  if (identity.mode !== "current") {
    const headers = requireFile(headersPath, "Search-exclusion headers");
    if (!headers.includes("X-Robots-Tag: noindex, nofollow, noarchive")) errors.push("Search-exclusion headers are incomplete.");
  }
}

const deploymentSource = fs.readFileSync(path.resolve("src/nodedent/deploymentMode.ts"), "utf8");
if (!deploymentSource.includes("__NODEDENT_DEPLOYMENT_IDENTITY__")) errors.push("Runtime deployment identity is not sourced from the injected build constant.");
if (/location\.(?:search|hash)|localStorage|sessionStorage|indexedDB|document\.cookie/u.test(deploymentSource)) {
  errors.push("Deployment mode source must not use runtime URL, storage, or cookie values to select a mode.");
}

for (const requiredWarningSurface of [
  "src/nodedent/components/ClinicalVaultGate.tsx",
  "src/nodedent/components/CaseEntryGate.tsx",
  "src/nodedent/components/CaseManagementModal.tsx",
  "src/nodedent/components/BackupRecoveryPanel.tsx",
  "src/nodedent/components/PrivacyPolicyPage.tsx",
]) {
  if (!fs.readFileSync(path.resolve(requiredWarningSurface), "utf8").includes("SandboxDataWarning")) {
    errors.push(`${requiredWarningSurface} is missing the shared Sandbox clinical-data warning.`);
  }
}

for (const directory of ["src/nodedent/notes", "src/nodedent/schemas"]) {
  for (const entry of fs.readdirSync(path.resolve(directory), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:ts|tsx)$/u.test(entry.name)) continue;
    const filePath = path.join(entry.parentPath, entry.name);
    const source = fs.readFileSync(filePath, "utf8");
    if (/deploymentIdentity|NODEDENT_DEPLOYMENT|expectedOrigin|commitSha/u.test(source)) {
      errors.push(`${path.relative(process.cwd(), filePath)} places deployment metadata in a clinical note or schema boundary.`);
    }
  }
}

if (errors.length) {
  console.error("Deployment-mode check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Deployment-mode check passed for ${identity.mode} (${identity.branch}, ${identity.commitSha}).`);
}
