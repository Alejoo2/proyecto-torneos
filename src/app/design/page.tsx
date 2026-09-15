"use client";

import { useState } from "react";
import { CalendarX2, Inbox, Trophy } from "lucide-react";
import { AppShell } from "torneos/components/app-shell/app-shell";
import { AppHeader } from "torneos/components/app-shell/app-header";
import { BottomNav } from "torneos/components/app-shell/bottom-nav";
import { NotificationCenter } from "torneos/components/app-shell/notification-center";
import { Badge } from "torneos/components/ui/badge";
import { Age } from "torneos/components/ui/age";
import { CountdownTimer } from "torneos/components/ui/countdown-timer";
import { TeamChip } from "torneos/components/ui/team-chip";
import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { StatBadge } from "torneos/components/ui/stat-badge";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { FIXTURE_TEAMS, FIXTURE_PLAYERS } from "./fixtures";
import { Wave2Section } from "./wave2";
import { Wave3Section } from "./wave3";
import { Wave4Section } from "./wave4";

const NOW = Date.now();

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="w-28">
      <div className={`h-14 rounded-lg border border-cypher-5-1-1 ${className}`} />
      <p className="mt-1 text-[11px] font-medium text-cypher-4">{name}</p>
      <p className="text-[10px] text-cypher-4-2-2">{hex}</p>
    </div>
  );
}

/** Matriz 4.3 viva: cada combinación legal, renderizada. QA visual del color. */
function MatrixDemo() {
  const surfaces = [
    { name: "cypher-5", cls: "bg-cypher-5" },
    { name: "cypher-5-1", cls: "bg-cypher-5-1" },
    { name: "cypher-5-1-1", cls: "bg-cypher-5-1-1" },
    { name: "cypher-1-2", cls: "bg-cypher-1-2" },
    { name: "cypher-2-2", cls: "bg-cypher-2-2" },
    { name: "cypher-3-2", cls: "bg-cypher-3-2" },
  ];
  return (
    <div className="w-full space-y-2">
      {surfaces.map((s) => (
        <div key={s.name} className={`flex items-center justify-between gap-4 rounded-lg border border-cypher-5-1-1 px-4 py-3 ${s.cls}`}>
          <span className="text-[10px] uppercase text-cypher-4-2-2">{s.name}</span>
          <span className="text-sm font-semibold text-cypher-4">Primario</span>
          <span className="text-sm text-cypher-4-2">Secundario</span>
          <span className="size-4 rounded-full bg-cypher-2" title="detalle acento" />
          <span className="text-sm font-bold text-cypher-5">Grafito↔acento</span>
        </div>
      ))}
    </div>
  );
}

/** Stage: composiciones de pantalla dentro del marco real del shell.
 *  Sustituye al ShellDemo de W0 (el QA de campana/panel/Escape sigue vivo acá,
 *  ahora sobre contenido real). Contrato de escena:
 *  1. Pura + autocontenida (fixtures propios, sin tRPC).
 *  2. Se comporta como un template real: trae su propio pt-14 (el header es
 *     overlay), px-5 y pb-nav-safe. El main del Stage no da padding.
 *  Cambiar de escena desmonta la anterior = reset de estado, como navegar. */
interface Scene {
  id: string;
  label: string;
  node: React.ReactNode;
}

const SCENES: Scene[] = [
  { id: "wave4", label: "W4 · Partido", node: <Wave4Section /> },
  { id: "wave3", label: "W3 · Gestión", node: <Wave3Section /> },
  { id: "wave2", label: "W2 · Detalle", node: <Wave2Section /> },
];

function Stage() {
  const [sceneId, setSceneId] = useState("wave4");
  const scene = SCENES.find((s) => s.id === sceneId);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-2">
        {SCENES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSceneId(s.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sceneId === s.id ? "bg-cypher-2 text-cypher-5" : "bg-cypher-5-1-1 text-cypher-4-2"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <AppShell>
        <NotificationCenter>
          <AppHeader mode="internal" title="Vista de prueba" />
          <main className="relative flex-1 overflow-y-auto">{scene?.node}</main>
        </NotificationCenter>
        <BottomNav activeTab="/" />
      </AppShell>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="min-h-dvh bg-cypher-5 p-6 text-cypher-4 md:p-10">
      <header className="mb-10">
        <h1 className="text-2xl font-bold glow-lime">Sistema Cypher — Galería</h1>
        <p className="mt-1 text-sm text-cypher-4-2">
          Tokens, átomos y shell (catálogo) · composiciones de pantalla (Stage). Todo lo aprobado aquí es el componente real.
        </p>
      </header>

      <Section title="Superficies (escalera de profundidad)">
        <Swatch name="cypher-5" hex="#141414" className="bg-cypher-5" />
        <Swatch name="cypher-5-1" hex="#1F1F1F" className="bg-cypher-5-1" />
        <Swatch name="cypher-5-1-1" hex="#2A2A2A" className="bg-cypher-5-1-1" />
      </Section>

      <Section title="Matriz 4.3 — combinaciones legales">
        <MatrixDemo />
      </Section>

      <Section title="Acentos + neón (4.4)">
        <Swatch name="cypher-1 púrpura" hex="#7B2CBF" className="bg-cypher-1" />
        <Swatch name="cypher-2 lima" hex="#CCFF00" className="bg-cypher-2" />
        <Swatch name="cypher-3 turquesa" hex="#00F5D4" className="bg-cypher-3" />
        <div className="w-full pt-2">
          <p className="text-2xl font-bold text-cypher-4 glow-lime">COPA BARRIAL</p>
          <p className="text-2xl font-bold text-cypher-4 glow-turquoise">LIGA NOCTURNA</p>
        </div>
      </Section>

      <Section title="Átomos">
        <Badge variant="success" status="Aprobado" />
        <Badge variant="warning" status="Pendiente de pago" />
        <Badge variant="error" status="Rechazado" />
        <Badge variant="neutral" status="Borrador" />
        <TeamChip team={FIXTURE_TEAMS.local} />
        <TeamChip team={FIXTURE_TEAMS.visit} />
        <PlayerAvatar profile={FIXTURE_PLAYERS.withImage} />
        <PlayerAvatar profile={FIXTURE_PLAYERS.noImage} size="lg" />
        <StatBadge label="PJ" value={12} />
        <StatBadge label="Goles" value={7} />
        <div className="flex flex-col gap-1">
          <Age dataUpdatedAt={NOW - 42_000} />
          <CountdownTimer expiresAt={NOW + 4 * 60_000} serverTimestamp={NOW} />
          <CountdownTimer expiresAt={NOW + 40_000} serverTimestamp={NOW} />
        </div>
      </Section>

      <Section title="Estados honestos">
        <LoadingSkeleton variant="row" />
        <LoadingSkeleton variant="grid" />
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="Sin torneos activos"
          description="Cuando publiques uno, aparecerá aquí."
          action={
            <button className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1">
              Crear torneo
            </button>
          }
        />
        <EmptyState icon={<CalendarX2 className="size-8" />} title="Fixture vacío" />
        <EmptyState icon={<Trophy className="size-8" />} title="Sin inscripciones" />
      </Section>

      <Section title="Stage — composiciones en el marco real">
        <Stage />
      </Section>
    </div>
  );
}