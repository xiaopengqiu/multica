import { test, expect } from "@playwright/test";
import { loginAsDefault, openWorkspaceMenu } from "./helpers";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefault(page);
  });

  test("sidebar navigation works", async ({ page }) => {
    // Click Inbox
    await page.locator("nav a", { hasText: "Inbox" }).click();
    await page.waitForURL("**/inbox");
    await expect(page).toHaveURL(/\/inbox/);

    // Click Agents
    await page.locator("nav a", { hasText: "Agents" }).click();
    await page.waitForURL("**/agents");
    await expect(page).toHaveURL(/\/agents/);

    // Click Issues
    await page.locator("nav a", { hasText: "Issues" }).click();
    await page.waitForURL("**/issues");
    await expect(page).toHaveURL(/\/issues/);
  });

  test("left sidebar collapses and restores from the page header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const sidebarGap = page.locator('[data-slot="sidebar-gap"]');
    const sidebarInset = page.locator('[data-slot="sidebar-inset"]');
    const trigger = sidebarInset.locator('[data-sidebar="trigger"]');
    await expect(trigger).toBeVisible();

    const initialGapWidth = await sidebarGap.evaluate((element) => element.getBoundingClientRect().width);
    const initialInsetWidth = await sidebarInset.evaluate((element) => element.getBoundingClientRect().width);
    expect(initialGapWidth).toBeGreaterThan(0);

    await trigger.click();

    await expect.poll(() => sidebarGap.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    await expect
      .poll(() => sidebarInset.evaluate((element) => element.getBoundingClientRect().width))
      .toBeGreaterThan(initialInsetWidth + initialGapWidth / 2);

    await trigger.click();

    await expect
      .poll(() => sidebarGap.evaluate((element) => element.getBoundingClientRect().width))
      .toBeGreaterThan(initialGapWidth - 2);
    await expect
      .poll(() => sidebarInset.evaluate((element) => element.getBoundingClientRect().width))
      .toBeLessThan(initialInsetWidth + 2);
  });

  test("settings page loads via workspace menu", async ({ page }) => {
    // Settings is inside the workspace dropdown menu
    await openWorkspaceMenu(page);
    await page.locator("text=Settings").click();
    await page.waitForURL("**/settings");

    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  });

  test("agents page shows agent list", async ({ page }) => {
    await page.locator("nav a", { hasText: "Agents" }).click();
    await page.waitForURL("**/agents");

    // Should show "Agents" heading
    await expect(page.locator("text=Agents").first()).toBeVisible();
  });
});
