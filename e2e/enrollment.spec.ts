import { expect, test } from "@playwright/test";
import { STATES } from "./helpers";

test.use({ storageState: STATES.test1 });

/**
 * Flujo de inscripción: reserva de cupo (hold de 5 min, se libera solo).
 * Busca un torneo con CTA READY entre los 4 primeros; si ninguno, skip.
 */
test("reservar cupo muestra cuenta regresiva", async ({ page }) => {
  await page.goto("/torneos");
  const cards = page.locator('a[href^="/torneos/"]');
  await cards.first().waitFor({ timeout: 20_000 });
  const hrefs = (await cards.evaluateAll((els, max) =>
    els.map((e) => (e as HTMLAnchorElement).href).slice(0, max as number),
  4)) as string[];

  for (const href of hrefs) {
    await page.goto(new URL(href).pathname);
    await page.getByRole("tab", { name: "Fixture" }).waitFor({ timeout: 15_000 });
    if ((await page.getByRole("button", { name: "Reservar cupo" }).count()) > 0) {
      await page.getByRole("button", { name: "Reservar cupo" }).click();
      await expect(page.getByText("Cupo reservado")).toBeVisible({ timeout: 20_000 });
      return;
    }
  }
  test.skip(true, "Sin torneo con CTA READY para test1 en este seed");
});
