import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createCase, createVault, passphrase, returnToWorkspace } from "./helpers/workspace";

// Follow actual keyboard order without coupling assertions to every intervening control.
async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 100; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target, "Control must be reachable with Tab").toBeFocused();
}

async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  expect(await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  })).toBe(true);
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const profile of [
  { name: "desktop light", viewport: { width: 1280, height: 900 }, dark: false },
  { name: "narrow dark", viewport: { width: 390, height: 844 }, dark: true },
]) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });

    test.beforeEach(async ({ page }) => {
      if (profile.dark) {
        await page.goto("/");
        await tabTo(page, page.getByRole("button", { name: "Light mode", exact: true }));
        await page.keyboard.press("Space");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      }
    });

    test("vault creation, validation, lock and unlock work from the keyboard", async ({ page }) => {
      await page.goto("/");
      const password = page.getByLabel("Vault passphrase", { exact: true });
      const confirmation = page.getByLabel(/^Confirm passphrase/);
      const create = page.getByRole("button", { name: "Create empty protected vault", exact: true });
      await expect(password).toBeVisible();
      await scan(page);
      await tabTo(page, password);
      await page.keyboard.type(passphrase);
      await page.keyboard.press("Tab");
      await expect(confirmation).toBeFocused();
      await page.keyboard.type("synthetic-mismatch");
      await tabTo(page, create);
      await visibleFocus(create);
      await page.keyboard.press("Enter");
      await expect(confirmation).toHaveAttribute("aria-invalid", "true");
      await expect(confirmation).toHaveAccessibleDescription(/Passphrase confirmation does not match/);
      await scan(page);
      await tabTo(page, confirmation);
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type(passphrase);
      await tabTo(page, create);
      await page.keyboard.press("Space");
      await expect(page.getByRole("heading", { name: "Start a new case" })).toBeVisible();
      await tabTo(page, page.getByRole("button", { name: "Lock vault", exact: true }));
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Unlock clinical vault" })).toBeVisible();
      await tabTo(page, password);
      await page.keyboard.type("incorrect-synthetic-passphrase");
      const unlock = page.getByRole("button", { name: "Unlock vault", exact: true });
      await tabTo(page, unlock);
      await page.keyboard.press("Enter");
      await expect(password).toHaveAttribute("aria-invalid", "true");
      await expect(password).toHaveAccessibleDescription(/incorrect|damaged/);
      await scan(page);
      await tabTo(page, password);
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type(passphrase);
      await tabTo(page, unlock);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Start a new case" })).toBeVisible();
    });

    test("case import dialog exposes errors and restores keyboard focus", async ({ page }) => {
      await createVault(page);
      const launch = page.getByRole("button", { name: "Import case", exact: true });
      await tabTo(page, launch);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Resume saved workflow", exact: true });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      const input = dialog.getByRole("textbox", { name: "Or paste case JSON", exact: true });
      await tabTo(page, input);
      await page.keyboard.type("{invalid synthetic JSON");
      await tabTo(page, dialog.getByRole("button", { name: "Resume imported workflow", exact: true }));
      await page.keyboard.press("Enter");
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAccessibleDescription(/Cannot import case/);
      await scan(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(launch).toBeFocused();
      await expect(page.getByRole("contentinfo")).toBeVisible();
    });

    test("dialog traps focus and keyboard dismissal never records a draft", async ({ page }) => {
      await createCase(page);
      await returnToWorkspace(page);
      const launch = page.getByRole("button", { name: /^(Open anesthesia workflow|Assess anesthesia)$/ });
      await tabTo(page, launch);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Anesthesia", exact: true });
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeFocused();
      await visibleFocus(close);
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await expect(close).not.toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await scan(page);

      const agent = dialog.getByLabel("Agent", { exact: true });
      await tabTo(page, agent);
      await page.keyboard.type("SYNTHETIC-KEYBOARD-DRAFT");
      const cancelled = page.waitForEvent("dialog");
      page.once("dialog", (confirmation) => confirmation.dismiss());
      await page.keyboard.press("Escape");
      expect((await cancelled).type()).toBe("confirm");
      await expect(dialog).toBeVisible();
      await expect(agent).toBeFocused();
      const discarded = page.waitForEvent("dialog");
      page.once("dialog", (confirmation) => confirmation.accept());
      await tabTo(page, close);
      await page.keyboard.press("Enter");
      expect((await discarded).type()).toBe("confirm");
      await expect(dialog).toHaveCount(0);
      await expect(launch).toBeFocused();
      await expect(page.getByRole("contentinfo")).toBeVisible();

      await page.keyboard.press("Enter");
      await expect(close).toBeFocused();
      await expect(agent).toHaveValue("");
      await expect(dialog.getByText("No anesthesia administrations recorded yet.", { exact: true })).toBeVisible();
      await tabTo(page, agent);
      await page.keyboard.type("SYNTHETIC-KEYBOARD-RECORDED");
      const record = dialog.getByRole("button", { name: /^Record anesthesia injection/ });
      await tabTo(page, record);
      await visibleFocus(record);
      await page.keyboard.press("Space");
      await expect(dialog.getByText("Administration #1", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Administration #2", { exact: true })).toHaveCount(0);
      await scan(page);
      const unexpectedConfirmations: string[] = [];
      page.on("dialog", async (confirmation) => { unexpectedConfirmations.push(confirmation.type()); await confirmation.dismiss(); });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(unexpectedConfirmations).toEqual([]);
      await expect(launch).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog.getByText("Administration #1", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Administration #2", { exact: true })).toHaveCount(0);
    });
  });
}
