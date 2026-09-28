import { expect, test } from "@playwright/test";
import { findFreshMatch, STATES } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * Carga de resultado 1-0 end-to-end (wizard: score → stats → guardar).
 * DESTRUCTIVO: consume un partido fresco y recalcula stats/standings/bracket.
 * Re-seed después de correr.
 */
test("cargar resultado 1-0 con goleador asignado", async ({ page }) => {
  test.setTimeout(180_000);
  const found = await findFreshMatch(page);
  test.skip(!found, "Sin partidos frescos en el seed (re-seed y reintentar)");
  await page.goto(`/gestor/torneos/${found!.tournamentId}/partidos/${found!.matchId}`);

  // Paso 1: marcador. Regla sin-empates: el wizard bloquea el 0-0.
  await expect(page.getByRole("button", { name: "Confirmar resultado" })).toBeDisabled({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Goles local" }).fill("1");
  await page.getByRole("button", { name: "Confirmar resultado" }).click();
  await page.getByRole("button", { name: "Fijar marcador" }).click();
  await page.getByRole("button", { name: /Cargar estadísticas/ }).click();

  // Paso 2: asignar el gol a un jugador (abre equipo → abre jugador → suma → acepta).
  const teamAccordion = page.locator("button[aria-expanded]").filter({ hasText: /· \d+$/ }).first();
  await teamAccordion.click();
  const tiles = page.locator("div.mt-2 button[aria-expanded]");
  await tiles.first().waitFor({ timeout: 15_000 });
  await tiles.first().click();
  await page.getByRole("button", { name: /Sumar Goles|Sumar Autogol/ }).first().click();
  await page.getByRole("button", { name: "Aceptar" }).click();

  // Guardar (se habilita con goles reconciliados 1-0).
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Enviar plantilla" }).click();
  await expect(page.getByText("Resultado cargado")).toBeVisible({ timeout: 30_000 });
});

test("el empate se bloquea con aviso de penales", async ({ page }) => {
  test.setTimeout(180_000);
  const found = await findFreshMatch(page);
  test.skip(!found, "Sin partidos frescos en el seed (re-seed y reintentar)");
  await page.goto(`/gestor/torneos/${found!.tournamentId}/partidos/${found!.matchId}`);
  await expect(page.getByText("Sin empates: se define por penales")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Confirmar resultado" })).toBeDisabled();
});
