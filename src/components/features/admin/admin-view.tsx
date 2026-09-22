"use client";

import { useState } from "react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { TabBar } from "torneos/components/ui/tab-bar";
import { AdminCourtsTab } from "torneos/components/features/admin/admin-courts-tab";
import { AdminManagersTab } from "torneos/components/features/admin/admin-managers-tab";
import { AdminRefereesTab } from "torneos/components/features/admin/admin-referees-tab";
import { AdminRbacTab } from "torneos/components/features/admin/admin-rbac-tab";

const TABS = [
  { id: "canchas", label: "Canchas" },
  { id: "gestores", label: "Gestores" },
  { id: "arbitros", label: "Árbitros" },
  { id: "permisos", label: "Permisos" },
] as const;

/** W10 — Consola admin con 4 pestañas (patrón TabBar del Perfil). El gate de
 *  sesión vive en el RSC de la página; este componente asume admin. */
export function AdminView() {
  const [tab, setTab] = useState<string>("canchas");

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Admin" />
      <div className="px-4 pt-3">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="px-4 pt-6">
        {tab === "canchas" && <AdminCourtsTab />}
        {tab === "gestores" && <AdminManagersTab />}
        {tab === "arbitros" && <AdminRefereesTab />}
        {tab === "permisos" && <AdminRbacTab />}
      </div>
    </div>
  );
}