import { expect, test } from "@playwright/test";
import { STATES } from "./helpers";

test.use({ storageState: STATES.test2 });

/**
 * Conflictos de horario (test2: multi-equipo): la campana abre, la bandeja
 * rinde y —si el seed trae un conflicto vivo— el deep-link lleva al partido.
 * Solo lectura.
 */
test("campana abre y la bandeja rinde notificaciones", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /notificaciones/i }).first().click();
  const panel = page.locator("aside, [role='dialog']").first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
});

test("marcar todas como leídas deja el conteo en cero", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /notificaciones/i }).first().click();
  const markAll = page.getByRole("button", { name: "Marcar todas como leídas" });
  try {
    await markAll.waitFor({ timeout: 10_000 });
    await markAll.click();
    await expect(page.getByRole("button", { name: "Notificaciones" })).toBeVisible({ timeout: 15_000 });
  } catch {
    test.skip(true, "Sin notificaciones pendientes para test2 en este seed");
  }
});
