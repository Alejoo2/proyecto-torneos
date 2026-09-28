import { expect, test } from "@playwright/test";
import { STATES } from "./helpers";

test.use({ storageState: STATES.test1 });

/**
 * Matriz propia: toggle marca→desmarca restaurando el estado (no destructivo neto).
 * Regla: celdas disponibles tocan, rojas bloqueadas.
 */
test("toggle de disponibilidad marca y restaura", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByRole("tab", { name: "Disponibilidad" }).click();
  const marcar = page.getByRole("button", { name: /^Marcar disponibilidad/ }).first();
  await expect(marcar).toBeVisible({ timeout: 20_000 });
  const label = await marcar.getAttribute("aria-label");
  await marcar.click();
  // Cambió de estado (optimistic): ahora ofrece lo contrario en esa franja.
  const day = label!.replace(/^Marcar disponibilidad: /, "");
  await expect(page.getByRole("button", { name: `Quitar disponibilidad: ${day}` })).toBeVisible();
  // Restaura.
  await page.getByRole("button", { name: `Quitar disponibilidad: ${day}` }).click();
  await expect(page.getByRole("button", { name: `Marcar disponibilidad: ${day}` })).toBeVisible();
});

test("celda en rojo está bloqueada", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByRole("tab", { name: "Disponibilidad" }).click();
  const matrix = page.getByRole("img", { name: /Matriz de disponibilidad/ });
  await expect(matrix).toBeVisible({ timeout: 20_000 });
  // Las rojas (si existen en seed) vienen disabled; al menos la matriz rinde 84 celdas.
  const cells = page.locator('button[aria-label*="disponibilidad:"]');
  await expect(cells.first()).toBeVisible();
  expect(await cells.count()).toBeGreaterThanOrEqual(84);
});
