"use client";

import { useState } from "react";
import { TacticalView } from "torneos/components/features/team/tactical-view";
import { StarterTile } from "torneos/components/features/team/starter-tile";
import { DeletionBanner } from "torneos/components/ui/deletion-banner/deletion-banner";
import { Badge } from "torneos/components/ui/badge";
import { TEAM_STATUS_LABEL } from "torneos/domain/status-labels";

const MEMBERS = [
  { id: "m1", name: "Kiko Ramírez", image: null, isCaptain: true },
  { id: "m2", name: "Maño Duarte", image: null, isCaptain: false },
  { id: "m3", name: "El Pibe Salas", image: null, isCaptain: false },
  { id: "m4", name: "Chino Vargas", image: null, isCaptain: false },
  { id: "m5", name: "Tico Mendoza", image: null, isCaptain: false },
  { id: "m6", name: "Lalo Quintana", image: null, isCaptain: false },
  { id: "m7", name: "Nano Berrio", image: null, isCaptain: false },
];

const MAX_STARTERS = 5;

function SceneHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">{children}</h2>;
}

/** Estructura completa viva: Previsualización → Cancha (N/5) → Banco, con
 *  doble-toque y gate espejo (5/5 deshabilita el banco). */
function LineupScene() {
  const [starterIds, setStarterIds] = useState<string[]>(["m1", "m2"]);

  const starters = MEMBERS.filter((m) => starterIds.includes(m.id));
  const bench = MEMBERS.filter((m) => !starterIds.includes(m.id));
  const full = starters.length >= MAX_STARTERS;

  const toggle = (id: string, putOn: boolean) =>
    setStarterIds((cur) =>
      putOn
        ? cur.length >= MAX_STARTERS ? cur : [...cur, id]
        : cur.filter((x) => x !== id),
    );

  return (
    <div className="space-y-6 px-5">
      <section>
        <SceneHeading>Previsualización táctica ({starters.length} en cancha)</SceneHeading>
        <TacticalView
          starters={starters.map((m) => ({ playerId: m.id, displayName: m.name, image: m.image }))}
        />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <SceneHeading>En cancha</SceneHeading>
          <span className={full ? "rounded-full bg-cypher-3 px-3 py-1 text-xs font-bold text-cypher-5" : "rounded-full bg-cypher-5-1-1 px-3 py-1 text-xs font-bold text-cypher-4-2"}>
            {starters.length}/{MAX_STARTERS}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {starters.map((m) => (
            <StarterTile key={m.id} name={m.name} image={m.image} isCaptain={m.isCaptain} active onToggle={() => toggle(m.id, false)} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <SceneHeading>Banco</SceneHeading>
          <span className="rounded-full bg-cypher-5-1-1 px-3 py-1 text-xs font-bold text-cypher-4-2">
            {bench.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {bench.map((m) => (
            <StarterTile
              key={m.id}
              name={m.name}
              image={m.image}
              isCaptain={m.isCaptain}
              disabled={full}
              onToggle={() => toggle(m.id, true)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function Wave8Section() {
  return (
    <div className="pt-14">
      <div className="px-5">
        <SceneHeading>Estados de equipo</SceneHeading>
        <div className="flex gap-2">
          <Badge variant={TEAM_STATUS_LABEL.DRAFT.variant} status={TEAM_STATUS_LABEL.DRAFT.label} />
          <Badge variant={TEAM_STATUS_LABEL.ACTIVE.variant} status={TEAM_STATUS_LABEL.ACTIVE.label} />
          <Badge variant={TEAM_STATUS_LABEL.INACTIVE.variant} status={TEAM_STATUS_LABEL.INACTIVE.label} />
        </div>
      </div>

      <div className="px-5 pt-6">
        <SceneHeading>Banner de votación (re-skin)</SceneHeading>
        <DeletionBanner votes={2} totalMembers={5} hasVoted={false} onApprove={() => undefined} onReject={() => undefined} />
      </div>

      <div className="pt-6">
        <LineupScene />
      </div>
    </div>
  );
}