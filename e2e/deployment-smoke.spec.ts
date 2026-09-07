import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import packageJson from "../package.json" with { type: "json" };
import { checkDeployedSite, smokeTarget } from "../scripts/lib/deployedSite";

test("read-only smoke verifies production-built identity in a fresh profile", async ({ browser }) => {
  const target = smokeTarget({
    NODEDENT_SMOKE_URL: "http://127.0.0.1:4175",
    NODEDENT_SMOKE_VERSION: packageJson.version,
    NODEDENT_SMOKE_MODE: "sandbox",
    NODEDENT_SMOKE_BRANCH: "e2e/synthetic",
    NODEDENT_SMOKE_COMMIT: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  });
  expect((await checkDeployedSite(browser, target)).result).toBe("passed");
  await expect(checkDeployedSite(browser, { ...target, commit: "0".repeat(40) })).rejects.toThrow("commitSha");
});
