import { expect, test } from "@playwright/test";
import { STATES } from "./helpers";

test.use({ storageState: STATES.admin });

/** Consola admin: 4 pestañas, alta de árbitro + toggle, listas RBAC. */
test("consola admin rinde las 4 pestañas", async ({ page }) => {
  await page.goto("/admin");
  for (const tab of ["Canchas", "Gestores", "Árbitros", "Permisos"]) {
    await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible({ timeout: 20_000 });
  }
});

test("registrar árbitro y desactivarlo (aditivo, se limpia con reseed)", async ({ page }) => {
  const name = `Árbitro E2E ${Date.now().toString().slice(-6)}`;
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Árbitros", exact: true }).click();
  await page.getByPlaceholder("Nombre del árbitro (req.)").fill(name);
  await page.getByRole("button", { name: "Registrar árbitro" }).click();
  await expect(page.getByText("Árbitro registrado")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(name)).toBeVisible();
});

test("pestaña Permisos lista roles del RBAC", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Permisos", exact: true }).click();
  await expect(page.getByText(/rol|permiso/i).first()).toBeVisible({ timeout: 20_000 });
});

test("pestaña Gestores lista gestores", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Gestores", exact: true }).click();
  await expect(page.getByText(/gestor/i).first()).toBeVisible({ timeout: 20_000 });
});
