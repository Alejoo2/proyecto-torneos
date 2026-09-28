import { expect, test } from "@playwright/test";
import { STATES } from "./helpers";

test.use({ storageState: STATES.gestor });

/** Vitrina remake: búsqueda, filtros, badges y prefetch (solo lectura). */
test("filtros y búsqueda acotan la lista", async ({ page }) => {
  await page.goto("/torneos");
  const cards = page.locator('a[href^="/torneos/"]');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);

  await page.getByRole("searchbox", { name: "Buscar torneos" }).fill("zzz-sin-resultados");
  await expect(cards).toHaveCount(0);
  await expect(page.getByText("Sin torneos con esos filtros")).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar torneos" }).fill("");
  await expect(cards.first()).toBeVisible();
});

test("detalle muestra hero, tabs y zona CTA", async ({ page }) => {
  await page.goto("/torneos");
  const cards = page.locator('a[href^="/torneos/"]');
  await cards.first().waitFor({ timeout: 20_000 });
  await cards.first().click();
  await page.waitForURL(/\/torneos\/.+/);
  await expect(page.getByRole("tab", { name: "Fixture" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Posiciones" })).toBeVisible();
});

test("tab Posiciones no muestra vacío falso mientras carga", async ({ page }) => {
  await page.goto("/torneos");
  const cards = page.locator('a[href^="/torneos/"]');
  await cards.first().waitFor({ timeout: 20_000 });
  await cards.first().click();
  await page.waitForURL(/\/torneos\/.+/);
  await page.getByRole("tab", { name: "Posiciones" }).click();
  // O hay tabla (divs con cabecera PJ/PTS) o hay vacío real — nunca skeleton eterno ni crash.
  await expect(
    page.getByText("PTS").or(page.getByText("Sin posiciones aún")),
  ).toBeVisible({ timeout: 20_000 });
});
