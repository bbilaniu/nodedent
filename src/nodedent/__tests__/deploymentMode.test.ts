import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeploymentModeBanner } from "../components/DeploymentModeBanner";
import { DeploymentConfigurationError } from "../components/DeploymentConfigurationError";
import { SandboxDataWarning } from "../components/SandboxDataWarning";
import { AppFooter } from "../components/AppFooter";
import {
  deploymentBuildInputFromEnvironment,
  deploymentOriginMatches,
  resolveDeploymentIdentity,
  type DeploymentIdentity,
} from "../deploymentMode";

const httpsOrigin = (host: string) => `https:${"//"}${host}`;

const currentInput = {
  requestedMode: "current",
  branch: "main",
  commitSha: "1234567890abcdef",
  expectedOrigin: httpsOrigin("nodedent.example"),
};

test("resolves exact Current and Beta build identities", () => {
  assert.deepEqual(resolveDeploymentIdentity(currentInput), {
    mode: "current",
    branch: "main",
    commitSha: "1234567890abcdef",
    expectedOrigin: httpsOrigin("nodedent.example"),
  });
  assert.deepEqual(resolveDeploymentIdentity({
    requestedMode: "beta",
    branch: "beta",
    commitSha: "abcdef1234567890",
    expectedOrigin: httpsOrigin("beta.nodedent.example"),
  }), {
    mode: "beta",
    branch: "beta",
    commitSha: "abcdef1234567890",
    expectedOrigin: httpsOrigin("beta.nodedent.example"),
  });
});

test("build metadata prefers explicit values and supports Workers, Pages, and GitHub CI fallbacks", () => {
  assert.deepEqual(deploymentBuildInputFromEnvironment({
    NODEDENT_DEPLOYMENT_MODE: "beta",
    NODEDENT_DEPLOYMENT_BRANCH: "explicit-branch",
    NODEDENT_DEPLOYMENT_COMMIT: "explicit-commit",
    NODEDENT_DEPLOYMENT_ORIGIN: httpsOrigin("beta.example"),
    WORKERS_CI_BRANCH: "workers-branch",
    WORKERS_CI_COMMIT_SHA: "workers-commit",
    CF_PAGES_BRANCH: "pages-branch",
    CF_PAGES_COMMIT_SHA: "pages-commit",
    GITHUB_REF_NAME: "github-branch",
    GITHUB_SHA: "github-commit",
  }), {
    requestedMode: "beta",
    branch: "explicit-branch",
    commitSha: "explicit-commit",
    expectedOrigin: httpsOrigin("beta.example"),
  });

  assert.deepEqual(deploymentBuildInputFromEnvironment({
    WORKERS_CI_BRANCH: "beta",
    WORKERS_CI_COMMIT_SHA: "workers-commit",
    CF_PAGES_BRANCH: "pages-branch",
    CF_PAGES_COMMIT_SHA: "pages-commit",
    GITHUB_REF_NAME: "github-branch",
    GITHUB_SHA: "github-commit",
  }), {
    requestedMode: undefined,
    branch: "beta",
    commitSha: "workers-commit",
    expectedOrigin: undefined,
  });

  assert.deepEqual(deploymentBuildInputFromEnvironment({
    CF_PAGES_BRANCH: "pages-branch",
    CF_PAGES_COMMIT_SHA: "pages-commit",
    GITHUB_REF_NAME: "github-branch",
    GITHUB_SHA: "github-commit",
  }), {
    requestedMode: undefined,
    branch: "pages-branch",
    commitSha: "pages-commit",
    expectedOrigin: undefined,
  });

  assert.deepEqual(deploymentBuildInputFromEnvironment({
    GITHUB_REF_NAME: "github-branch",
    GITHUB_SHA: "github-commit",
  }), {
    requestedMode: undefined,
    branch: "github-branch",
    commitSha: "github-commit",
    expectedOrigin: undefined,
  });
});

test("rejects missing or contradictory privileged deployment metadata", () => {
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, branch: "beta" }), /main branch/);
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, commitSha: undefined }), /source commit/);
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, expectedOrigin: undefined }), /ORIGIN/);
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, expectedOrigin: `http:${"//"}nodedent.example` }), /HTTPS origin/);
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, expectedOrigin: `${httpsOrigin("nodedent.example")}/path` }), /without a path/);
  assert.throws(() => resolveDeploymentIdentity({ ...currentInput, requestedMode: "beta" }), /beta branch/);
});

test("unknown, absent, feature, and forged mode values fail safely to development Sandbox", () => {
  for (const input of [
    {},
    { requestedMode: "production", branch: "main" },
    { requestedMode: "sandbox", branch: "codex/example", commitSha: "not-required" },
    { requestedMode: "CURRENT?mode=beta", branch: "main" },
  ]) {
    const identity = resolveDeploymentIdentity(input);
    assert.equal(identity.mode, "sandbox");
    assert.equal(identity.sandboxKind, "development");
  }
});

test("archive branches resolve to historical Sandbox", () => {
  assert.deepEqual(resolveDeploymentIdentity({ branch: "archive/v2.2.1", commitSha: "abcdef1" }), {
    mode: "sandbox",
    branch: "archive/v2.2.1",
    commitSha: "abcdef1",
    sandboxKind: "historical",
  });
});

test("Current and Beta allow only their exact built origin while Sandbox remains interactive", () => {
  const current = resolveDeploymentIdentity(currentInput);
  assert.equal(deploymentOriginMatches(current, httpsOrigin("nodedent.example")), true);
  assert.equal(deploymentOriginMatches(current, httpsOrigin("preview.nodedent.example")), false);
  assert.equal(deploymentOriginMatches(resolveDeploymentIdentity({ branch: "feature/test" }), httpsOrigin("any.example")), true);
});

test("mode indicators use explicit text and Sandbox warnings disappear from clinical-capable modes", () => {
  const beta: DeploymentIdentity = {
    mode: "beta",
    branch: "beta",
    commitSha: "abcdef1",
    expectedOrigin: httpsOrigin("beta.example"),
  };
  const historical: DeploymentIdentity = {
    mode: "sandbox",
    branch: "archive/v2.2.1",
    commitSha: "abcdef1",
    sandboxKind: "historical",
  };
  const current: DeploymentIdentity = {
    mode: "current",
    branch: "main",
    commitSha: "abcdef1",
    expectedOrigin: httpsOrigin("current.example"),
  };

  assert.match(renderToStaticMarkup(React.createElement(DeploymentModeBanner, { identity: beta })), /Beta — pre-release clinical workspace/);
  assert.match(renderToStaticMarkup(React.createElement(DeploymentModeBanner, { identity: historical })), /Historical sandbox — synthetic data only/);
  assert.equal(renderToStaticMarkup(React.createElement(DeploymentModeBanner, { identity: current })), "");
  assert.match(renderToStaticMarkup(React.createElement(SandboxDataWarning, { identity: historical })), /Do not enter or import real patient or clinic data/);
  assert.equal(renderToStaticMarkup(React.createElement(SandboxDataWarning, { identity: beta })), "");

  const footer = renderToStaticMarkup(React.createElement(AppFooter, { identity: beta }));
  assert.match(footer, />Beta</);
  assert.match(footer, /aria-label="Source commit abcdef1"/);
  assert.match(footer, />abcdef1</);

  const configurationError = renderToStaticMarkup(React.createElement(DeploymentConfigurationError));
  assert.match(configurationError, /Vault access blocked/);
  assert.match(configurationError, /No protected vault was opened/);
});
