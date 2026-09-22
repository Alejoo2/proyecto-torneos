"use client";

import { useState } from "react";
import { TabBar } from "torneos/components/ui/tab-bar";
import { ManagerCard } from "torneos/components/ui/admin/manager-card";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { SceneHeading } from "./wave9-heading";

const RBAC_FIXTURE = {
  roles: [
    { id: "r1", name: "admin", isSystem: true, permissions: ["court:edit", "rbac:manage", "referee:manage"] },
    { id: "r2", name: "manager", isSystem: true, permissions: ["court:edit"] },
  ],
  permissions: [
    { id: "p1", code: "court:edit", name: "Editar canchas", module: "court" },
    { id: "p2", code: "rbac:manage", name: "Gestionar roles y permisos", module: "rbac" },
    { id: "p3", code: "referee:manage", name: "Gestionar árbitros", module: "match" },
  ],
};

function RbacMiniScene() {
  const [granted, setGranted] = useState<Record<string, boolean>>({
    "r1|p1": true, "r1|p2": true, "r1|p3": true, "r2|p1": true,
  });
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-cypher-5-1-1">
          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-cypher-4-2-2">Permiso</th>
          {RBAC_FIXTURE.roles.map((r) => (
            <th key={r.id} className="pb-2 text-center text-[10px] font-bold uppercase tracking-widest text-cypher-4-2">{r.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RBAC_FIXTURE.permissions.map((p) => (
          <tr key={p.id} className="border-t border-cypher-5-1-1/50">
            <td className="py-2 pr-3">
              <p className="text-xs font-medium text-cypher-4">{p.code}</p>
              <p className="text-[10px] text-cypher-4-2-2">{p.name}</p>
            </td>
            {RBAC_FIXTURE.roles.map((r) => {
              const on = granted[`${r.id}|${p.id}`] ?? false;
              const locked = r.name === "admin" && p.code === "rbac:manage" && on;
              return (
                <td key={r.id} className="py-2 text-center">
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={locked}
                    title={locked ? "Salvaguarda: el admin necesita este permiso" : undefined}
                    onClick={() => setGranted((c) => ({ ...c, [`${r.id}|${p.id}`]: !on }))}
                    className={`mx-auto flex size-7 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      on ? "bg-cypher-2 text-cypher-5" : "border border-cypher-5-1-1 bg-cypher-5 text-cypher-4-2-2"
                    } ${locked ? "cursor-not-allowed opacity-50" : "active:scale-90"}`}
                  >
                    {on ? "✓" : ""}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Wave10Section() {
  const [tab, setTab] = useState("canchas");
  return (
    <div className="space-y-6 px-5">
      <section>
        <SceneHeading>Tabs de la consola (4)</SceneHeading>
        <TabBar
          tabs={[
            { id: "canchas", label: "Canchas" },
            { id: "gestores", label: "Gestores" },
            { id: "arbitros", label: "Árbitros" },
            { id: "permisos", label: "Permisos" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </section>

      <section>
        <SceneHeading>Gestores (cards re-skinned)</SceneHeading>
        <div className="space-y-3">
          <ManagerCard name="Gestor de Torneos" email="gestor@gestor" isActive onToggleStatus={() => undefined} />
          <ManagerCard name="Gestor Pausado" email="pausa@gestor" isActive={false} onToggleStatus={() => undefined} />
          <UserSearchResult name="Test 3" email="test3@test" onSelect={() => undefined} />
        </div>
      </section>

      <section>
        <SceneHeading>Matriz de permisos (celda bloqueada = salvaguarda rbac:manage de admin)</SceneHeading>
        <RbacMiniScene />
      </section>
    </div>
  );
}