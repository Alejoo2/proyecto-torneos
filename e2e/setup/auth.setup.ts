import { test as setup } from "@playwright/test";
import { loginAs, TEST_USERS } from "../helpers";

/** Sesiones reutilizadas (storageState). Reseed de BD las invalida solo si cambian emails. */
for (const [name, email] of Object.entries({
  gestor: TEST_USERS.gestor,
  admin: TEST_USERS.admin,
  test1: TEST_USERS.captainAlfa,
  test2: TEST_USERS.multiTeam,
})) {
  setup(`login ${name}`, async ({ page }) => {
    await loginAs(page, email);
    await page.context().storageState({ path: `e2e/.auth/${name}.json` });
  });
}
