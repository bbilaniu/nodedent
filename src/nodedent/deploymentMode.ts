export type DeploymentMode = "current" | "beta" | "sandbox";

export type SandboxKind = "development" | "historical";

export type DeploymentIdentity = Readonly<{
  mode: DeploymentMode;
  branch: string;
  commitSha: string;
  expectedOrigin?: string;
  sandboxKind?: SandboxKind;
}>;

export type DeploymentBuildInput = {
  requestedMode?: string;
  branch?: string;
  commitSha?: string;
  expectedOrigin?: string;
};

const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function requireClinicalOrigin(value: string | undefined, mode: "current" | "beta") {
  const candidate = clean(value);
  if (!candidate) throw new Error(`${mode} deployment requires NODEDENT_DEPLOYMENT_ORIGIN`);

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${mode} deployment origin must be a valid URL`);
  }

  if (url.protocol !== "https:" || url.origin !== candidate.replace(/\/$/, "")) {
    throw new Error(`${mode} deployment origin must be an HTTPS origin without a path`);
  }
  return url.origin;
}

function requireCommit(value: string | undefined, mode: "current" | "beta") {
  const commitSha = clean(value);
  if (!commitSha || !COMMIT_PATTERN.test(commitSha)) {
    throw new Error(`${mode} deployment requires a hexadecimal source commit of at least 7 characters`);
  }
  return commitSha;
}

export function resolveDeploymentIdentity(input: DeploymentBuildInput): DeploymentIdentity {
  const requestedMode = clean(input.requestedMode)?.toLowerCase();
  const branch = clean(input.branch) ?? "unknown";
  const commitSha = clean(input.commitSha) ?? "unknown";

  if (requestedMode === "current") {
    if (branch !== "main") throw new Error("current deployment mode requires the main branch");
    return Object.freeze({
      mode: "current",
      branch,
      commitSha: requireCommit(input.commitSha, "current"),
      expectedOrigin: requireClinicalOrigin(input.expectedOrigin, "current"),
    });
  }

  if (requestedMode === "beta") {
    if (branch !== "beta") throw new Error("beta deployment mode requires the beta branch");
    return Object.freeze({
      mode: "beta",
      branch,
      commitSha: requireCommit(input.commitSha, "beta"),
      expectedOrigin: requireClinicalOrigin(input.expectedOrigin, "beta"),
    });
  }

  return Object.freeze({
    mode: "sandbox",
    branch,
    commitSha,
    sandboxKind: branch.startsWith("archive/") ? "historical" : "development",
  });
}

export function deploymentOriginMatches(identity: DeploymentIdentity, actualOrigin: string) {
  if (identity.mode === "sandbox") return true;
  return identity.expectedOrigin === actualOrigin;
}

export function deploymentModeLabel(identity: DeploymentIdentity) {
  if (identity.mode === "current") return "Current";
  if (identity.mode === "beta") return "Beta";
  return identity.sandboxKind === "historical" ? "Historical sandbox" : "Development sandbox";
}

const fallbackIdentity = resolveDeploymentIdentity({});

export const deploymentIdentity: DeploymentIdentity = Object.freeze(
  typeof __NODEDENT_DEPLOYMENT_IDENTITY__ === "undefined"
    ? fallbackIdentity
    : __NODEDENT_DEPLOYMENT_IDENTITY__,
);
