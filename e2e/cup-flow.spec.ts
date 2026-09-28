import { expect, test, type Page } from "@playwright/test";
import { loginAs, STATES, TEST_USERS } from "./helpers";

test.use({ storageState: STATES.gestor });

/**
 * COPA E2E COMPLETA (flujo multi-rol, serial, 1 worker).
 * Requiere RESEED fresco: consume partidos, crea torneo/equipos/usuarios.
 * DESTRUCTIVO. Órdenes de magnitud: ~15 min.
 *
 * Reparto (diseño vigente, no capricho):
 * - GESTOR crea/publica/sortea (crear y sortear NO son delegables por RBAC).
 * - SECRETARIO full (6/6 llaves) opera en /gestor: walkover, aplaza,
 *   reprograma y carga resultados.
 * - 4 CAPITANES (test1, test16 + 2 frescos con equipo propio) activan
 *   disponibilidad (≥5), inscriben y confirman.
 */
test.describe.serial("copa e2e completa", () => {
  const stamp = Date.now().toString().slice(-6);
  const cupName = `Copa E2E ${stamp}`;
  const secretaryEmail = `e2esec${stamp}@test`;
  const freshCaptains = [`e2ecap1${stamp}@test`, `e2ecap2${stamp}@test`];
  let tournamentId = "";
  let courtId = "";
  let semi1 = "";
  let semi2 = "";
  let finalId = "";
  /** Franja principal elegida (números para ubicar su celda exacta en la matriz). */
  let principalDow = -1;
  let principalSlot = -1;
  const DOW_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const slotHdr = (s: number) => `${(s + 1) * 2}hr`;

  /** Clase de la celda (fecha base × slot principal) en la matriz de la cancha:
   *  hija N del grid = 13 + fila*13 + 1 + slot (1 vacío + 12 cabeceras). */
  async function baseCellClass(page: Page): Promise<string> {
    await page.goto(`/canchas/${courtId}`);
    const grid = page.getByRole("img", { name: /próximos 7 días/ });
    await grid.waitFor({ timeout: 20_000 });
    const r = (principalDow - new Date().getUTCDay() + 7) % 7;
    const el = grid.locator(":scope > *").nth(13 + r * 13 + 1 + principalSlot);
    return (await el.getAttribute("class")) ?? "";
  }

  async function asGestor(page: Page) {
    await loginAs(page, TEST_USERS.gestor);
  }

  /** Carga 1-0 por wizard (score → stats con 1 goleador → guardar). */
  async function loadScore10(page: Page, tId: string, mId: string) {
    await page.goto(`/gestor/torneos/${tId}/partidos/${mId}`);
    await page.getByRole("textbox", { name: "Goles local" }).fill("1");
    await page.getByRole("button", { name: "Confirmar resultado" }).click();
    await page.getByRole("button", { name: "Fijar marcador" }).click();
    await page.getByRole("button", { name: /Cargar estadísticas/ }).click();
    const teamAccordion = page.locator("button[aria-expanded]").filter({ hasText: /· \d+$/ }).first();
    await teamAccordion.click();
    const tiles = page.locator("div.mt-2 button[aria-expanded]");
    await tiles.first().waitFor({ timeout: 15_000 });
    await tiles.first().click();
    await page.getByRole("button", { name: /Sumar Goles|Sumar Autogol/ }).first().click();
    await page.getByRole("button", { name: "Aceptar" }).click();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Enviar plantilla" }).click();
    await expect(page.getByText("Resultado cargado")).toBeVisible({ timeout: 30_000 });
  }

  async function fixtureMatchIds(page: Page, tId: string): Promise<string[]> {
    await page.goto(`/torneos/${tId}`);
    await page.getByRole("tab", { name: "Fixture" }).waitFor({ timeout: 20_000 });
    const links = page.locator('a[href*="/partidos/"]');
    await links.first().waitFor({ timeout: 20_000 });
    const hrefs = (await links.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).href),
    )) as string[];
    return hrefs.map((h) => h.split("/partidos/")[1]!.split("/")[0]!);
  }

  test("1. secretario full designado por el gestor", async ({ page }) => {
    test.setTimeout(120_000);
    // El perfil debe existir: primer login lo aprovisiona.
    await loginAs(page, secretaryEmail);
    await asGestor(page);
    await page.goto("/perfil");
    await page.getByRole("tab", { name: "Gestor", exact: true }).click();
    await expect(page.getByText("Secretarios")).toBeVisible({ timeout: 20_000 });
    // Hermético: fuera secretarios de corridas previas.
    console.log("E2E delegates before:", await page.getByRole("button", { name: /Quitar a/ }).count());
    for (let i = 0; i < 10; i++) {
      const quit = page.getByRole("button", { name: /Quitar a/ });
      const before = await quit.count();
      if (before === 0) break;
      await quit.first().click();
      await expect
        .poll(async () => page.getByRole("button", { name: /Quitar a/ }).count(), { timeout: 15_000 })
        .toBeLessThan(before);
    }
    console.log("E2E delegates after cleanup:", await page.getByRole("button", { name: /Quitar a/ }).count());
    await expect
      .poll(async () => page.getByRole("button", { name: /Quitar a/ }).count(), { timeout: 30_000 })
      .toBe(0);
    await page.getByPlaceholder("Buscar perfil para designar (mín. 3 caracteres)").fill(secretaryEmail);
    const result = page.locator("button", { hasText: secretaryEmail }).first();
    await result.waitFor({ timeout: 15_000 });
    console.log("E2E search result text:", (await result.textContent())?.slice(0, 120));
    await result.click();
    // Espera la FILA (con sus 6 llaves), no el resultado de búsqueda.
    // Ojo: el fresco trae displayName=prefijo, la fila NO muestra el email.
    const secretaryLocal = secretaryEmail.split("@")[0]!;
    const row = page.locator("li", { hasText: secretaryLocal });
    await row.locator('input[type="checkbox"]').first().waitFor({ timeout: 15_000 });
    const boxes = row.locator('input[type="checkbox"]');
    expect(await boxes.count()).toBe(6);
    for (let i = 0; i < 6; i++) {
      const box = boxes.nth(i);
      if (!(await box.isChecked())) {
        await box.click();
        await expect(box).toBeChecked({ timeout: 15_000 });
      }
    }
    await page.reload();
    await page.getByRole("tab", { name: "Gestor", exact: true }).click();
    const rowAfter = page.locator("li", { hasText: secretaryLocal });
    for (let i = 0; i < 6; i++) {
      await expect(rowAfter.locator('input[type="checkbox"]').nth(i)).toBeChecked({ timeout: 15_000 });
    }
  });

  test("2. gestor crea la copa (4 equipos, Malcasado, 3 franjas)", async ({ page }) => {
    test.setTimeout(180_000);
    await asGestor(page);
    await page.goto("/gestor/torneos/nuevo");
    await page.locator("#wt-name").fill(cupName);
    await page.locator("#wt-max").selectOption({ label: "4 equipos" });
    await page.locator("#wt-deadline").fill("2030-06-30");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.locator("#wt-court").selectOption({ label: "Cancha Malcasado" });
    courtId = await page.locator("#wt-court").inputValue();
    expect(courtId).not.toBe("");
    // Primer triple libre (cualquier día): el engine revalida y el error rota.
    // La aprobación del gestor vale desde cualquier estado (Factor 1 no bloquea).
    const grid = page.getByRole("img", { name: /Matriz semanal/ });
    let created = false;
    for (let round = 0; round < 3 && !created; round++) {
      await page.locator("#wt-court").selectOption({ label: "Cancha La Villa" });
      await page.locator("#wt-court").selectOption({ label: "Cancha Malcasado" });
      await grid.locator("button[disabled]").first().waitFor({ timeout: 15_000 }).catch(() => {});
      const free = grid.locator("button:not([disabled])");
      await free.first().waitFor({ timeout: 15_000 });
      for (let i = 0; i < 3; i++) await free.nth(i + round * 3).click();
      await expect(page.getByText("3/3")).toBeVisible({ timeout: 10_000 });
      // Registra la principal (primera marcada) para ubicar su celda exacta.
      const firstMarked = await grid.locator('button[aria-pressed="true"]').first().getAttribute("aria-label");
      const [dname, hdr] = (firstMarked ?? "").split(" ");
      principalDow = DOW_NAMES.indexOf(dname ?? "");
      principalSlot = parseInt(hdr ?? "", 10) / 2 - 1;
      await page.getByRole("button", { name: "Crear torneo" }).click();
      try {
        await page.waitForURL(/\/torneos\/.+\/gestion/, { timeout: 30_000 });
        created = true;
      } catch {
        continue;
      }
    }
    if (!created) throw new Error("Sin triple libre para la copa en Malcasado");
    tournamentId = new URL(page.url()).pathname.split("/torneos/")[1]!.split("/")[0]!;
  });

  test("3. gestor publica: 3 slots azules en la cancha", async ({ page }) => {
    test.setTimeout(120_000);
    await asGestor(page);
    await page.goto(`/canchas/${courtId}`);
    const card = page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name: cupName }) });
    await card.getByRole("button", { name: "Publicar torneo" }).click();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(card.getByText("Inscripciones abiertas")).toBeVisible({ timeout: 20_000 });
    // La fecha base apartada pinta azul en su celda exacta.
    expect(await baseCellClass(page)).toContain("bg-cypher-3");
  });

  test("4. capitanes crean equipo si falta (la aprobación no exige disponibilidad)", async ({ page }) => {
    test.setTimeout(600_000);
    const captains = [TEST_USERS.captainAlfa, TEST_USERS.captainVilla, ...freshCaptains];
    let n = 0;
    for (const email of captains) {
      await loginAs(page, email);
      if (email.startsWith("e2ecap")) {
        const tname = `E2E C${stamp}${n}`;
        await page.goto("/equipos");
        await page.getByRole("button", { name: "Crear equipo" }).first().click();
        await page.getByPlaceholder("Ej: Los Invencibles del Barrio").fill(tname);
        await page.getByPlaceholder("Ej: LIB").fill(`E${stamp}${n}`);
        await page.getByRole("button", { name: "Crear equipo", exact: true }).last().click();
        await page.waitForURL(/\/equipos\/.+/, { timeout: 20_000 });
      }
      n++;
    }
  });

  test("5. los cuatro inscriben y confirman (pago pendiente)", async ({ page }) => {
    test.setTimeout(600_000);
    const captains = [TEST_USERS.captainAlfa, TEST_USERS.captainVilla, ...freshCaptains];
    for (const email of captains) {
      await loginAs(page, email);
      await page.goto(`/torneos/${tournamentId}`);
      await page.getByRole("tab", { name: "Fixture" }).waitFor({ timeout: 20_000 });
      await page.getByRole("button", { name: "Reservar cupo" }).click();
      await expect(page.getByText("Cupo reservado")).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: "Confirmar inscripción" }).click();
      await expect(page.getByText("Mi inscripción")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("6. gestor aprueba las 4 y sortea", async ({ page }) => {
    test.setTimeout(300_000);
    await asGestor(page);
    await page.goto(`/torneos/${tournamentId}/gestion`);
    // Serial por toast (cada onSuccess = commit en server): el approve es
    // optimistic y sortear antes del commit dibujaba mal el bracket.
    for (let i = 0; i < 4; i++) {
      const btns = page.getByRole("button", { name: /Aprobar pago|Aprobar/ });
      await btns.first().waitFor({ timeout: 20_000 });
      await btns.first().click();
      await expect(page.getByText("Pago aprobado — equipo confirmado")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /Aprobar pago|Aprobar/ })).toHaveCount(3 - i, { timeout: 20_000 });
    }
    const drawBtn = page.getByRole("button", { name: /Cerrar inscripciones y sortear · 4 equipos/ });
    await expect(drawBtn).toBeEnabled({ timeout: 10_000 });
    await drawBtn.click();
    await page.getByRole("button", { name: /Sortear con 4/ }).click();
    await expect(page.getByText("Sorteo ejecutado")).toBeVisible({ timeout: 30_000 });
    const ids = await fixtureMatchIds(page, tournamentId);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    [semi1, semi2] = [ids[0]!, ids[1]!];
  });

  test("7. slot base en morado tras el sorteo", async ({ page }) => {
    test.setTimeout(120_000);
    await asGestor(page);
    // El sorteo agenda la semi1 sobre la reserva base: la celda solapa a morado.
    expect(await baseCellClass(page)).toContain("bg-cypher-1");
  });

  test("7b. rojos en otros torneos: auto-ausencia fuera de la copa", async ({ page }) => {
    test.setTimeout(300_000);
    await loginAs(page, TEST_USERS.multiTeam);
    await page.goto("/torneos");
    const cards = page.locator('a[href^="/torneos/"]');
    await cards.first().waitFor({ timeout: 20_000 });
    const hrefs = (await cards.evaluateAll((els, max) =>
      els.map((e) => (e as HTMLAnchorElement).href).slice(0, max as number),
    6)) as string[];
    for (const href of hrefs) {
      const path = new URL(href).pathname;
      if (path.includes(tournamentId)) continue;
      await page.goto(path);
      await page.getByRole("tab", { name: "Fixture" }).waitFor({ timeout: 15_000 });
      const absentBtn = page.getByRole("button", { name: "Ausentarme de este torneo" });
      if ((await absentBtn.count()) > 0) {
        await absentBtn.first().click();
        await expect(page.getByRole("button", { name: "Volver a este torneo" }).first()).toBeVisible({ timeout: 20_000 });
        // La copa queda intacta: sin ausencia marcada ahí.
        await page.goto(`/torneos/${tournamentId}`);
        await page.getByRole("tab", { name: "Fixture" }).waitFor({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Volver a este torneo" })).toHaveCount(0);
        return;
      }
    }
    test.skip(true, "test2 sin otro torneo con auto-ausencia disponible");
  });

  test("8. secretario: walkover semi1 + aplaza semi2", async ({ page }) => {
    test.setTimeout(300_000);
    await loginAs(page, secretaryEmail);
    // Walkover semi1.
    await page.goto(`/gestor/torneos/${tournamentId}/partidos/${semi1}`);
    await expect(page.getByRole("button", { name: "Ausente (W.O.)" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Ausente (W.O.)" }).click();
    const teamBtns = page.locator("div.mt-3.space-y-2 button");
    await teamBtns.first().waitFor({ timeout: 10_000 });
    await teamBtns.first().click();
    await page.getByRole("button", { name: "Declarar ausencia" }).click();
    await expect(page.getByText("Ausencia registrada")).toBeVisible({ timeout: 20_000 });
    // Aplaza semi2.
    await page.goto(`/gestor/torneos/${tournamentId}/partidos/${semi2}`);
    const aplazar = page.getByRole("button", { name: "Aplazar" });
    const reprogramar = page.getByRole("button", { name: "Reprogramar" });
    await expect(aplazar.or(reprogramar)).toBeVisible({ timeout: 20_000 });
    if ((await aplazar.count()) > 0) {
      await aplazar.click();
      await page.locator("#postpone-reason").fill("Copa E2E: tormenta eléctrica sobre Malcasado");
      await page.getByRole("button", { name: "Confirmar aplazamiento" }).click();
      await expect(page.getByText("Motivo del aplazamiento:")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("9. la franja liberada vuelve a la matriz (reprograma semi2)", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, secretaryEmail);
    await page.goto(`/gestor/torneos/${tournamentId}/partidos/${semi2}`);
    await page.getByRole("button", { name: "Reprogramar" }).click();
    const freeCell = page.getByRole("button", { name: /^Elegir franja/ }).first();
    await freeCell.waitFor({ timeout: 15_000 });
    await freeCell.click();
    await page.getByRole("button", { name: "Confirmar nueva fecha" }).click();
    await expect(page.getByText("Partido reprogramado")).toBeVisible({ timeout: 20_000 });
  });

  test("10. secretario carga semi2 y la final; gestor verifica score y tabla", async ({ page }) => {
    test.setTimeout(600_000);
    await loginAs(page, secretaryEmail);
    await loadScore10(page, tournamentId, semi2);
    // Tabla parcial con la semi jugada (aún IN_PROGRESS: el detalle abre).
    // Ojo: StandingsTable son divs (cabecera PJ/PTS), no <table>.
    // Reintento: la query va con retry:false y un fallo transitorio deja el tab vacío.
    await asGestor(page);
    await page.goto(`/torneos/${tournamentId}`);
    await page.getByRole("tab", { name: "Posiciones" }).click();
    try {
      await expect(page.getByText("PTS")).toBeVisible({ timeout: 20_000 });
    } catch {
      await page.reload();
      await page.getByRole("tab", { name: "Posiciones" }).click();
      await expect(page.getByText("PTS")).toBeVisible({ timeout: 20_000 });
    }
    // Final: define el cuadro y dispara FINISHED.
    await loginAs(page, secretaryEmail);
    const ids = await fixtureMatchIds(page, tournamentId);
    const fresh = ids.filter((id) => id !== semi1 && id !== semi2);
    expect(fresh.length).toBeGreaterThanOrEqual(1);
    finalId = fresh[0]!;
    await loadScore10(page, tournamentId, finalId);
    // Gestor verifica persistencia del score en la vista manager.
    await asGestor(page);
    await page.goto(`/gestor/torneos/${tournamentId}/partidos/${finalId}`);
    await expect(page.getByText("1 – 0").first()).toBeVisible({ timeout: 20_000 });
  });

  test("11. torneo finalizado, fuera de vitrina y franjas liberadas", async ({ page }) => {
    test.setTimeout(120_000);
    await asGestor(page);
    // El partido final quedó FINISHED (badge en la vista manager).
    await page.goto(`/gestor/torneos/${tournamentId}/partidos/${finalId}`);
    await expect(page.getByText("Finalizado").first()).toBeVisible({ timeout: 20_000 });
    // FINISHED sale de la vitrina (solo estados activos).
    await page.goto("/torneos");
    await page.getByRole("searchbox", { name: "Buscar torneos" }).fill(cupName);
    await expect(page.locator('a[href^="/torneos/"]')).toHaveCount(0, { timeout: 15_000 });
    // Las reservas se borran al cerrar: la celda base ya no es azul
    // (el partido jugado sigue morado como historia).
    const cellCls = await baseCellClass(page);
    expect(cellCls).not.toContain("bg-cypher-3");
    expect(cellCls).toContain("bg-cypher-1");
  });
});
