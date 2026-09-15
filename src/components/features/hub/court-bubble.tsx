"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Trophy, X } from "lucide-react";

import { api } from "torneos/trpc/react";
import { DAY_SHORT, slotToLabel } from "torneos/lib/hub";

interface CourtBubbleProps {
  courtId: string | null;
  onClose: () => void;
}

// bottom-4/right-4 respecto al main (que ya termina donde empieza la nav
// o el CTA Entrar) → nunca se corta con nav. max-h reserva el espacio de
// search+filtros arriba → nunca los cruza.
const bubbleBase =
  "absolute bottom-4 right-4 z-sheet w-[320px] max-w-[calc(100%-1rem)] max-h-[calc(100%-8.5rem)] overflow-y-auto scrollbar-hide rounded-3xl border border-cypher-5-1-1 bg-cypher-5-1 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]";

export function CourtBubble({ courtId, onClose }: CourtBubbleProps) {
  const isOpen = courtId !== null;

  const { data: court } = api.court.getBubble.useQuery(
    { courtId: courtId ?? "" },
    { enabled: isOpen, staleTime: 60_000 },
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={bubbleBase}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{ transformOrigin: "bottom right" }}
        >
          {!court ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-cypher-5-1-1" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-cypher-5-1-1" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-cypher-5-1-1" />
                </div>
              </div>
              <div className="h-10 animate-pulse rounded-xl bg-cypher-5" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cypher-5-1-1 bg-cypher-5">
                  <svg className="h-6 w-6 text-cypher-4-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-1 8h1m-1-4h1m-1 4h1" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-cypher-4">{court.name}</h3>
                  <p className="truncate text-xs text-cypher-4-2">{court.address}</p>
                  <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium ${court.status === "ENABLED" ? "text-green-400" : "text-red-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${court.status === "ENABLED" ? "bg-green-500" : "bg-red-500"}`} />
                    {court.status === "ENABLED" ? "Habilitada" : "Deshabilitada"}
                  </span>
                </div>
                <button onClick={onClose} aria-label="Cerrar" className="-mr-1 -mt-1 p-1.5 text-cypher-4-2 transition-colors hover:text-cypher-4">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {court.description && (
                <p className="mb-3 line-clamp-2 text-xs text-cypher-4-2">{court.description}</p>
              )}

              {/* Torneos activos: máx 3 */}
              <section className="mb-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-cypher-4-2">Torneos activos</p>
                {court.tournaments.length === 0 ? (
                  <p className="rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-2.5 text-center text-xs text-cypher-4-2">
                    Sin torneos activos
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {court.tournaments.slice(0, 3).map((t) => (
                      <Link
                        key={t.id}
                        href={`/torneos/${t.id}`}
                        className="flex items-center gap-2.5 rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-2.5 transition-colors hover:bg-cypher-5-1-1"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cypher-5-1-1 text-cypher-4-2">
                          <Trophy className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-cypher-4">{t.name}</span>
                          <span className="block text-[10px] text-cypher-4-2">
                            {DAY_SHORT[t.dayOfWeek]} · {slotToLabel(t.timeSlot)} · {t.approvedTeams}/{t.maxTeams}
                          </span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cypher-4-2-2" />
                      </Link>
                    ))}
                    {court.tournaments.length > 3 && (
                      <p className="text-center text-[10px] text-cypher-4-2-2">
                        +{court.tournaments.length - 3} más en el detalle
                      </p>
                    )}
                  </div>
                )}
              </section>

              {court.inventory && (
                <p className="mb-3 truncate text-[11px] text-cypher-4-2-2">
                  <span className="uppercase tracking-wide">Implementos:</span> {court.inventory}
                </p>
              )}

              <Link
                href={`/canchas/${court.id}`}
                className="block w-full rounded-2xl bg-cypher-2 py-3 text-center text-sm font-medium text-cypher-5 transition-colors hover:bg-cypher-2-1 active:bg-cypher-2/90 glow-neon"
              >
                Ver Detalle de la Cancha
              </Link>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}