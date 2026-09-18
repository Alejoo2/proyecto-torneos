"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "torneos/components/ui/button/button";
import { DAY_LABELS, SLOT_LABELS } from "torneos/domain/schedule/labels";

// W5 — Re-skin del modal de creación de torneo (bottom sheet Cypher).
// Contrato: { courtId, isOpen, onClose, onCreate } + enmienda aditiva W5:
// submitError?: string | null — error inline del engine (patrón W4; no hay
// toast API). Lo muestra el template: se limpia al abrir y onSuccess.
// Capa: bottom sheet = 40 (la nav 50 flota encima — JAMÁS se tapa, doc 2.3/2.4).
// QA-W5: pb-28 interno — el form queda sobre la BottomNav (64px + safe-area).
// Espejos del zod de tournament.create:
//   · name.min(2) → deshabilita el submit.
//   · enrollmentDeadline futura (refine d > now) → se envía el FIN del día
//     elegido (23:59) para que "hoy" sea elegible.
//   · maxTeams potencia de 2 → solo opciones válidas.
// format/type no se exponen: SINGLE_ELIMINATION / PUBLIC (subconjunto válido —
// el front jamás ofrece lo que el engine rechaza).

export interface CreateTournamentInput {
  courtId: string;
  name: string;
  maxTeams: number;
  dayOfWeek: number;
  timeSlot: number;
  enrollmentDeadline: Date;
  format?: "SINGLE_ELIMINATION" | "LEAGUE" | "LEAGUE_PLUS_ELIMINATION";
  type?: "PUBLIC" | "PRIVATE";
  description?: string;
  startDate?: Date;
}

interface CreateTournamentModalProps {
  courtId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateTournamentInput) => void;
  /** Error del engine en línea (patrón W4). El dueño del estado es el template. */
  submitError?: string | null;
}

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-cypher-4/15 bg-cypher-5-1-1 px-4 text-sm text-cypher-4 placeholder:text-cypher-4-2-2 focus:border-cypher-2/60 focus:outline-none";
const LABEL_CLS = "mb-1 block text-xs font-medium text-cypher-4-2";

export function CreateTournamentModal({
  courtId,
  isOpen,
  onClose,
  onCreate,
  submitError,
}: CreateTournamentModalProps) {
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeSlot, setTimeSlot] = useState(9); // 18:00 - 20:00 por defecto
  const [deadline, setDeadline] = useState("");

  const trimmedName = name.trim();
  const deadlineAt = deadline ? new Date(`${deadline}T23:59:59`) : null;
  const isNameValid = trimmedName.length >= 2;
  const isDeadlineValid = deadlineAt !== null && deadlineAt.getTime() > Date.now();
  const canSubmit = isNameValid && isDeadlineValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || deadlineAt === null) return;
    onCreate({
      courtId,
      name: trimmedName,
      maxTeams,
      dayOfWeek,
      timeSlot,
      enrollmentDeadline: deadlineAt,
      format: "SINGLE_ELIMINATION",
      type: "PUBLIC",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-cypher-5/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Crear torneo en esta cancha"
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border-t border-cypher-4/10 bg-cypher-5-1 p-6 pb-28"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-cypher-4-2-2/40" />

            <h3 className="mb-4 text-base font-bold text-cypher-4">Crear torneo en esta cancha</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="tournament-name" className={LABEL_CLS}>
                  Nombre del torneo
                </label>
                <input
                  id="tournament-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Liga de Barrio 2026"
                  maxLength={100}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label htmlFor="tournament-max-teams" className={LABEL_CLS}>
                  Cupos máximos
                </label>
                <select
                  id="tournament-max-teams"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(Number(e.target.value))}
                  className={INPUT_CLS}
                >
                  <option value={4}>4 equipos</option>
                  <option value={8}>8 equipos</option>
                  <option value={16}>16 equipos</option>
                  <option value={32}>32 equipos</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tournament-day" className={LABEL_CLS}>
                    Día del torneo
                  </label>
                  <select
                    id="tournament-day"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className={INPUT_CLS}
                  >
                    {DAY_LABELS.map((day, i) => (
                      <option key={i} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tournament-slot" className={LABEL_CLS}>
                    Franja horaria
                  </label>
                  <select
                    id="tournament-slot"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(Number(e.target.value))}
                    className={INPUT_CLS}
                  >
                    {SLOT_LABELS.map((slot, i) => (
                      <option key={i} value={i}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tournament-deadline" className={LABEL_CLS}>
                  Cierra inscripción
                </label>
                <input
                  id="tournament-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className={INPUT_CLS}
                />
                {deadline && !isDeadlineValid && (
                  <p className="mt-1 text-xs text-red-400">La fecha límite debe ser futura.</p>
                )}
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-cypher-5-1 px-3 py-2 text-xs text-red-400"
                >
                  {submitError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="min-h-[48px] flex-1" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-[48px] flex-1" disabled={!canSubmit}>
                  Crear torneo
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}