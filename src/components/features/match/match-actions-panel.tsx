"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Flag, Hourglass } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { ConfirmModal } from "torneos/components/ui/confirm-modal";
import { SLOT_LABELS } from "torneos/domain/schedule/labels";

/**
 * W11 — E2 (H-B): acciones de partido — aplazar / reprogramar / paseo.
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
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
  };
  onNotify: (title: string) => void;
}

export function MatchActionsPanel({ match, onNotify }: MatchActionsPanelProps) {
  const utils = api.useUtils();
  const [panel, setPanel] = useState<null | "postpone" | "reschedule">(null);
  const [reason, setReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<number | null>(null);
  const [walkoverOpen, setWalkoverOpen] = useState(false);
  const [walkoverTeamId, setWalkoverTeamId] = useState<string | null>(null);

  const invalidateMatch = () => {
    void utils.match.getById.invalidate({ id: match.id });
    void utils.match.getByIdPublic.invalidate({ id: match.id });
    void utils.match.listByTournament.invalidate({ tournamentId: match.tournamentId });
    void utils.tournament.getById.invalidate({ tournamentId: match.tournamentId });
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
    { courtId: match.courtId },
    { enabled: panel === "reschedule" && Boolean(match.courtId) },
  );

  const availableByDate = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of availabilityQuery.data ?? []) {
      if (row.status !== "AVAILABLE") continue;
      const iso = new Date(row.date).toISOString().slice(0, 10);
      const slots = map.get(iso) ?? [];
      slots.push(row.timeSlot);
      map.set(iso, slots);
    }
    return map;
  }, [availabilityQuery.data]);
  const availableDates = useMemo(() => [...availableByDate.keys()].sort(), [availableByDate]);
  const slotsForDate = rescheduleDate ? (availableByDate.get(rescheduleDate) ?? []) : [];

  const rescheduleMutation = api.match.reschedule.useMutation({
    onSuccess: () => {
      setPanel(null);
      setRescheduleDate("");
      setRescheduleSlot(null);
      onNotify("Partido reprogramado");
      invalidateMatch();
      if (match.courtId) void utils.court.getAvailability.invalidate({ courtId: match.courtId });
    },
    onError: (e) => onNotify(e.message),
  });

  const walkoverMutation = api.match.markWalkover.useMutation({
    onSuccess: () => {
      setWalkoverTeamId(null);
      onNotify("Paseo registrado");
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
    walkoverTeamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;

  return (
    <section className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-4">
      <h2 className="text-sm font-semibold text-cypher-4">Acciones del partido</h2>

      {isPostponed && match.postponedReason && (
        <p className="mt-2 rounded-xl bg-cypher-5-1-1 px-3 py-2 text-xs text-cypher-4-2">
          Motivo del aplazamiento: {match.postponedReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canPostpone && (
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "postpone" ? null : "postpone")}>
            <Hourglass className="size-4" /> Aplazar
          </Button>
        )}
        {isPostponed && (
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>
            <CalendarClock className="size-4" /> Reprogramar
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setWalkoverOpen((v) => !v)}>
          <Flag className="size-4" /> Paseo (W.O.)
        </Button>
      </div>

      {panel === "postpone" && (
        <div className="mt-3 space-y-2">
          <label htmlFor="postpone-reason" className="text-xs font-medium text-cypher-4-2">
                        Motivo (mínimo 10 caracteres)Motivo (requerido)
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
          ) : availableDates.length === 0 ? (
            <p className="text-xs text-cypher-4-2-2">Sin franjas disponibles en los próximos 14 días.</p>
          ) : (
            <>
              <div>
                <label htmlFor="reschedule-date" className="text-xs font-medium text-cypher-4-2">Fecha</label>
                <select
                  id="reschedule-date"
                  value={rescheduleDate}
                  onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleSlot(null); }}
                  className="mt-1 w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 text-sm text-cypher-4 outline-none focus:border-cypher-4-2"
                >
                  <option value="">Elegir día…</option>
                  {availableDates.map((iso) => (
                    <option key={iso} value={iso}>{iso}</option>
                  ))}
                </select>
              </div>
              {rescheduleDate && (
                <div>
                  <label htmlFor="reschedule-slot" className="text-xs font-medium text-cypher-4-2">Franja</label>
                  <select
                    id="reschedule-slot"
                    value={rescheduleSlot === null ? "" : String(rescheduleSlot)}
                    onChange={(e) => setRescheduleSlot(e.target.value === "" ? null : Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 text-sm text-cypher-4 outline-none focus:border-cypher-4-2"
                  >
                    <option value="">Elegir franja…</option>
                    {slotsForDate.map((s) => (
                      <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                size="sm"
                disabled={rescheduleSlot === null || rescheduleMutation.isPending}
                onClick={() => {
                  if (rescheduleSlot !== null) {
                    // Medianoche UTC: espejo exacto de la normalización del engine (Hallazgo 6)
                    rescheduleMutation.mutate({
                      matchId: match.id,
                      newDate: new Date(`${rescheduleDate}T00:00:00.000Z`),
                      newTimeSlot: rescheduleSlot,
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
            ¿Qué equipo gana por paseo? El perdedor queda eliminado del bracket.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setWalkoverTeamId(match.homeTeam.id)}>
              {match.homeTeam.name}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWalkoverTeamId(match.awayTeam.id)}>
              {match.awayTeam.name}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!walkoverTeamId}
        title="Declarar paseo (W.O.)"
        message={`"${walkoverTeam?.name}" gana el partido por paseo.\n\nEsta acción es irreversible: el partido queda terminado y el ganador avanza en el bracket.`}
        confirmText="Declarar paseo"
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