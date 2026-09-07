import { execFileSync } from "node:child_process";
import { build, preview } from "vite";

// Build production assets for synthetic browser testing without overwriting dist/.
// Set these before Vite loads its config, including when called from release jobs.
process.env.NODEDENT_DEPLOYMENT_MODE = "sandbox";
process.env.NODEDENT_DEPLOYMENT_BRANCH = "e2e/synthetic";
process.env.NODEDENT_DEPLOYMENT_COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
delete process.env.NODEDENT_DEPLOYMENT_ORIGIN;

await build({ build: { outDir: ".e2e-dist" } });
const server = await preview({
  build: { outDir: ".e2e-dist" },
  preview: { host: "127.0.0.1", port: 4175, strictPort: true },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.httpServer.close(() => process.exit(0)));
}
