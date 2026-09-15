import { Badge } from "torneos/components/ui/badge";
import { cn } from "torneos/lib/utils";
import { PlayerRow } from "./player-row";
import type { CallUpItem } from "./types";

export interface CallupSection {
  teamId: string;
  teamName: string;
  players: CallUpItem[];
}

interface CallupListProps {
  sections: CallupSection[];
  className?: string;
}

/** Convocatoria read-only (ambos equipos). Las ausencias y notas del capitán
 *  quedan visibles para todos — el label informa, no el color. */
export function CallupList({ sections, className }: CallupListProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {sections.map((section) => (
        <section key={section.teamId}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
            {section.teamName} · {section.players.length}
          </h3>
          <div className="space-y-1.5">
            {section.players.map((callUp) => (
              <div key={callUp.id}>
                <PlayerRow
                  player={callUp.player}
                  trailing={
                    callUp.isAbsent ? <Badge variant="warning" status="Ausente" /> : null
                  }
                />
                {callUp.notes && (
                  <p className="break-words pl-12 pr-3 pt-1 text-[11px] text-cypher-4-2-2">
                    {callUp.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}