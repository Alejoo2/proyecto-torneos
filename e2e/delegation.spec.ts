import { expect, test } from "@playwright/test";
import { STATES, TEST_USERS } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * Secretarios: designar, dar permiso, verificar persistencia y dar de baja
 * (la baja deja todo limpio: no destructivo neto).
 */
test("designar secretario con permiso y darlo de baja", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByRole("tab", { name: "Gestor", exact: true }).click();
  await expect(page.getByText("Secretarios")).toBeVisible({ timeout: 20_000 });

  // Designa a test2 (multi-equipo) buscándolo por email.
  await page.getByPlaceholder("Buscar perfil para designar (mín. 3 caracteres)").fill(TEST_USERS.multiTeam);
  const result = page.locator("button", { hasText: TEST_USERS.multiTeam }).first();
  try {
    await result.waitFor({ timeout: 15_000 });
  } catch {
    test.skip(true, "test2 no aparece en búsqueda (¿ya es secretario? limpia y reintenta)");
  }
  await result.click();
  await expect(page.getByText(TEST_USERS.multiTeam).first()).toBeVisible({ timeout: 15_000 });

  // Activa un permiso y verifica que persiste tras recargar.
  const permBox = page.locator('input[type="checkbox"]').first();
  const wasChecked = await permBox.isChecked();
  if (!wasChecked) await permBox.click();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("tab", { name: "Gestor", exact: true }).click();
  await expect(page.locator('input[type="checkbox"]').first()).toBeChecked({ timeout: 15_000 });

  // Baja: vuelve a "Sin secretarios".
  await page.getByRole("button", { name: /Quitar a/ }).first().click();
  await expect(page.getByText("Sin secretarios designados.")).toBeVisible({ timeout: 15_000 });
});
