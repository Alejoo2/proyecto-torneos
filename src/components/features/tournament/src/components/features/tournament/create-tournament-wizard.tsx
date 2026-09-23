"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { api } from "torneos/trpc/react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { Button } from "torneos/components/ui/button/button";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { DAY_LABELS, SLOT_LABELS } from "torneos/domain/schedule/labels";
import { requiredSlotCount } from "torneos/domain/tournament-slots";

/**
 * W11 — E5: creación de torneo como PÁGINA (decisión del dueño — reemplaza al modal W5).
 * Paso 1: detalles (nombre/descripción/cupos/formato/tipo/deadline).
 * Paso 2: matriz semana tipo 7×12 de la cancha como selector — se marcan EXACTAMENTE
 *   requiredSlotCount(maxTeams) franjas libres (regla del dueño: 1 franja por partido;
 *   eliminación directa N→N−1). Déficit bloquea (sistema de capacidad).
 * La primera marca = franja principal (escalares dayOfWeek/timeSlot — vitrina/holds);
 * el resto va a TournamentSlot. PRIVATE: la invitación de equipos es post-creación
 * desde Gestión (E6) — necesita tournamentId, no cabe pre-creación.
 * El front jamás ofrece lo que el engine rechaza: solo canchas ENABLED, deadline
 * futura, celdas ocupadas no marcables; el error real del engine va inline (patrón W5).
 */

const MAX_TEAM_OPTIONS = [4, 8, 16, 32] as const;
// Lun→Dom en columnas (dayOfWeek 0=domingo — mismo orden que la matriz de perfil)
const COLUMN_DAYS = [1, 2, 3, 4, 5, 6, 0];
// Espejo exacto del conflicto del engine (tournament.engine.create, paso 4)
const OCCUPYING_STATUSES = ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"];

interface CreateTournamentWizardProps {
  initialCourtId: string | null;
}

export function CreateTournamentWizard({ initialCourtId }: CreateTournamentWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxTeams, setMaxTeams] = useState<number>(8);
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [courtId, setCourtId] = useState<string | null>(initialCourtId);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const managerQuery = api.admin.getMyManagerProfile.useQuery(undefined, { retry: false });
  const courtsQuery = api.court.list.useQuery(undefined, { retry: false });
  // Solo ENABLED: create rechaza canchas deshabilitadas
  const enabledCourts = useMemo(
    () => (courtsQuery.data ?? []).filter((c) => c.status === "ENABLED"),
    [courtsQuery.data],
  );

  // Ocupación semanal derivada de los torneos de la cancha (misma fuente que el
  // detalle de cancha para gestores). El engine re-valida cada franja al crear.
  const occupiedQuery = api.tournament.listByCourt.useQuery(
    { courtId: courtId ?? "" },
    { enabled: Boolean(courtId) && step === 2, retry: false },
  );
  const occupied = useMemo(() => {
    const set = new Set<string>();
    for (const t of occupiedQuery.data ?? []) {
      if (OCCUPYING_STATUSES.includes(t.status)) set.add(`${t.dayOfWeek}|${t.timeSlot}`);
    }
    return set;
  }, [occupiedQuery.data]);

  const required = requiredSlotCount(maxTeams);

  const deadlineAt = deadline ? new Date(`${deadline}T23:59:59`) : null;
  const isDeadlineValid = deadlineAt !== null && deadlineAt.getTime() > Date.now();
  const isNameValid = name.trim().length >= 2 && name.trim().length <= 100;
  const step1Valid = isNameValid && isDeadlineValid;
  const step2Valid = courtId !== null && marked.size === required;

  const toggleSlot = (dayOfWeek: number, timeSlot: number) => {
    const key = `${dayOfWeek}|${timeSlot}`;
    if (occupied.has(key)) return; // ocupada = no ofrecida
    setMarked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else if (next.size < required) next.add(key);
      return next;
    });
  };

  const createMutation = api.tournament.create.useMutation({
    onSuccess: (tournament) => {
      router.push(`/torneos/${tournament.id}/gestion`);
    },
    onError: (e) => setSubmitError(e.message),
  });

  const handleCreate = () => {
    if (!step2Valid || !courtId || deadlineAt === null) return;
    const keys = [...marked];
    const firstKey = keys[0];
    if (!firstKey) return;
    const [dRaw, sRaw] = firstKey.split("|");
    if (!dRaw || !sRaw) return;
    createMutation.mutate({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      courtId,
      maxTeams,
      type,
      format: "SINGLE_ELIMINATION",
      enrollmentDeadline: deadlineAt,
      dayOfWeek: Number(dRaw),
      timeSlot: Number(sRaw),
      slots: keys.map((k) => {
        const [d, s] = k.split("|");
        return { dayOfWeek: Number(d), timeSlot: Number(s) };
      }),
    });
  };

  if (managerQuery.isLoading || courtsQuery.isLoading) {
    return <LoadingSkeleton variant="card" rows={5} className="pt-14" />;
  }

  if (!managerQuery.data) {
    return (
      <div className="pt-14 pb-28">
        <HeaderTitle title="Crear torneo" />
        <div className="px-4 pt-16">
          <EmptyState
            icon={<Lock className="size-8" />}
            title="Se requiere perfil de gestor"
            description="Solo los gestores activos pueden crear torneos."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Crear torneo" />

      <div className="px-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-cypher-4-2-2">
          Paso {step} de 2 — {step === 1 ? "Detalles" : "Cancha y horario"}
        </p>

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="wt-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                Nombre
              </label>
              <input
                id="wt-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Ej: Liga de Barrio 2026"
                className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
              />
            </div>

            <div>
              <label htmlFor="wt-desc" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                Descripción (opcional)
              </label>
              <textarea
                id="wt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wt-max" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                  Cupos
                </label>
                <select
                  id="wt-max"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(Number(e.target.value))}
                  className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none focus:border-cypher-4-2"
                >
                  {MAX_TEAM_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} equipos</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wt-deadline" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                  Cierra inscripción
                </label>
                <input
                  id="wt-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none [color-scheme:dark] focus:border-cypher-4-2"
                />
                {deadline && !isDeadlineValid && (
                  <p className="mt-1 text-xs text-red-400">La fecha límite debe ser futura.</p>
                )}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                Formato
              </span>
              <p className="rounded-xl bg-cypher-5-1-1 px-3 py-2 text-xs text-cypher-4-2">
                Eliminación directa — único formato disponible por ahora.
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                Visibilidad
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={type === "PUBLIC"}
                  onClick={() => setType("PUBLIC")}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    type === "PUBLIC" ? "border-cypher-2 bg-cypher-5-1-1" : "border-cypher-4/10"
                  }`}
                >
                  <span className="block text-sm font-semibold text-cypher-4">Público</span>
                  <span className="text-[10px] text-cypher-4-2-2">Aparece en la vitrina</span>
                </button>
                <button
                  type="button"
                  aria-pressed={type === "PRIVATE"}
                  onClick={() => setType("PRIVATE")}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    type === "PRIVATE" ? "border-cypher-2 bg-cypher-5-1-1" : "border-cypher-4/10"
                  }`}
                >
                  <span className="block text-sm font-semibold text-cypher-4">Privado</span>
                  <span className="text-[10px] text-cypher-4-2-2">Solo por invitación</span>
                </button>
              </div>
              {type === "PRIVATE" && (
                <p className="mt-1.5 text-[11px] text-cypher-4-2-2">
                  Tras crear el torneo invitarás a los equipos desde su página de gestión.
                </p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="wt-court" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
                Cancha
              </label>
              <select
                id="wt-court"
                value={courtId ?? ""}
                onChange={(e) => {
                  setCourtId(e.target.value === "" ? null : e.target.value);
                  setMarked(new Set());
                }}
                className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none focus:border-cypher-4-2"
              >
                <option value="">Elegir cancha…</option>
                {enabledCourts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {enabledCourts.length === 0 && (
                <p className="mt-1 text-xs text-cypher-4-2-2">
                  No hay canchas habilitadas — solo el admin puede habilitarlas.
                </p>
              )}
            </div>

            {courtId && (
              <>
                <p className="text-xs text-cypher-4-2-2">
                  Marca las franjas semanales del torneo: <span className="font-semibold text-cypher-4">
                    {marked.size}/{required}
                  </span>{" "}
                  ({maxTeams} equipos → {required} partidos en eliminación directa).
                  {marked.size !== required && " Ajusta las marcas para continuar."}
                </p>

                <div className="overflow-x-auto rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-3">
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1">
                      <div />
                      {COLUMN_DAYS.map((d) => (
                        <div key={d} className="text-center text-[10px] font-semibold text-cypher-4-2">
                          {DAY_LABELS[d]?.slice(0, 3) ?? ""}
                        </div>
                      ))}
                      {SLOT_LABELS.map((label, slot) => (
                        <Fragment key={slot}>
                          <div className="pr-1 text-right text-[9px] tabular-nums leading-8 text-cypher-4-2-2">
                            {label}
                          </div>
                          {COLUMN_DAYS.map((day) => {
                            const key = `${day}|${slot}`;
                            const isOccupied = occupied.has(key);
                            const isMarked = marked.has(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={isOccupied}
                                aria-pressed={isMarked}
                                aria-label={`${DAY_LABELS[day] ?? ""} ${label}`}
                                onClick={() => toggleSlot(day, slot)}
                                className={[
                                  "h-8 rounded-md border transition-colors",
                                  isOccupied
                                    ? "cursor-not-allowed border-cypher-4/5 bg-cypher-5 opacity-40"
                                    : isMarked
                                      ? "border-cypher-2 bg-cypher-3"
                                      : "border-cypher-4/10 bg-cypher-5-1-1 active:bg-cypher-5",
                                ].join(" ")}
                              />
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-cypher-4-2-2">
                    <span className="size-3 rounded border border-cypher-2 bg-cypher-3" /> Marcada
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-cypher-4-2-2">
                    <span className="size-3 rounded border border-cypher-4/10 bg-cypher-5-1-1" /> Libre
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-cypher-4-2-2">
                    <span className="size-3 rounded border border-cypher-4/5 bg-cypher-5" /> Ocupada por otro torneo
                  </span>
                </div>
              </>
            )}

            {submitError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-cypher-5-1 px-3 py-2 text-xs text-red-400">
                {submitError}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button
                className="flex-1"
                disabled={!step2Valid || createMutation.isPending}
                onClick={handleCreate}
              >
                {createMutation.isPending ? "Creando…" : "Crear torneo"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}