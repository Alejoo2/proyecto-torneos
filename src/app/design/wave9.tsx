"use client";

import { useState } from "react";
import { TabBar } from "torneos/components/ui/tab-bar";
import { StatCard } from "torneos/components/features/profile/stat-card";
import { TeamPill } from "torneos/components/features/profile/team-pill";
import { MatchHistoryRow } from "torneos/components/features/profile/match-history-row";

// Época fija (convención W0): fechas literales formateadas acá.
const D1 = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).format(new Date("2026-08-20T00:00:00.000Z"));
const D2 = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).format(new Date("2026-08-15T00:00:00.000Z"));

function SceneHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">{children}</h2>;
}

function StatsScene() {
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-4 px-5">
      <SceneHeading>Tabs (3)</SceneHeading>
      <TabBar
        tabs={[
          { id: "stats", label: "Estadísticas" },
          { id: "edit", label: "Editar perfil" },
          { id: "schedule", label: "Disponibilidad" },
        ]}
        active="stats"
        onChange={() => undefined}
      />

      <SceneHeading>Cards de estadística (tap → toast)</SceneHeading>
      <div className="grid grid-cols-2 gap-4">
        <StatCard value="8" label="Partidos con stats" detail="Total de partidos donde se cargaron tus estadísticas." onTap={setToast} />
        <StatCard value="1.5" label="Prom. goles últ. 10" detail="Promedio de goles en tus últimos 10 partidos." onTap={setToast} />
        <StatCard value="1.13" label="Puntaje Fair Play" note="(menor = mejor)" detail="Fórmula: (AM×1 + RO×3 + AZ×0.5 + FA×0.25) ÷ partidos. Menor es mejor." onTap={setToast} />
        <StatCard value="3" label="Tarjetas últ. 10" detail="Suma de azules, amarillas y rojas en últimos 10." onTap={setToast} />
      </div>
      {toast && <p className="rounded-lg bg-cypher-5-1-1 px-3 py-2 text-xs text-cypher-4-2">{toast}</p>}

      <SceneHeading>Chips de equipos (corona = capitán)</SceneHeading>
      <div className="flex flex-wrap gap-2">
        <TeamPill href="#" abbreviation="LSP" primaryColor="#7B2CBF" isCaptain />
        <TeamPill href="#" abbreviation="FCC" primaryColor="#00F5D4" />
        <span className="shrink-0 rounded-full bg-cypher-5-1-1 px-3 py-1.5 text-xs font-medium text-cypher-4-2">+2</span>
      </div>

      <SceneHeading>Historial (goles por partido)</SceneHeading>
      <div className="flex flex-col gap-3">
        <MatchHistoryRow href="#" title="Copa Barrial 2026 — Octavos" subtitle={D1} goals={2} />
        <MatchHistoryRow href="#" title="Liga de Verano — Jornada 5" subtitle={D2} goals={0} />
      </div>
    </div>
  );
}

export function Wave9Section() {
  return (
    <div className="pt-14">
      <StatsScene />
    </div>
  );
}