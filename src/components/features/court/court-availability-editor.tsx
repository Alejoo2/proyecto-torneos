"use client";

import { useMemo, useState } from "react";
import { api } from "torneos/trpc/react";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { DAY_LABELS } from "torneos/domain/schedule/labels";
import { cn } from "torneos/lib/utils";

interface CourtAvailabilityEditorProps {
  courtId: string;
  courtName: string;
}

type Status = "AVAILABLE" | "UNAVAILABLE";
type SlotPayload = { date: Date; timeSlot: number; status: Status };

const SLOT_COUNT = 12;

/** W10 — Editor admin de disponibilidad por FECHA (14 días × 12 franjas, modelo
 *  CourtAvailability real: courtId_date_timeSlot). Estado local commit-style hasta
 *  "Guardar" (precedente ResultWizard W4): Guardar → getBlockImpact (solo franjas que
 *  se cierran) → si hay partidos afectados, ConfirmModal con conteo exacto →
 *  setAvailabilityWithCascade. La cancha manda: lo que se cierra, aplaza. */
export function CourtAvailabilityEditor({ courtId, courtName }: CourtAvailabilityEditorProps) {
  const utils = api.useUtils();
  const { data: rows, isLoading } = api.court.getAvailability.useQuery({ courtId });

  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [confirm, setConfirm] = useState<{ slots: SlotPayload[]; count: number; sample: string[] } | null>(null);
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const notify = (title: string) => setToast({ title });

  const mutation = api.court.setAvailabilityWithCascade.useMutation({
    onSuccess: (data) => {
      setOverrides({});
      setConfirm(null);
      notify(data.postponed > 0 ? `Guardado · ${data.postponed} partido(s) aplazado(s)` : "Disponibilidad guardada");
      void utils.court.getAvailability.invalidate({ courtId });
      void utils.court.getBlockImpact.invalidate({ courtId });
    },
    onError: (e) => notify(e.message),
  });

  // Ventana de 14 días (misma del server). Fechas construidas EN el componente,
  // jamás a nivel de módulo (convención).
  const days = useMemo(() => {
    const arr: string[] = [];
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      arr.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return arr;
  }, []);

  const baseStatus = (iso: string, slot: number): Status => {
    const found = rows?.find(
      (r) => new Date(r.date).toISOString().slice(0, 10) === iso && r.timeSlot === slot,
    );
    // Sin fila = franja cerrada (el read-model público interpreta igual)
    return found?.status === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
  };

  const status = (iso: string, slot: number): Status =>
    overrides[`${iso}|${slot}`] ?? baseStatus(iso, slot);

  const delta: SlotPayload[] = Object.entries(overrides)
    .filter(([key, st]) => {
      const [iso, slotStr] = key.split("|");
      return baseStatus(iso, Number(slotStr)) !== st;
    })
    .map(([key, st]) => {
      const [iso, slotStr] = key.split("|");
      return {
        date: new Date(`${iso}T00:00:00.000Z`),
        timeSlot: Number(slotStr),
        status: st,
      };
    });

  const handleSave = async () => {
    if (delta.length === 0) {
      notify("Sin cambios para guardar");
      return;
    }
    const closing = delta.filter((s) => s.status === "UNAVAILABLE");
    const impact =
      closing.length > 0
        ? await utils.court.getBlockImpact.fetch({
            courtId,
            slots: closing.map(({ date, timeSlot }) => ({ date, timeSlot })),
          })
        : { count: 0, matches: [] };
    setConfirm({
      slots: delta,
      count: impact.count,
      sample: impact.matches.slice(0, 3).map((m) => m.tournamentName),
    });
  };

  if (isLoading) return <LoadingSkeleton variant="card" rows={3} />;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[56px_repeat(12,1fr)] gap-1">
            <div />
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <div key={slot} className="pb-1 text-center text-[9px] tabular-nums text-cypher-4-2-2">
                {slot * 2}h
              </div>
            ))}
          </div>
          {days.map((iso) => {
            const d = new Date(`${iso}T00:00:00.000Z`);
            return (
              <div key={iso} className="grid grid-cols-[56px_repeat(12,1fr)] gap-1 py-0.5">
                <div className="pr-1 text-right leading-tight">
                  <p className="text-[10px] font-semibold text-cypher-4-2">
                    {DAY_LABELS[d.getUTCDay()].slice(0, 3)}
                  </p>
                  <p className="text-[9px] tabular-nums text-cypher-4-2-2">
                    {d.getUTCDate()}/{d.getUTCMonth() + 1}
                  </p>
                </div>
                {Array.from({ length: SLOT_COUNT }, (_, slot) => {
                  const st = status(iso, slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={st === "AVAILABLE"}
                      aria-label={`${iso} franja ${slot * 2}h: ${st === "AVAILABLE" ? "abierta" : "cerrada"}`}
                      onClick={() =>
                        setOverrides((cur) => ({
                          ...cur,
                          [`${iso}|${slot}`]: st === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
                        }))
                      }
                      className={cn(
                        "h-7 rounded transition-colors active:opacity-70",
                        st === "AVAILABLE" ? "bg-green-500/80" : "border border-cypher-5-1-1 bg-cypher-5",
                      )}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-cypher-4-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-green-500" /> Abierta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] border border-cypher-5-1-1 bg-cypher-5" /> Cerrada
        </span>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        className="mt-4 w-full rounded-xl bg-cypher-2 py-3 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1"
      >
        Guardar disponibilidad {delta.length > 0 && `(${delta.length} cambio${delta.length === 1 ? "" : "s"})`}
      </button>

      <ConfirmModal
        isOpen={confirm !== null}
        title="Aplicar cambios de cancha"
        message={
          confirm && confirm.count > 0
            ? `Cerrando franjas en ${courtName} se aplazarán ${confirm.count} partido(s) futuros (quedarán pendientes de asignación de horario).${
                confirm.sample.length > 0 ? `\nAfectados: ${confirm.sample.join(", ")}${confirm.count > 3 ? "…" : ""}` : ""
              }\n\n¿Aplicar?`
            : `¿Aplicar los cambios de disponibilidad en ${courtName}?`
        }
        confirmText={mutation.isPending ? "Aplicando..." : "Aplicar"}
        variant="primary"
        onConfirm={() => confirm && mutation.mutate({ courtId, slots: confirm.slots })}
        onCancel={() => setConfirm(null)}
      />

      <Toast toast={toast} />
    </div>
  );
}