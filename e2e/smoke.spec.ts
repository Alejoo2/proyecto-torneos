import { expect, test } from "@playwright/test";

/** Humo: vitrina anónima + shell logueado (sesión gestor del setup). */
test("vitrina /torneos lista y navega al detalle", async ({ page }) => {
  await page.goto("/torneos");
  await expect(page.getByRole("heading", { name: "Torneos" })).toBeVisible();
  const firstCard = page.locator('a[href^="/torneos/"]').first();
  await expect(firstCard).toBeVisible({ timeout: 20_000 });
  await firstCard.click();
  await expect(page).toHaveURL(/\/torneos\/.+/);
});

test("perfil del gestor carga con pestañas", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: /perfil/i }).first()).toBeVisible({
    timeout: 20_000,
  });
});
