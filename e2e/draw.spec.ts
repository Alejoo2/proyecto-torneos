import { expect, test } from "@playwright/test";
import { openTournamentByName, STATES } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * Sorteo: cierra inscripciones y genera el bracket (Copa Test Flujo: 4 aprobados).
 * DESTRUCTIVO: crea fases y partidos. Re-seed después.
 */
test("sortear genera fixture y pone el torneo en curso", async ({ page }) => {
  const href = await openTournamentByName(page, "Flujo");
  test.skip(!href, "Copa Test Flujo no está en la vitrina (ya sorteada o reseed pendiente)");
  const tournamentId = new URL(href!, "http://x").pathname.split("/torneos/")[1]!.split("/")[0]!;

  await page.goto(`/torneos/${tournamentId}/gestion`);
  const drawBtn = page.getByRole("button", { name: /Cerrar inscripciones y sortear/ });
  await expect(drawBtn).toBeVisible({ timeout: 20_000 });
  await expect(drawBtn).toBeEnabled();
  await drawBtn.click();
  await page.getByRole("button", { name: /Sortear con/ }).click();
  await expect(page.getByText("Sorteo ejecutado")).toBeVisible({ timeout: 30_000 });
});
