import { expect, type Browser } from "@playwright/test";

export type SmokeTarget = { url: string; version: string; mode: "current" | "beta" | "sandbox"; branch: string; commit: string };

export function smokeTarget(environment: NodeJS.ProcessEnv): SmokeTarget {
  const url = new URL(environment.NODEDENT_SMOKE_URL || "");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Smoke URL must be an origin without credentials, path, query, or fragment.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Smoke URL requires HTTPS (HTTP is permitted only on loopback for local verification).");
  const version = environment.NODEDENT_SMOKE_VERSION || "";
  const mode = environment.NODEDENT_SMOKE_MODE || "";
  const branch = environment.NODEDENT_SMOKE_BRANCH || "";
  const commit = environment.NODEDENT_SMOKE_COMMIT || "";
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) throw new Error("An independent expected application version is required.");
  if (mode !== "current" && mode !== "beta" && mode !== "sandbox") throw new Error("An expected current, beta, or sandbox mode is required.");
  if (!branch || mode === "current" && branch !== "main" || mode === "beta" && branch !== "beta") throw new Error("Expected branch must agree with deployment mode.");
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)) throw new Error("An independent full expected commit SHA is required.");
  return { url: url.origin, version, mode, branch, commit };
}

export function isReadOnlySmokeRequest(url: string, method: string, origin: string) {
  return method === "GET" && new URL(url).origin === origin;
}

export function verifySmokeIdentity(identity: Record<string, unknown>, target: SmokeTarget) {
  for (const [field, expected] of Object.entries({ applicationVersion: target.version, mode: target.mode, branch: target.branch, commitSha: target.commit })) {
    if (identity[field] !== expected) throw new Error(`Deployed ${field} does not match the independently expected value.`);
  }
  if (target.mode !== "sandbox" && identity.expectedOrigin !== target.url) throw new Error("Deployed clinical origin does not match the smoke target.");
  if (target.mode === "sandbox" && identity.expectedOrigin) throw new Error("Sandbox must not claim a clinical origin.");
  if (target.mode === "sandbox" && identity.sandboxKind !== (target.branch.startsWith("archive/") ? "historical" : "development")) throw new Error("Sandbox kind does not match the expected branch.");
}

export async function checkDeployedSite(browser: Browser, target: SmokeTarget) {
  // Never reuse a clinic profile or accept saved credentials/storage from the caller.
  const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
  try {
    const metadata = await context.request.get(`${target.url}/deployment.json`, { timeout: 15_000, maxRedirects: 0 });
    expect(metadata.status(), "deployment.json must be available without redirect").toBe(200);
    verifySmokeIdentity(await metadata.json(), target);
    const failures: string[] = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (!isReadOnlySmokeRequest(request.url(), request.method(), target.url)) {
        failures.push("Blocked a non-GET or cross-origin browser request.");
        await route.abort();
        return;
      }
      try {
        // Do not follow redirects that could escape the same-origin GET boundary.
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 15_000 });
        if (response.status() >= 300) {
          failures.push(`Asset request failed or redirected: ${new URL(request.url()).pathname} (${response.status()}).`);
          await route.abort();
        } else {
          await route.fulfill({ response });
        }
      } catch {
        failures.push(`Asset request did not complete: ${new URL(request.url()).pathname}.`);
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", () => failures.push("Uncaught browser error."));
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      failures.push(`Browser resource failed: ${url.origin}${url.pathname} (${request.failure()?.errorText || "unknown error"}).`);
    });
    await page.goto(target.url, { waitUntil: "load", timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Create clinical vault", exact: true })).toBeVisible();
    await expect(page.getByLabel("Vault passphrase", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "Create empty protected vault", exact: true })).toBeDisabled();
    const footer = page.getByRole("contentinfo");
    const modeLabel = target.mode === "current" ? "Current" : target.mode === "beta" ? "Beta" : target.branch.startsWith("archive/") ? "Historical sandbox" : "Development sandbox";
    await expect(footer.getByText(modeLabel, { exact: true })).toBeVisible();
    await expect(footer.getByLabel(`NodeDent application version ${target.version}`, { exact: true })).toHaveText(`NodeDent v${target.version}`);
    await expect(footer.getByLabel(`Source commit ${target.commit}`, { exact: true })).toHaveText(target.commit.slice(0, 8));
    const title = target.mode === "current" ? "NodeDent" : target.mode === "beta" ? "NodeDent Beta" : `NodeDent ${target.branch.startsWith("archive/") ? "Historical" : "Development"} Sandbox`;
    await expect(page).toHaveTitle(title);
    for (const [key, value] of Object.entries({ "deployment-mode": target.mode, "deployment-branch": target.branch, "deployment-commit": target.commit, "application-version": target.version })) {
      await expect(page.locator(`meta[name="nodedent-${key}"]`)).toHaveAttribute("content", value);
    }
    expect(failures, "Smoke must load without browser errors or prohibited requests").toEqual([]);
    // No clicks, typing, vault creation/unlock, imports, exports, or clinical fixtures.
    return { ...target, result: "passed" };
  } finally {
    await context.close();
  }
}
