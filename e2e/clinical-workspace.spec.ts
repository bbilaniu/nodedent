import { readFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { chart, createCase, createVault, passphrase, returnToWorkspace } from "./helpers/workspace";

async function lock(page: Page) {
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  // A click does not await the handler's encrypted save; wait before navigating away.
  await expect(page.getByRole("heading", { name: "Unlock clinical vault", exact: true })).toBeVisible();
}

async function unlock(page: Page) {
  await page.getByLabel("Vault passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await page.getByRole("button", { name: "Continue case", exact: true }).click();
  await expect(page.getByText(`Chart: ${chart}`, { exact: true })).toBeVisible();
}

async function exportCase(page: Page, info: TestInfo, name: string) {
  if (!await page.getByRole("heading", { name: "Case Setup & Status", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
  }
  page.once("dialog", (dialog) => dialog.accept());
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plaintext NodeDent case JSON", exact: true }).click();
  const file = info.outputPath(name);
  await (await download).saveAs(file);
  return { file, data: JSON.parse(await readFile(file, "utf8")) };
}

test("vault creation, lock, wrong passphrase, and reload preserve the synthetic case", async ({ page }) => {
  await createCase(page);
  await returnToWorkspace(page);
  await lock(page);
  await page.getByLabel("Vault passphrase", { exact: true }).fill("incorrect-synthetic-passphrase");
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vault action needs attention");
  await expect(page.getByText(`Chart: ${chart}`, { exact: true })).toHaveCount(0);
  await unlock(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock clinical vault" })).toBeVisible();
  await unlock(page);
  await page.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
  await expect(page.getByLabel("Patient chart #", { exact: true })).toHaveValue(chart);
  await expect(page.getByLabel("Default tooth", { exact: true })).toHaveValue("36");
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(storage).not.toContain(chart);
  expect(storage).not.toContain(passphrase);
});

test("autosave persists an edit across reload without an explicit lock or export", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-07T12:00:00Z") });
  await createCase(page);
  await returnToWorkspace(page);
  const savedStatus = page.getByRole("status").filter({ hasText: /^Vault:/ });
  await page.clock.runFor(1_000);
  await expect(savedStatus).toContainText("Saved");
  const previousStatus = await savedStatus.textContent();
  await page.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
  await page.getByRole("textbox", { name: "Next visit / plan", exact: true }).fill("SYNTHETIC-AUTOSAVE-PLAN");
  await returnToWorkspace(page);
  // Advance the application's 500 ms debounce, then wait for real Web Crypto/IDB work.
  await page.clock.runFor(1_000);
  await expect(savedStatus).not.toHaveText(previousStatus!);
  await expect(savedStatus).toContainText("Saved");
  await page.reload();
  await unlock(page);
  await page.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Next visit / plan", exact: true })).toHaveValue("SYNTHETIC-AUTOSAVE-PLAN");
});

test("closing discards a draft; recording appends exactly one administration that survives reload", async ({ page }, info) => {
  await createCase(page);
  await page.getByRole("button", { name: "Open embedded anesthesia workflow", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Anesthesia", exact: true });
  await dialog.getByLabel("Agent", { exact: true }).fill("SYNTHETIC-DISCARDED-AGENT");
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Open anesthesia workflow", exact: true }).click();
  await expect(dialog.getByText("No anesthesia administrations recorded yet.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Agent", { exact: true })).toHaveValue("");
  await dialog.getByLabel("Agent", { exact: true }).fill("SYNTHETIC-RECORDED-AGENT");
  await dialog.getByRole("button", { name: /^Record anesthesia injection/ }).click();
  await expect(dialog.getByText("Administration #1", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Administration #2", { exact: true })).toHaveCount(0);
  // After a committed entry, dismissal must not ask to discard it.
  const confirmations: string[] = [];
  page.on("dialog", async (confirmation) => { confirmations.push(confirmation.message()); await confirmation.dismiss(); });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(confirmations).toEqual([]);
  page.removeAllListeners("dialog");
  const exported = await exportCase(page, info, "recorded-case.json");
  const administrations = exported.data.events.filter((event: { type: string }) => event.type === "anesthesia.administered");
  expect(administrations).toHaveLength(1);
  expect(JSON.stringify(exported.data)).not.toContain("SYNTHETIC-DISCARDED-AGENT");
  await returnToWorkspace(page);
  await lock(page);
  await page.reload();
  await unlock(page);
  await page.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
  const reopened = await exportCase(page, info, "reloaded-case.json");
  expect(reopened.data.events).toEqual(exported.data.events);
});

test("plaintext case export imports into a fresh vault and rejects invalid JSON", async ({ page, browser }, info) => {
  await createCase(page);
  await page.getByRole("button", { name: "Open embedded anesthesia workflow", exact: true }).click();
  const shared = page.getByRole("dialog", { name: "Anesthesia", exact: true });
  await shared.getByLabel("Agent", { exact: true }).fill("SYNTHETIC-TRANSFER-AGENT");
  await shared.getByRole("button", { name: /^Record anesthesia injection/ }).click();
  await expect(shared.getByText("Administration #1", { exact: true })).toBeVisible();
  await shared.getByRole("button", { name: "Close", exact: true }).click();
  const exported = await exportCase(page, info, "synthetic-case.json");
  expect(exported.data).toMatchObject({ exportKind: "nodedent-case", patientNumber: chart, tooth: "36" });
  expect(exported.data.events).toHaveLength(1);
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4175" });
  try {
    const importedPage = await context.newPage();
    await createVault(importedPage);
    await importedPage.getByRole("button", { name: "Import case", exact: true }).click();
    const library = importedPage.getByRole("dialog", { name: "Resume saved workflow", exact: true });
    await library.getByLabel("Or paste case JSON", { exact: true }).fill("{invalid synthetic JSON");
    await library.getByRole("button", { name: "Resume imported workflow", exact: true }).click();
    await expect(library).toBeVisible();
    await expect(library.getByRole("alert")).toContainText("Cannot import case");
    await library.getByLabel("NodeDent case JSON file", { exact: true }).setInputFiles(exported.file);
    await expect(library.getByRole("textbox", { name: "Or paste case JSON", exact: true })).toHaveValue(/"nodedent-case"/);
    await library.getByRole("button", { name: "Resume imported workflow", exact: true }).click();
    await expect(library).toHaveCount(0);
    await importedPage.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
    await expect(importedPage.getByLabel("Patient chart #", { exact: true })).toHaveValue(chart);
    const roundTrip = await exportCase(importedPage, info, "imported-case.json");
    // A first-time import receives a new local encounter ID by design.
    expect(roundTrip.data.encounterId).not.toBe(exported.data.encounterId);
    expect(roundTrip.data.events).toEqual(exported.data.events);
    expect(roundTrip.data.workflowInstances).toEqual(exported.data.workflowInstances);
  } finally {
    await context.close();
  }
});

test("encrypted vault download restores into an empty browser profile", async ({ page, browser }, info) => {
  await createCase(page);
  await returnToWorkspace(page);
  // Lock flushes the current case before the backup is downloaded from the entry screen.
  await lock(page);
  await page.getByLabel("Vault passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download vault", exact: true }).click();
  const backupPath = info.outputPath("synthetic-vault.nodedent");
  await (await download).saveAs(backupPath);
  const backupText = await readFile(backupPath, "utf8");
  expect(JSON.parse(backupText).exportKind).toBe("nodedent-encrypted-vault-backup");
  expect(backupText).not.toContain(chart);
  expect(backupText).not.toContain(passphrase);
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4175" });
  try {
    const restoredPage = await context.newPage();
    await restoredPage.goto("/");
    await restoredPage.getByLabel("Encrypted backup file", { exact: true }).setInputFiles(backupPath);
    await restoredPage.getByLabel("Backup passphrase", { exact: true }).fill(passphrase);
    await restoredPage.getByRole("button", { name: "Restore encrypted backup", exact: true }).click();
    await restoredPage.getByRole("button", { name: "Continue case", exact: true }).click();
    await expect(restoredPage.getByText(`Chart: ${chart}`, { exact: true })).toBeVisible();
    await restoredPage.getByRole("button", { name: "Case Setup & Status", exact: true }).click();
    await expect(restoredPage.getByLabel("Default tooth", { exact: true })).toHaveValue("36");
  } finally {
    await context.close();
  }
});
