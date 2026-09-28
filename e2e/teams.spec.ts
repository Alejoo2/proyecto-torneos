import { expect, test } from "@playwright/test";
import { loginAs, STATES } from "./helpers";

test.use({ storageState: STATES.test1 });

/** Regla capitanía única: test1 ya capitanea Alfa → crear se niega con mensaje. */
test("capitán activo no puede crear otro equipo", async ({ page }) => {
  await page.goto("/equipos");
  await page.getByRole("button", { name: "Crear equipo" }).first().click();
  await page.getByPlaceholder("Ej: Los Invencibles del Barrio").fill("E2E Bloqueado");
  await page.getByPlaceholder("Ej: LIB").fill("BLQ");
  await page.getByRole("button", { name: "Crear equipo", exact: true }).last().click();
  await expect(page.getByText("Ya eres capitán de otro equipo activo")).toBeVisible({ timeout: 15_000 });
});

/** Happy path con usuario fresco (el login-dev lo aprovisiona al instante). */
test("usuario nuevo crea equipo y abre su detalle", async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  await loginAs(page, `e2e${stamp}@test`);
  const name = `E2E FC ${stamp}`;
  await page.goto("/equipos");
  await page.getByRole("button", { name: "Crear equipo" }).first().click();
  await page.getByPlaceholder("Ej: Los Invencibles del Barrio").fill(name);
  await page.getByPlaceholder("Ej: LIB").fill(`E${stamp}`);
  await page.getByRole("button", { name: "Crear equipo", exact: true }).last().click();
  await page.waitForURL(/\/equipos\/.+/, { timeout: 20_000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
});

test("mis equipos listan y el detalle abre", async ({ page }) => {
  await page.goto("/equipos");
  const firstTeam = page.locator('a[href^="/equipos/"]').first();
  await expect(firstTeam).toBeVisible({ timeout: 20_000 });
  await firstTeam.click();
  await expect(page).toHaveURL(/\/equipos\/.+/);
});
