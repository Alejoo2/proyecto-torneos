import type { Page } from "@playwright/test";

/** Login dev sin password (Credentials solo en development, ver login-dev).
 *  Usa botón rápido si existe; si no, el formulario (aprovisiona al instante). */
export async function loginAs(page: Page, email: string) {
  // Contexto limpio: /login-dev redirige a / si ya hay sesión.
  await page.context().clearCookies();
  await page.goto("/login-dev");
  const quick = page.getByRole("button", { name: email, exact: true });
  if ((await quick.count()) > 0) {
    await quick.click();
  } else {
    await page.getByRole("textbox", { name: "Email del usuario de prueba" }).fill(email);
    await page.getByRole("button", { name: "Entrar como este usuario" }).click();
  }
  await page.waitForURL("/", { timeout: 30_000 });
}

export const TEST_USERS = {
  gestor: "gestor@gestor",
  admin: "admin@admin",
  captainAlfa: "test1@test",
  multiTeam: "test2@test",
  captainVilla: "test16@test",
} as const;

export const STATES = {
  gestor: "e2e/.auth/gestor.json",
  admin: "e2e/.auth/admin.json",
  test1: "e2e/.auth/test1.json",
  test2: "e2e/.auth/test2.json",
} as const;

/** Abre el primer torneo cuyo nombre contiene `name` (usa el buscador de la vitrina). */
export async function openTournamentByName(page: Page, name: string): Promise<string | null> {
  await page.goto("/torneos");
  await page.getByRole("searchbox", { name: "Buscar torneos" }).fill(name);
  const card = page.locator('a[href^="/torneos/"]').first();
  try {
    await card.waitFor({ timeout: 15_000 });
  } catch {
    return null;
  }
  const href = await card.getAttribute("href");
  await card.click();
  await page.waitForURL(/\/torneos\/.+/, { timeout: 15_000 });
  return href;
}

/**
 * Busca un partido fresco (con wizard "Cargar resultado", sin resultado cargado).
 * Va por la URL pública, salta a "Gestionar partido" (solo gestor) y detecta el
 * wizard ahí. Retorna null si no hay (típico tras correr las destructivas:
 * re-seed y reintentar).
 */
export async function findFreshMatch(
  page: Page,
  maxTournaments = 6,
  maxMatches = 4,
): Promise<{ tournamentId: string; matchId: string } | null> {
  await page.goto("/torneos");
  const cards = page.locator('a[href^="/torneos/"]');
  await cards.first().waitFor({ timeout: 20_000 });
  const hrefs = (await cards.evaluateAll(
    (els, max) => els.map((e) => (e as HTMLAnchorElement).href).slice(0, max as number),
    maxTournaments,
  )) as string[];

  for (const href of hrefs) {
    const tournamentId = href.split("/torneos/")[1]!.split("/")[0]!;
    await page.goto(`/torneos/${tournamentId}`);
    // Tab Fixture es el default; recoge links de partidos si existen.
    const matchLinks = page.locator('a[href*="/partidos/"]');
    if ((await matchLinks.count()) === 0) continue;
    const matchHrefs = (await matchLinks.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).href),
    )) as string[];
    for (const mh of matchHrefs.slice(0, maxMatches)) {
      await page.goto(new URL(mh).pathname);
      // Solo el gestor ve "Gestionar partido"; sin él no hay wizard que detectar.
      const manageLink = page.getByRole("link", { name: "Gestionar partido" });
      try {
        await manageLink.waitFor({ timeout: 8_000 });
      } catch {
        continue;
      }
      const manageHref = await manageLink.getAttribute("href");
      if (!manageHref) continue;
      await page.goto(manageHref);
      const parts = manageHref.split("/torneos/")[1]!.split("/partidos/");
      const tournamentId = parts[0]!;
      const matchId = parts[1]!.split("/")[0]!;
      const wizard = page.getByRole("button", { name: "Confirmar resultado" });
      try {
        await wizard.waitFor({ timeout: 8_000 });
        return { tournamentId, matchId };
      } catch {
        continue;
      }
    }
  }
  return null;
}
