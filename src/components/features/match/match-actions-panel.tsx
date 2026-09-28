"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Flag, Hourglass } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { CourtAvailabilityGrid } from "torneos/components/ui/court-availability-grid/court-availability-grid";

/**
 * W11 — E2 (H-B): acciones de partido — aplazar / reprogramar / ausente.
 * Primera UI que invoca postpone/reschedule/markWalkover (existían sin invocador).
 * El ownership real vive en el engine (gestor o secretario — E3): este panel solo
 * se monta cuando el template ya resolvió acceso (FORBIDDEN → EmptyState antes).
 * Capacidad: aplazar/reprogramar reversibles → panel directo; WALKOVER terminal
 * e irreversible → ConfirmModal (convención vigente).
 */
interface MatchActionsPanelProps {
  match: {
    id: string;
    tournamentId: string;
    status: string;
    courtId: string | null;
    postponedReason: string | null;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
  };
  onNotify: (title: string) => void;
  /** Llaves del actor (dueño = todo true). Sin la llave, el botón no se pinta. */
  can?: { postpone: boolean; reschedule: boolean; walkover: boolean };
}

export function MatchActionsPanel({ match, onNotify, can = { postpone: true, reschedule: true, walkover: true } }: MatchActionsPanelProps) {
  const utils = api.useUtils();
  const [panel, setPanel] = useState<null | "postpone" | "reschedule">(null);
  const [reason, setReason] = useState("");
  // Reprogramar con la matriz de la cancha (misma piel que el detalle):
  // verde = elegible; el resto informa (ocupada/apartada/confirmada).
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; timeSlot: number } | null>(null);
  const [walkoverOpen, setWalkoverOpen] = useState(false);
  const [walkoverTeamId, setWalkoverTeamId] = useState<string | null>(null);

  const invalidateMatch = () => {
    void utils.match.getById.invalidate({ id: match.id });
    void utils.match.getByIdPublic.invalidate({ id: match.id });
    void utils.match.listByTournament.invalidate({ tournamentId: match.tournamentId });
    void utils.tournament.getById.invalidate({ tournamentId: match.tournamentId });
    // La matriz de la cancha refleja franjas/reservas: aplazar/resprogramar/
    // walkover la mueven (Fase B la hizo visible con el stale).
    if (match.courtId) void utils.court.getBubble.invalidate({ courtId: match.courtId });
  };

  const postponeMutation = api.match.postpone.useMutation({
    onSuccess: () => {
      setPanel(null);
      setReason("");
      onNotify("Partido aplazado");
      invalidateMatch();
    },
    onError: (e) => onNotify(e.message),
  });

  const availabilityQuery = api.court.getAvailability.useQuery(
    { courtId: match.courtId ?? "" },
    // Solo vive mientras el panel está abierto; el engine revalida al confirmar.
    { enabled: panel === "reschedule" && Boolean(match.courtId), staleTime: 2 * 60_000, refetchOnWindowFocus: false },
  );

  const gridDays = useMemo(() => {
    const byDate = new Map<string, { date: string; dayOfWeek: number; slots: { timeSlot: number; isFree: boolean }[] }>();
    for (const row of availabilityQuery.data ?? []) {
      const iso = new Date(row.date).toISOString();
      const entry = byDate.get(iso) ?? {
        date: iso,
        dayOfWeek: new Date(row.date).getUTCDay(),
        slots: [] as { timeSlot: number; isFree: boolean }[],
      };
      entry.slots.push({ timeSlot: row.timeSlot, isFree: row.status === "AVAILABLE" });
      byDate.set(iso, entry);
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [availabilityQuery.data]);

  const rescheduleMutation = api.match.reschedule.useMutation({
    onSuccess: () => {
      setPanel(null);
      setSelectedSlot(null);
      onNotify("Partido reprogramado");
      invalidateMatch();
      if (match.courtId) void utils.court.getAvailability.invalidate({ courtId: match.courtId });
    },
    onError: (e) => onNotify(e.message),
  });

  const walkoverMutation = api.match.markWalkover.useMutation({
    onSuccess: () => {
      setWalkoverTeamId(null);
      onNotify("Ausencia registrada");
      invalidateMatch();
    },
    onError: (e) => {
      setWalkoverTeamId(null);
      onNotify(e.message);
    },
  });

  const isPostponed = match.status === "POSTPONED";
  const canPostpone = match.status === "SCHEDULED" || match.status === "IN_PROGRESS";
  const walkoverTeam =
    walkoverTeamId !== null && walkoverTeamId === match.homeTeam?.id
      ? match.homeTeam
      : match.awayTeam;

  return (
    <section className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-4">
      <h2 className="text-sm font-semibold text-cypher-4">Acciones del partido</h2>

      {isPostponed && match.postponedReason && (
        <p className="mt-2 rounded-xl bg-cypher-5-1-1 px-3 py-2 text-xs text-cypher-4-2">
          Motivo del aplazamiento: {match.postponedReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canPostpone && can.postpone && (
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "postpone" ? null : "postpone")}>
            <Hourglass className="size-4" /> Aplazar
          </Button>
        )}
        {isPostponed && can.reschedule && (
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>
            <CalendarClock className="size-4" /> Reprogramar
          </Button>
        )}
        {match.homeTeam && match.awayTeam && can.walkover && (
          <Button size="sm" variant="secondary" onClick={() => setWalkoverOpen((v) => !v)}>
            <Flag className="size-4" /> Ausente (W.O.)
          </Button>
        )}
      </div>

      {panel === "postpone" && (
        <div className="mt-3 space-y-2">
          <label htmlFor="postpone-reason" className="text-xs font-medium text-cypher-4-2">
                        Motivo (mínimo 10 caracteres)
          </label>
          <textarea
            id="postpone-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ej: lluvia, cancha inundada…"
            className="w-full resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 text-sm text-cypher-4 outline-none placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          />
          <Button
            size="sm"
            disabled={reason.trim().length < 10 || postponeMutation.isPending}            onClick={() => postponeMutation.mutate({ matchId: match.id, reason: reason.trim() })}
          >
            {postponeMutation.isPending ? "Aplazando…" : "Confirmar aplazamiento"}
          </Button>
        </div>
      )}

      {panel === "reschedule" && (
        <div className="mt-3 space-y-2">
          {!match.courtId ? (
            <p className="text-xs text-cypher-4-2-2">
              Este partido no tiene cancha asignada: la reprogramación requiere una.
            </p>
          ) : availabilityQuery.isLoading ? (
            <p className="text-xs text-cypher-4-2-2">Cargando disponibilidad…</p>
          ) : gridDays.length === 0 ? (
            <p className="text-xs text-cypher-4-2-2">Sin franjas disponibles en los próximos 14 días.</p>
          ) : (
            <>
              <CourtAvailabilityGrid
                days={gridDays}
                selected={selectedSlot}
                onSelectSlot={(date, timeSlot) => setSelectedSlot({ date, timeSlot })}
              />
              <Button
                size="sm"
                disabled={selectedSlot === null || rescheduleMutation.isPending}
                onClick={() => {
                  if (selectedSlot !== null) {
                    // Medianoche UTC: espejo exacto de la normalización del engine (Hallazgo 6)
                    rescheduleMutation.mutate({
                      matchId: match.id,
                      newDate: new Date(selectedSlot.date),
                      newTimeSlot: selectedSlot.timeSlot,
                    });
                  }
                }}
              >
                {rescheduleMutation.isPending ? "Reprogramando…" : "Confirmar nueva fecha"}
              </Button>
            </>
          )}
        </div>
      )}

      {walkoverOpen && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-cypher-4-2-2">
            ¿Qué equipo se presenta? El ausente queda eliminado del bracket.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => match.homeTeam && setWalkoverTeamId(match.homeTeam.id)}>
              {match.homeTeam?.name}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => match.awayTeam && setWalkoverTeamId(match.awayTeam.id)}>
              {match.awayTeam?.name}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!walkoverTeamId}
        title="Declarar ausencia (W.O.)"
        message={`"${walkoverTeam?.name}" gana el partido por ausencia del rival.\n\nEsta acción es irreversible: el partido queda terminado y el ganador avanza en el bracket.`}
        confirmText="Declarar ausencia"
        variant="danger"
        onCancel={() => setWalkoverTeamId(null)}
        onConfirm={() => {
          if (walkoverTeamId) {
            walkoverMutation.mutate({ matchId: match.id, winnerTeamId: walkoverTeamId });
          }
        }}
      />
    </section>
  );
}