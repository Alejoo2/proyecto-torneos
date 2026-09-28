import { expect, test } from "@playwright/test";
import { findFreshMatch, STATES } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * Aplazar → reprogramar en la matriz de la cancha, mismo partido.
 * DESTRUCTIVO: cambia estado/franja del partido. Re-seed después.
 */
test("aplazar y reprogramar un partido", async ({ page }) => {
  test.setTimeout(180_000);
  const found = await findFreshMatch(page);
  test.skip(!found, "Sin partidos frescos en el seed (re-seed y reintentar)");
  // Vista gestor (acciones) vive en /gestor/.../partidos/...
  await page.goto(`/gestor/torneos/${found!.tournamentId}/partidos/${found!.matchId}`);

  // Si aún no está aplazado, aplázalo; si ya lo está, ve directo a reprogramar.
  // (count no espera: primero aguarda a que pinte una u otra acción.)
  const aplazarBtn = page.getByRole("button", { name: "Aplazar" });
  const reprogramarBtn = page.getByRole("button", { name: "Reprogramar" });
  await expect(aplazarBtn.or(reprogramarBtn)).toBeVisible({ timeout: 20_000 });
  if ((await aplazarBtn.count()) > 0) {
    await aplazarBtn.click();
    await page.locator("#postpone-reason").fill("Lluvia torrencial sobre la cancha principal");
    await page.getByRole("button", { name: "Confirmar aplazamiento" }).click();
    await expect(page.getByText("Motivo del aplazamiento:")).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole("button", { name: "Reprogramar" }).click();
  const freeCell = page.getByRole("button", { name: /^Elegir franja/ }).first();
  try {
    await freeCell.waitFor({ timeout: 15_000 });
  } catch {
    test.skip(true, "Sin franjas libres en la cancha para reprogramar");
  }
  await freeCell.click();
  await page.getByRole("button", { name: "Confirmar nueva fecha" }).click();
  await expect(page.getByText("Partido reprogramado")).toBeVisible({ timeout: 20_000 });
});
