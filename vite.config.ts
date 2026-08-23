import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { version as applicationVersion } from "./package.json";
import { resolveDeploymentIdentity, type DeploymentIdentity } from "./src/nodedent/deploymentMode";

function clinicalContentSecurityPolicy(command: "build" | "serve"): Plugin {
  const scriptSource = command === "serve" ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'";
  const styleSource = command === "serve" ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const connectSource = command === "serve" ? "connect-src 'self' ws: wss:" : "connect-src 'none'";
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    scriptSource,
    styleSource,
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    connectSource,
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    name: "nodedent-clinical-content-security-policy",
    transformIndexHtml: {
      order: "pre",
      handler: () => [{
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: policy },
        injectTo: "head-prepend",
      }],
    },
  };
}

function deploymentArtifact(identity: DeploymentIdentity): Plugin {
  const isSearchExcluded = identity.mode !== "current";
  const modeTitle = identity.mode === "beta"
    ? "NodeDent Beta"
    : identity.mode === "sandbox"
      ? `NodeDent ${identity.sandboxKind === "historical" ? "Historical " : "Development "}Sandbox`
      : "NodeDent";
  const publicIdentity = { ...identity, applicationVersion };

  return {
    name: "nodedent-deployment-artifact",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return {
          html: html.replace(/<title>[^<]*<\/title>/, `<title>${modeTitle}</title>`),
          tags: [
            { tag: "meta", attrs: { name: "nodedent-deployment-mode", content: identity.mode }, injectTo: "head" },
            { tag: "meta", attrs: { name: "nodedent-deployment-branch", content: identity.branch }, injectTo: "head" },
            { tag: "meta", attrs: { name: "nodedent-deployment-commit", content: identity.commitSha }, injectTo: "head" },
            { tag: "meta", attrs: { name: "nodedent-application-version", content: applicationVersion }, injectTo: "head" },
            ...(isSearchExcluded
              ? [{ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow, noarchive" }, injectTo: "head" as const }]
              : []),
          ],
        };
      },
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "deployment.json",
        source: `${JSON.stringify(publicIdentity, null, 2)}\n`,
      });
      if (isSearchExcluded) {
        this.emitFile({
          type: "asset",
          fileName: "_headers",
          source: "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n",
        });
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const loadedEnvironment = loadEnv(mode, process.cwd(), "");
  const environment = { ...loadedEnvironment, ...process.env };
  const identity = resolveDeploymentIdentity({
    requestedMode: environment.NODEDENT_DEPLOYMENT_MODE,
    branch: environment.NODEDENT_DEPLOYMENT_BRANCH ?? environment.CF_PAGES_BRANCH ?? environment.GITHUB_REF_NAME,
    commitSha: environment.NODEDENT_DEPLOYMENT_COMMIT ?? environment.CF_PAGES_COMMIT_SHA ?? environment.GITHUB_SHA,
    expectedOrigin: environment.NODEDENT_DEPLOYMENT_ORIGIN,
  });

  return {
    define: {
      __NODEDENT_DEPLOYMENT_IDENTITY__: JSON.stringify(identity),
    },
    plugins: [clinicalContentSecurityPolicy(command), deploymentArtifact(identity), react(), tailwindcss()],
  };
});
