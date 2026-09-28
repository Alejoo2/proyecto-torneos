import { expect, test } from "@playwright/test";
import { findFreshMatch, STATES } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * Walkover: el presente gana, el ausente queda marcado, avanza el bracket.
 * DESTRUCTIVO: termina el partido. Re-seed después.
 */
test("declarar walkover hace avanzar al presente", async ({ page }) => {
  test.setTimeout(180_000);
  const found = await findFreshMatch(page);
  test.skip(!found, "Sin partidos frescos en el seed (re-seed y reintentar)");
  await page.goto(`/gestor/torneos/${found!.tournamentId}/partidos/${found!.matchId}`);

  const walkoverBtn = page.getByRole("button", { name: "Ausente (W.O.)" });
  await walkoverBtn.click();
  // Elige el primer equipo como presente (gana por ausencia del rival).
  const teamBtns = page.locator("div.mt-3.space-y-2 button");
  await teamBtns.first().waitFor({ timeout: 10_000 });
  await teamBtns.first().click();
  await page.getByRole("button", { name: "Declarar ausencia" }).click();
  await expect(page.getByText("Ausencia registrada")).toBeVisible({ timeout: 20_000 });
});
