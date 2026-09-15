"use client";

import { useState } from "react";
import { Badge } from "torneos/components/ui/badge";
import { cn } from "torneos/lib/utils";
import { PlayerRow } from "./player-row";
import type { CallUpItem } from "./types";

// Espejo del zod de markAbsent: notes z.string().max(200).optional()
const MAX_NOTES = 200;

interface CaptainAbsenteePanelProps {
  teamName: string;
  callUps: CallUpItem[];
  busyPlayerId?: string | null;
  onToggle: (callUp: CallUpItem, isAbsent: boolean) => void;
  onNotesCommit: (callUp: CallUpItem, notes: string) => void;
  className?: string;
}

function CaptainRow({
  callUp, busy, onToggle, onNotesCommit,
}: {
  callUp: CallUpItem;
  busy: boolean;
  onToggle: CaptainAbsenteePanelProps["onToggle"];
  onNotesCommit: CaptainAbsenteePanelProps["onNotesCommit"];
}) {
  const [notes, setNotes] = useState(callUp.notes ?? "");
  const dirty = notes !== (callUp.notes ?? "");

  return (
    <div>
      <PlayerRow
        player={callUp.player}
        trailing={
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-cypher-4-2">
            <input
              type="checkbox"
              checked={callUp.isAbsent}
              disabled={busy}
              onChange={(e) => onToggle(callUp, e.target.checked)}
              className="size-4 accent-cypher-2"
            />
            Ausente
          </label>
        }
      />
      {callUp.isAbsent && (
        <input
          value={notes}
          maxLength={MAX_NOTES}
          placeholder="Nota (opcional) — p. ej. Lesionado"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (dirty) onNotesCommit(callUp, notes);
          }}
          className="mt-1 ml-11 w-[calc(100%-2.75rem)] rounded-lg border border-cypher-5-1-1 bg-cypher-5 px-2.5 py-1.5 text-xs text-cypher-4 outline-none placeholder:text-cypher-4-2-2 focus:border-cypher-2"
        />
      )}
    </div>
  );
}

/** Vista Capitán: toggle de ausencia + nota opcional, solo MI equipo.
 *  Las mutaciones viven en el template (patrón W3); este panel es estado local puro. */
export function CaptainAbsenteePanel({
  teamName, callUps, busyPlayerId, onToggle, onNotesCommit, className,
}: CaptainAbsenteePanelProps) {
  return (
    <section className={cn("rounded-2xl bg-cypher-5-1 p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
          Mi convocatoria · {teamName}
        </h3>
        <Badge variant="neutral" status="Capitán" />
      </div>
      <div className="space-y-2">
        {callUps.map((callUp) => (
          <CaptainRow
            key={callUp.id}
            callUp={callUp}
            busy={busyPlayerId === callUp.playerId}
            onToggle={onToggle}
            onNotesCommit={onNotesCommit}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-cypher-4-2-2">
        La asistencia se asume. Marca ausentes solo si no llegarán.
      </p>
    </section>
  );
}