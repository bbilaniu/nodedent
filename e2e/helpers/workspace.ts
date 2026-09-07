import { expect, type Page } from "@playwright/test";

export const passphrase = "synthetic-vault-only-2026";
export const chart = "SYNTHETIC-E2E-001";

export async function createVault(page: Page) {
  await page.goto("/");
  await page.getByLabel("Vault passphrase", { exact: true }).fill(passphrase);
  await page.getByLabel(/^Confirm passphrase/).fill(passphrase);
  await page.getByRole("button", { name: "Create empty protected vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start a new case" })).toBeVisible();
}

export async function createCase(page: Page) {
  await createVault(page);
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Case Setup & Status", exact: true })).toBeVisible();
  await page.getByLabel("Patient chart #", { exact: true }).fill(chart);
  await page.getByLabel("Default tooth", { exact: true }).fill("36");
  const endodontics = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Endodontic RCT", exact: true }) });
  await endodontics.getByRole("button", { name: "Add to case", exact: true }).click();
}

export async function returnToWorkspace(page: Page) {
  await page.getByRole("button", { name: "Return to workspace", exact: true }).first().click();
  await expect(page.getByText(`Chart: ${chart}`, { exact: true })).toBeVisible();
}
