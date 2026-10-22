import { expect, test } from "@playwright/test";

test("navigates to the recipe box and filters by category", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /dinner starts/i })).toBeVisible();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What can I cook?" })).toBeVisible();
  await page.getByRole("button", { name: "My kitchen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your kitchen starts here" })).toBeVisible();
  await page.getByRole("button", { name: "Add your first ingredient" }).click();
  await page.getByLabel("Ingredient").fill("Eggs");
  await page.getByLabel("Remaining amount").fill("4");
  await page.getByRole("button", { name: "Save ingredient" }).click();
  await expect(page.getByRole("row", { name: /Eggs/ })).toBeVisible();
  await expect(page.getByLabel("Remaining Eggs")).toHaveValue("4");
  await page.getByLabel("Remaining Eggs").fill("2");
  await expect(page.getByLabel("Remaining Eggs")).toHaveValue("2");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: "Breakfast" }).click();
  await expect(page.getByRole("heading", { name: "Berry overnight oats" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creamy Tuscan chicken" })).toHaveCount(0);
});

test("manual barcode fallback adds an unidentified product", async ({ page }) => {
  await page.route("**/api/products/12345670", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ found: false, barcode: "12345670" }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scan barcode" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Or enter a barcode").fill("12345670");
  await dialog.getByRole("button", { name: "Look up" }).click();
  await expect(dialog.getByText("We couldn’t find that barcode.")).toBeVisible();
  await dialog.getByLabel("Product name").fill("Local cooking oil");
  await dialog.getByLabel("Remaining amount").fill("650");
  await dialog.getByLabel("Remaining unit").selectOption("ml");
  await dialog.getByRole("button", { name: "Save to My Kitchen" }).click();
  await page.getByRole("button", { name: "My kitchen", exact: true }).click();
  await expect(page.getByText("Local cooking oil", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Remaining Local cooking oil")).toHaveValue("650");
});

test("camera permission errors leave manual barcode entry available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [{ kind: "videoinput", deviceId: "test-camera" }],
        getUserMedia: async () => { throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }); },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scan barcode" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Open camera" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Camera permission was denied");
  await expect(dialog.getByLabel("Or enter a barcode")).toBeVisible();
});

test("creates an account and signs in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create an account" }).click();
  await dialog.getByLabel("Your name").fill("Test Cook");
  await dialog.getByLabel("Email address").fill(`cookwhat-${Date.now()}@example.com`);
  await dialog.getByLabel("Password").fill("long-test-password");
  await dialog.getByRole("button", { name: "Create your account" }).click();
  await expect(page.getByRole("status")).toContainText("Your account is ready");
  await expect(page.getByRole("button", { name: "Test Cook" })).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "My kitchen", exact: true }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Ingredient").fill("Jasmine rice");
  await page.getByLabel("Remaining amount").fill("500");
  await page.getByLabel("Unit").selectOption("g");
  const kitchenSave = page.waitForResponse((response) =>
    response.url().endsWith("/api/kitchen") && response.request().method() === "PUT" && response.ok(),
  );
  await page.getByRole("button", { name: "Save ingredient" }).click();
  await kitchenSave;
  await page.evaluate(() => localStorage.removeItem("cookwhat-state"));
  await page.reload();
  await page.getByRole("button", { name: "My kitchen", exact: true }).click();
  await expect(page.getByText("Jasmine rice", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Remaining Jasmine rice")).toHaveValue("500");
});
