"use client";

import Link from "next/link";

import { api } from "torneos/trpc/react";
import { DAY_SHORT, SLOTS_PER_DAY, slotToLabel } from "torneos/lib/hub";

interface CourtBubbleProps {
  courtId: string | null;
  onClose: () => void;
}

const bubbleBase =
  "court-bubble absolute bottom-24 left-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)]";

export function CourtBubble({ courtId, onClose }: CourtBubbleProps) {
  const isOpen = courtId !== null;

  const { data: court } = api.court.getBubble.useQuery(
    { courtId: courtId ?? "" },
    { enabled: isOpen, staleTime: 60_000 },
  );

  // ─── Skeleton mientras carga ───
  if (!court) {
    return (
      <div className={`${bubbleBase} ${isOpen ? "court-bubble--open" : ""}`} aria-hidden>
        <div className="court-bubble__tail" />
        <div className="mb-4 flex items-center gap-4">
          <div className="skeleton-pulse h-16 w-16 rounded-2xl bg-zinc-200" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-pulse h-4 w-3/4 rounded bg-zinc-200" />
            <div className="skeleton-pulse h-3 w-1/2 rounded bg-zinc-100" />
          </div>
        </div>
        <div className="skeleton-pulse h-28 rounded-xl bg-zinc-100" />
        <div className="skeleton-pulse mt-3 h-20 rounded-xl bg-zinc-100" />
      </div>
    );
  }

  // ─── Contenido real ───
  return (
    <div className={`${bubbleBase} ${isOpen ? "court-bubble--open" : ""}`}>
      <div className="court-bubble__tail" />

      {/* Header */}
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-zinc-200 bg-zinc-100">
          <svg className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-1 8h1m-1-4h1m-1 4h1" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-zinc-900">{court.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">{court.address}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${court.status === "ENABLED" ? "bg-green-500" : "bg-red-500"}`} />
            <p className={`text-xs font-medium ${court.status === "ENABLED" ? "text-green-600" : "text-red-600"}`}>
              {court.status === "ENABLED" ? "Habilitada" : "Deshabilitada"}
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-2 p-1 text-zinc-400 hover:text-zinc-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {court.description && <p className="mb-4 text-xs text-zinc-600">{court.description}</p>}

      {/* Matriz de disponibilidad: 12 franjas × 7 días */}
      <section className="mb-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Disponibilidad próximos 7 días
        </p>
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
          <div className="mb-1 grid grid-cols-[32px_repeat(7,1fr)] gap-1">
            <span />
            {court.days.map((day) => (
              <span key={day.date} className="text-center text-[9px] font-semibold uppercase text-zinc-400">
                {DAY_SHORT[day.dayOfWeek]}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {Array.from({ length: SLOTS_PER_DAY }, (_, timeSlot) => (
              <div key={timeSlot} className="grid grid-cols-[32px_repeat(7,1fr)] items-center gap-1">
                <span className="pr-1 text-right text-[8px] text-zinc-400">{timeSlot * 2}h</span>
                {court.days.map((day) => (
                  <span
                    key={`${day.date}-${timeSlot}`}
                    title={day.slots[timeSlot]?.isFree ? "Disponible" : "Ocupada"}
                    className={`h-4 rounded-sm ${day.slots[timeSlot]?.isFree ? "bg-green-400/80" : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[9px] text-zinc-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-400/80" /> Libre</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-zinc-200" /> Ocupada</span>
          </div>
        </div>
      </section>

      {/* Torneos activos */}
      <section className="mb-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Torneos activos</p>
        {court.tournaments.length === 0 ? (
          <p className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center text-xs text-zinc-400">
            Sin torneos activos
          </p>
        ) : (
          <div className="space-y-2">
            {court.tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/torneos/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:bg-zinc-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs">🏆</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-zinc-900">{t.name}</span>
                  <span className="block text-[10px] text-zinc-500">
                    {DAY_SHORT[t.dayOfWeek]} · {slotToLabel(t.timeSlot)} · {t.approvedTeams}/{t.maxTeams} equipos
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Implementos + CTA */}
      <section className="mb-4">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Implementos</p>
        <p className="text-xs text-zinc-600">{court.inventory ?? "Sin inventario registrado"}</p>
      </section>

      <Link
        href={`/canchas/${court.id}`}
        className="block w-full rounded-2xl bg-zinc-800 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-900"
      >
        Ver Detalle de la Cancha
      </Link>
    </div>
  );
}