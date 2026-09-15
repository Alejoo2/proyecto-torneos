"use client";

import { useState } from "react";
import { MatchHero } from "torneos/components/features/match/match-hero";
import { CallupList, type CallupSection } from "torneos/components/features/match/callup-list";
import { CaptainAbsenteePanel } from "torneos/components/features/match/captain-absentee-panel";
import { RefereeSelect } from "torneos/components/features/match/referee-select";
import { ResultForm } from "torneos/components/features/match/result-form";
import { ResultReadout } from "torneos/components/features/match/result-readout";
import type { CallUpItem, PlayerStatItem } from "torneos/components/features/match/types";

// Época FIJA (convención W0): jamás Date.now() a nivel de módulo. Los fixtures
// usan fechas literales; el engine normaliza `date` a medianoche UTC (H4).
const FIXED_DATE = new Date("2026-04-11T00:00:00.000Z");
const FIXED_SCHEDULED_AT = new Date("2026-04-11T19:30:00.000Z");

const HOME = { id: "fx-home", name: "Los Hijos del Barrio", abbreviation: "HDB", primaryColor: "#CCFF00" };
const AWAY = { id: "fx-away", name: "Real Luneta", abbreviation: "RLU", primaryColor: "#7B2CBF" };

const P = (displayName: string) => ({ profile: { displayName, user: { image: null as string | null } } });

const CALLOPS: CallUpItem[] = [
  { id: "c1", playerId: "p1", teamId: HOME.id, isAbsent: false, notes: null, player: P("Kiko Ramírez") },
  { id: "c2", playerId: "p2", teamId: HOME.id, isAbsent: true, notes: "Lesionado — tobillo", player: P("Maño Duarte") },
  { id: "c3", playerId: "p3", teamId: HOME.id, isAbsent: false, notes: null, player: P("El Pibe Salas") },
  { id: "c4", playerId: "p4", teamId: HOME.id, isAbsent: false, notes: null, player: P("Chino Vargas") },
  { id: "c5", playerId: "p5", teamId: AWAY.id, isAbsent: false, notes: null, player: P("Tico Mendoza") },
  { id: "c6", playerId: "p6", teamId: AWAY.id, isAbsent: false, notes: null, player: P("Lalo Quintana") },
  { id: "c7", playerId: "p7", teamId: AWAY.id, isAbsent: false, notes: null, player: P("Nano Berrio") },
];

const STATS: PlayerStatItem[] = [
  { playerId: "p1", teamId: HOME.id, goals: 2, blueCards: 0, yellowCards: 0, redCards: 0, fouls: 1, ownGoals: 0, player: P("Kiko Ramírez") },
  { playerId: "p3", teamId: HOME.id, goals: 1, blueCards: 1, yellowCards: 0, redCards: 0, fouls: 2, ownGoals: 0, player: P("El Pibe Salas") },
  { playerId: "p5", teamId: AWAY.id, goals: 1, blueCards: 0, yellowCards: 1, redCards: 0, fouls: 3, ownGoals: 0, player: P("Tico Mendoza") },
];

const REFEREES = [
  { id: "fx-r1", name: "J. Ortiz" },
  { id: "fx-r2", name: "M. Peña" },
];

const SECTIONS: CallupSection[] = [
  { teamId: HOME.id, teamName: HOME.name, players: CALLOPS.filter((c) => c.teamId === HOME.id) },
  { teamId: AWAY.id, teamName: AWAY.name, players: CALLOPS.filter((c) => c.teamId === AWAY.id) },
];

function CaptainScene() {
  const [callUps, setCallUps] = useState(CALLOPS);
  const mine = callUps.filter((c) => c.teamId === HOME.id);
  return (
    <div className="space-y-4 px-5">
      <MatchHero
        status="SCHEDULED"
        homeTeam={HOME}
        awayTeam={AWAY}
        scheduledAt={FIXED_SCHEDULED_AT}
        phaseName="Fecha 3"
        courtName="Cancha La Esperanza"
      />
      <CaptainAbsenteePanel
        teamName={HOME.name}
        callUps={mine}
        onToggle={(c, isAbsent) =>
          setCallUps((prev) => prev.map((x) => (x.id === c.id ? { ...x, isAbsent } : x)))
        }
        onNotesCommit={(c, notes) =>
          setCallUps((prev) => prev.map((x) => (x.id === c.id ? { ...x, notes } : x)))
        }
      />
      <CallupList sections={SECTIONS} />
    </div>
  );
}

function ManagerScene() {
  return (
    <div className="space-y-4 px-5">
      <MatchHero
        status="SCHEDULED"
        homeTeam={HOME}
        awayTeam={AWAY}
        scheduledAt={FIXED_SCHEDULED_AT}
        phaseName="Fecha 3"
        courtName="Cancha La Esperanza"
      />
      <RefereeSelect
        referees={REFEREES}
        valueId={null}
        onChange={() => undefined}
      />
      <ResultForm
        homeTeam={HOME}
        awayTeam={AWAY}
        callUps={CALLOPS}
        onSubmit={() => undefined}
      />
    </div>
  );
}

function FinishedScene() {
  return (
    <div className="space-y-4 px-5">
      <MatchHero
        status="FINISHED"
        homeTeam={HOME}
        awayTeam={AWAY}
        result={{ homeScore: 3, awayScore: 1 }}
        scheduledAt={FIXED_SCHEDULED_AT}
        phaseName="Fecha 3"
        refereeName="J. Ortiz"
      />
      <ResultReadout
        homeScore={3}
        awayScore={1}
        notes="Se suspendió 10 minutos por lluvia."
        sections={[
          { teamId: HOME.id, teamName: HOME.name, stats: STATS.filter((s) => s.teamId === HOME.id) },
          { teamId: AWAY.id, teamName: AWAY.name, stats: STATS.filter((s) => s.teamId === AWAY.id) },
        ]}
      />
    </div>
  );
}

function PostponedScene() {
  return (
    <div className="space-y-4 px-5">
      <MatchHero
        status="POSTPONED"
        homeTeam={HOME}
        awayTeam={AWAY}
        date={FIXED_DATE}
        timeSlot={5}
        phaseName="Fecha 4"
      />
      <p className="px-1 text-xs text-cypher-4-2-2">
        POSTPONED no es terminal: el engine sigue permitiendo árbitro, ausentes y carga.
      </p>
    </div>
  );
}

const VIEWS = [
  { id: "manager", label: "Gestor · programado", node: <ManagerScene /> },
  { id: "captain", label: "Capitán · ausentes", node: <CaptainScene /> },
  { id: "finished", label: "Con resultado", node: <FinishedScene /> },
  { id: "postponed", label: "Aplazado", node: <PostponedScene /> },
];

export function Wave4Section() {
  const [viewId, setViewId] = useState("manager");
  const view = VIEWS.find((v) => v.id === viewId);
  return (
    <div className="pt-14">
      <div className="mb-4 flex flex-wrap gap-2 px-5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setViewId(v.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${viewId === v.id ? "bg-cypher-2 text-cypher-5" : "bg-cypher-5-1-1 text-cypher-4-2"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view?.node}
    </div>
  );
}