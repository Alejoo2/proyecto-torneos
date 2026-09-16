"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react";
import { Badge } from "torneos/components/ui/badge";
import { Button } from "torneos/components/ui/button/button";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { TeamChip } from "torneos/components/ui/team-chip";
import { STAT_FIELDS, expectedGoals, type StatFieldKey } from "torneos/domain/stat-fields";
import { cn } from "torneos/lib/utils";
import { PlayerGrid } from "./player-grid";
import type { CallUpItem } from "./types";

export type ResultStats = Record<StatFieldKey, number>;

export interface ResultPayload {
  homeScore: number;
  awayScore: number;
  notes?: string;
  playerStats: ({ playerId: string; teamId: string } & ResultStats)[];
}

/** Borrador automático (persistencia invisible): se escribe en cada cambio y se
 *  limpia desde el template cuando la mutación tiene éxito (onSuccess). */
export function resultDraftKey(matchId: string): string {
  return `result-draft:${matchId}`;
}

const zeroStats = (): ResultStats => ({
  goals: 0, blueCards: 0, yellowCards: 0, redCards: 0, fouls: 0, ownGoals: 0,
});
const clamp = (v: number) => Math.min(99, Math.max(0, Number.isFinite(v) ? v : 0));

interface ResultWizardProps {
  matchId: string;
  homeTeam: { id: string; name: string; abbreviation: string; primaryColor: string };
  awayTeam: { id: string; name: string; abbreviation: string; primaryColor: string };
  callUps: CallUpItem[];
  isPending?: boolean;
  onSubmit: (payload: ResultPayload) => void;
  /** Aviso de paso (el template oculta el selector de árbitro en stats) */
  onStepChange?: (step: "score" | "stats") => void;
  className?: string;
}

function Stepper({
  label, value, onChange, accent, disablePlus = false, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
  /** Capacidad agotada: bloquea SOLO sumar; restar siempre habilitado. */
  disablePlus?: boolean;
  /** Tope también para el input tecleado (value + capacidad restante). */
  max?: number;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-cypher-5 p-1.5",
      accent ? "border-amber-400/40" : "border-cypher-5-1-1",
    )}>
      <span className="block text-center text-[9px] font-bold uppercase tracking-wider text-cypher-4-2-2">
        {label}
      </span>
      <div className="mt-1 flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label={`Restar ${label}`}
          onClick={() => onChange(value - 1)}
          className="flex size-6 items-center justify-center rounded-md border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 active:bg-cypher-5-1-1"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          aria-label={label}
          onChange={(e) => {
            const parsed = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 2) || "0");
            onChange(clamp(max !== undefined ? Math.min(parsed, max) : parsed));
          }}
          className="w-8 rounded-md border border-cypher-5-1-1 bg-cypher-5 py-0.5 text-center font-mono text-xs tabular-nums text-cypher-4 outline-none focus:border-cypher-2"
        />
        <button
          type="button"
          aria-label={`Sumar ${label}`}
          disabled={disablePlus}
          onClick={() => onChange(value + 1)}
          className="flex size-6 items-center justify-center rounded-md border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 active:bg-cypher-5-1-1 disabled:opacity-40 disabled:active:bg-cypher-5"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}

/** Panel acordeón de un jugador. El switch de autogol redirige el stepper "Goles"
 *  a ownGoals; es efímero (remount por key al cambiar de jugador → default off).
 *  Goles y autogol comparten la capacidad de su lado: sumar se bloquea al agotarse;
 *  restar jamás. "Aceptar" marca la celda (no toggle) y cierra. */
function PlayerStatPanel({
  callUp, teamAbbreviation, values, onChange, onAccept, onClose,
  goalsRemaining, rivalGoalsRemaining,
}: {
  callUp: CallUpItem;
  teamAbbreviation: string;
  values: ResultStats;
  onChange: (field: StatFieldKey, v: number) => void;
  onAccept: () => void;
  onClose: () => void;
  /** Capacidad restante del equipo del jugador (para goles). */
  goalsRemaining: number;
  /** Capacidad restante del rival (los autogoles suman al marcador rival). */
  rivalGoalsRemaining: number;
}) {
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const name = callUp.player.profile.displayName ?? "Jugador";
  const editableFields = STAT_FIELDS.filter((f) => f.field !== "ownGoals");
  // El switch solo se bloquea si el rival no tiene capacidad Y este jugador no
  // registra autogoles (si registra, volver al modo goles debe seguir posible).
  const ogSwitchDisabled = rivalGoalsRemaining <= 0 && values.ownGoals === 0;

  return (
    <div
      ref={ref}
      className="col-span-full rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-3"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <PlayerAvatar profile={{ displayName: name, image: callUp.player.profile.user.image }} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cypher-4">{name}</span>
        <span className="rounded-full bg-cypher-5-1-1 px-2 py-0.5 text-[9px] font-bold text-cypher-4-2">
          {teamAbbreviation}
        </span>
        <button
          type="button"
          aria-label={`Cerrar estadísticas de ${name}`}
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-cypher-4-2 active:bg-cypher-5-1-1"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {editableFields.map((f) =>
          f.field === "goals" ? (
            <div key={f.field}>
              <Stepper
                label={isOwnGoal ? "Autogol" : f.label}
                value={isOwnGoal ? values.ownGoals : values.goals}
                onChange={(v) => onChange(isOwnGoal ? "ownGoals" : "goals", v)}
                accent={isOwnGoal}
                disablePlus={isOwnGoal ? rivalGoalsRemaining <= 0 : goalsRemaining <= 0}
                max={isOwnGoal
                  ? values.ownGoals + Math.max(0, rivalGoalsRemaining)
                  : values.goals + Math.max(0, goalsRemaining)}
              />
              <label className={cn(
                "mt-1 flex items-center justify-center gap-1 text-[9px]",
                ogSwitchDisabled ? "text-cypher-4-2-2 opacity-50" : "text-cypher-4-2",
              )}>
                <input
                  type="checkbox"
                  checked={isOwnGoal}
                  disabled={ogSwitchDisabled}
                  onChange={(e) => setIsOwnGoal(e.target.checked)}
                  className="size-3 accent-cypher-2"
                />
                Autogol
              </label>
            </div>
          ) : (
            <Stepper
              key={f.field}
              label={f.label}
              value={values[f.field]}
              onChange={(v) => onChange(f.field, v)}
            />
          ),
        )}
      </div>

      <Button size="sm" className="mt-2.5 w-full" onClick={onAccept}>
        Aceptar
      </Button>
    </div>
  );
}

export function ResultWizard({
  matchId, homeTeam, awayTeam, callUps, isPending = false, onSubmit, onStepChange, className,
}: ResultWizardProps) {
  const [step, setStep] = useState<"score" | "stats">("score");
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [stats, setStats] = useState<Record<string, ResultStats>>({});
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(new Set());
  // "Aceptar" por jugador: NO toggle (una vez marcado, queda marcado aunque edite)
  const [readys, setReadys] = useState<Set<string>>(new Set());
  const [confirmScoreOpen, setConfirmScoreOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  // Gate de restauración por ESTADO, jamás por ref (lección 5: StrictMode monta 2×)
  const [hydrated, setHydrated] = useState(false);
  const saveConfirmRef = useRef<HTMLDivElement>(null);

  // Ausentes NO aparecen (decisión): ni en la grilla ni en el payload.
  const present = useMemo(() => callUps.filter((c) => !c.isAbsent), [callUps]);

  const statOf = (playerId: string): ResultStats => stats[playerId] ?? zeroStats();
  const setStat = (playerId: string, field: StatFieldKey, v: number) =>
    setStats((prev) => {
      const cur = prev[playerId] ?? zeroStats();
      return { ...prev, [playerId]: { ...cur, [field]: clamp(v) } };
    });

  const goto = (next: "score" | "stats") => {
    setStep(next);
    onStepChange?.(next);
  };

  // ── Borrador: restaurar UNA vez al montar (merge por playerId; lo que ya no
  //    está en la convocatoria se descarta, lo nuevo entra en ceros) ──
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(resultDraftKey(matchId));
      if (raw) {
        const d = JSON.parse(raw) as Partial<{
          step: "score" | "stats";
          score: { home: number; away: number };
          confirmed: boolean;
          notes: string;
          readys: string[];
          stats: Record<string, Partial<ResultStats>>;
        }>;
        if (d.score) setScore({ home: clamp(d.score.home ?? 0), away: clamp(d.score.away ?? 0) });
        if (d.confirmed) setConfirmed(true);
        if (d.notes) setNotes(d.notes);
        const presentIds = new Set(present.map((c) => c.playerId));
        if (Array.isArray(d.readys)) setReadys(new Set(d.readys.filter((id) => presentIds.has(id))));
        if (d.stats) {
          setStats((prev) => {
            const next = { ...prev };
            for (const c of present) {
              const saved = d.stats?.[c.playerId];
              if (saved) next[c.playerId] = { ...zeroStats(), ...saved };
            }
            return next;
          });
        }
        // step se restaura solo si el flujo lo permite (stats exige marcador confirmado)
        if (d.step === "stats" && d.confirmed) {
          setStep("stats");
          onStepChange?.("stats");
        }
      }
    } catch {
      /* borrador corrupto o storage no disponible: se ignora, nunca bloquea */
    }
    setHydrated(true);
    // Restauración única por montaje (el template usa key={match.id})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Borrador: persistir en cada cambio (solo tras hydration commit) ──
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload = {
        step, score, confirmed, notes,
        readys: [...readys],
        stats: Object.fromEntries(
          present.map((c) => [c.playerId, stats[c.playerId] ?? zeroStats()]),
        ),
      };
      window.localStorage.setItem(resultDraftKey(matchId), JSON.stringify(payload));
    } catch {
      /* enhancement: sin storage el wizard funciona igual */
    }
  }, [hydrated, step, score, confirmed, notes, readys, stats, present, matchId]);

  // ── Capacidad de goles: SIEMPRE derivada, nunca almacenada. Fuente única de
  //    verdad = marcador confirmado − suma asignada (fórmula expectedGoals del
  //    dominio). El exceso es imposible de construir (steppers limitados); el
  //    déficit bloquea el guardado. ──
  const goalRows = useMemo(
    () =>
      present.map((c) => {
        const s = stats[c.playerId] ?? zeroStats();
        return { teamId: c.teamId, goals: s.goals, ownGoals: s.ownGoals };
      }),
    [present, stats],
  );
  const homeExpected = expectedGoals(homeTeam.id, awayTeam.id, goalRows);
  const awayExpected = expectedGoals(awayTeam.id, homeTeam.id, goalRows);
  const homeRemaining = score.home - homeExpected;
  const awayRemaining = score.away - awayExpected;
  const remainingOf = (teamId: string) =>
    teamId === homeTeam.id ? homeRemaining : awayRemaining;
  // Convocatoria vacía: no hay stats que reconciliar → el marcador es la verdad.
  const goalsComplete = present.length === 0 || (homeRemaining === 0 && awayRemaining === 0);

  // ── Summary en vivo: dos columnas (izq = suma al marcador local, der = visitante).
  //    El autogol de un jugador aparece en la columna del RIVAL. ──
  interface SummaryEntry { key: string; label: string; }
  const { homeEntries, awayEntries } = useMemo(() => {
    const homeEntries: SummaryEntry[] = [];
    const awayEntries: SummaryEntry[] = [];
    for (const c of present) {
      const s = stats[c.playerId] ?? zeroStats();
      const name = c.player.profile.displayName ?? "Jugador";
      if (s.goals > 0) {
        (c.teamId === homeTeam.id ? homeEntries : awayEntries).push({
          key: `${c.playerId}:g`, label: `${name} ×${s.goals}`,
        });
      }
      if (s.ownGoals > 0) {
        (c.teamId === homeTeam.id ? awayEntries : homeEntries).push({
          key: `${c.playerId}:og`, label: `${name} (OG) ×${s.ownGoals}`,
        });
      }
    }
    return { homeEntries, awayEntries };
  }, [present, stats, homeTeam.id]);

  // La confirmación inline vive al final del formulario: llevarla a la vista
  useEffect(() => {
    if (saveConfirmOpen) {
      saveConfirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [saveConfirmOpen]);

  const changeScore = (side: "home" | "away", delta: number) =>
    setScore((s) => ({ ...s, [side]: clamp(s[side] + delta) }));

  const toggleTeam = (teamId: string) => {
    const willOpen = !openTeamIds.has(teamId);
    setOpenTeamIds((prev) => {
      const n = new Set(prev);
      if (willOpen) n.add(teamId);
      else n.delete(teamId);
      return n;
    });
    if (!willOpen && present.some((c) => c.teamId === teamId && c.playerId === openPlayerId)) {
      setOpenPlayerId(null);
    }
  };

  const acceptPlayer = (playerId: string) => {
    setReadys((prev) => {
      const n = new Set(prev);
      n.add(playerId);
      return n;
    });
    setOpenPlayerId(null);
  };

  const handleSave = () => {
    setSaveConfirmOpen(false);
    onSubmit({
      homeScore: score.home,
      awayScore: score.away,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      playerStats: present.map((c) => ({
        playerId: c.playerId, teamId: c.teamId, ...(stats[c.playerId] ?? zeroStats()),
      })),
    });
  };

  // Razón de bloqueo del guardado (déficit o exceso legacy de un draft viejo)
  const saveBlockReason = (() => {
    if (homeRemaining < 0 || awayRemaining < 0) {
      return "Los goles exceden el marcador · ajusta la plantilla";
    }
    const parts: string[] = [];
    if (homeRemaining > 0) parts.push(`${homeTeam.abbreviation} +${homeRemaining}`);
    if (awayRemaining > 0) parts.push(`${awayTeam.abbreviation} +${awayRemaining}`);
    return parts.length > 0 ? `Goles por asignar — ${parts.join(" · ")}` : "";
  })();

  const renderEntries = (entries: SummaryEntry[], align: "start" | "end") => (
    <div className={cn("flex max-w-[45%] flex-col gap-0.5", align === "end" ? "items-end" : "items-start")}>
      {entries.length === 0 ? (
        <span className="text-[10px] text-cypher-4-2-2">—</span>
      ) : (
        entries.map((e) => (
          <span
            key={e.key}
            className="max-w-[150px] truncate rounded-full bg-cypher-5-1-1 px-2 py-0.5 text-[9px] text-cypher-4-2"
          >
            {e.label}
          </span>
        ))
      )}
    </div>
  );

  return (
    <section className={cn("rounded-2xl bg-cypher-5-1 p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
          {step === "score" ? "Cargar resultado" : "Estadísticas del partido"}
        </h3>
        {confirmed && <Badge variant="success" status="Confirmado" />}
      </div>

      {step === "score" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <TeamChip team={homeTeam} className="min-w-0" />
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Restar gol local"
                disabled={confirmed}
                onClick={() => changeScore("home", -1)}
                className="flex size-7 items-center justify-center rounded-lg border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 disabled:opacity-40 active:bg-cypher-5-1-1"
              >
                <Minus className="size-3.5" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Goles local"
                value={score.home}
                disabled={confirmed}
                onChange={(e) => setScore((s) => ({ ...s, home: clamp(Number(e.target.value.replace(/[^\d]/g, "").slice(0, 2) || "0")) }))}
                className="w-11 rounded-lg border border-cypher-5-1-1 bg-cypher-5 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-cypher-4 outline-none focus:border-cypher-2 disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Sumar gol local"
                disabled={confirmed}
                onClick={() => changeScore("home", 1)}
                className="flex size-7 items-center justify-center rounded-lg border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 disabled:opacity-40 active:bg-cypher-5-1-1"
              >
                <Plus className="size-3.5" />
              </button>
              <span className="px-0.5 font-mono text-sm text-cypher-4-2-2">–</span>
              <button
                type="button"
                aria-label="Restar gol visitante"
                disabled={confirmed}
                onClick={() => changeScore("away", -1)}
                className="flex size-7 items-center justify-center rounded-lg border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 disabled:opacity-40 active:bg-cypher-5-1-1"
              >
                <Minus className="size-3.5" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Goles visitante"
                value={score.away}
                disabled={confirmed}
                onChange={(e) => setScore((s) => ({ ...s, away: clamp(Number(e.target.value.replace(/[^\d]/g, "").slice(0, 2) || "0")) }))}
                className="w-11 rounded-lg border border-cypher-5-1-1 bg-cypher-5 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-cypher-4 outline-none focus:border-cypher-2 disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Sumar gol visitante"
                disabled={confirmed}
                onClick={() => changeScore("away", 1)}
                className="flex size-7 items-center justify-center rounded-lg border border-cypher-5-1-1 bg-cypher-5 text-cypher-4 disabled:opacity-40 active:bg-cypher-5-1-1"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <TeamChip team={awayTeam} className="min-w-0 flex-row-reverse" />
          </div>

          {present.length === 0 && (
            <p className="mt-3 text-center text-xs text-cypher-4-2-2">
              Sin convocatoria: se guardará solo el marcador.
            </p>
          )}

          {confirmed ? (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => goto("stats")}>
              Cargar estadísticas →
            </Button>
          ) : (
            <Button className="mt-4 w-full" size="lg" disabled={isPending} onClick={() => setConfirmScoreOpen(true)}>
              Confirmar resultado
            </Button>
          )}
        </>
      ) : (
        <>
          {/* Marcador vivo: sumatoria en blanco, verde por lado al completarse.
              Debajo, placeholder del marcador fijado (referencia). */}
          <div className="rounded-xl bg-cypher-5 px-3 py-2.5">
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs font-semibold text-cypher-4">{homeTeam.abbreviation}</span>
              <span className={cn(
                "font-mono text-xl font-bold tabular-nums",
                homeRemaining === 0 ? "text-emerald-400" : "text-cypher-4",
              )}>
                {homeExpected}
              </span>
              <span className="font-mono text-sm text-cypher-4-2-2">–</span>
              <span className={cn(
                "font-mono text-xl font-bold tabular-nums",
                awayRemaining === 0 ? "text-emerald-400" : "text-cypher-4",
              )}>
                {awayExpected}
              </span>
              <span className="text-xs font-semibold text-cypher-4">{awayTeam.abbreviation}</span>
            </div>
            <p className="mt-0.5 text-center text-[10px] text-cypher-4-2-2">
              Marcador fijado: {score.home} – {score.away}
            </p>
          </div>

          {/* Summary de anotadores: izq suma al local, der al visitante; el
              autogol aparece en la columna contraria */}
          {(homeEntries.length > 0 || awayEntries.length > 0) && (
            <div className="mt-2 flex items-start justify-center gap-6 rounded-xl bg-cypher-5 px-3 py-2">
              {renderEntries(homeEntries, "start")}
              {renderEntries(awayEntries, "end")}
            </div>
          )}

          {/* Acordeones por equipo: colapsados al entrar, header bg-cypher-3,
              apertura independiente (un solo panel de jugador en toda la pantalla) */}
          <div className="mt-3 space-y-3">
            {[homeTeam, awayTeam].map((team) => {
              const teamPlayers = present.filter((c) => c.teamId === team.id);
              const teamOpen = openTeamIds.has(team.id);
              const rivalTeamId = team.id === homeTeam.id ? awayTeam.id : homeTeam.id;

              return (
                <div key={team.id}>
                  <button
                    type="button"
                    aria-expanded={teamOpen}
                    onClick={() => toggleTeam(team.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-cypher-1 px-3 py-2 text-left"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-cypher-4">
                      {team.name} · {teamPlayers.length}
                    </span>
                    {teamOpen
                      ? <ChevronUp className="size-3.5 text-cypher-4-2" />
                      : <ChevronDown className="size-3.5 text-cypher-4-2" />}
                  </button>

                  {teamOpen && (
                    <div className="mt-2">
                      {teamPlayers.length === 0 ? (
                        <p className="rounded-lg bg-cypher-5 px-3 py-2 text-[11px] text-cypher-4-2-2">
                          Sin convocados presentes.
                        </p>
                      ) : (
                        <PlayerGrid
                          players={teamPlayers.map((c) => ({
                            playerId: c.playerId,
                            name: c.player.profile.displayName ?? "Jugador",
                            image: c.player.profile.user.image,
                            ready: readys.has(c.playerId),
                          }))}
                          openPlayerId={openPlayerId}
                          onTogglePlayer={(pid) =>
                            setOpenPlayerId((cur) => (cur === pid ? null : pid))
                          }
                          columns={4}
                          renderPanel={(p) => {
                            const callUp = teamPlayers.find((c) => c.playerId === p.playerId);
                            if (!callUp) return null;
                            return (
                              <PlayerStatPanel
                                callUp={callUp}
                                teamAbbreviation={team.abbreviation}
                                values={statOf(p.playerId)}
                                goalsRemaining={remainingOf(team.id)}
                                rivalGoalsRemaining={remainingOf(rivalTeamId)}
                                onChange={(field, v) => setStat(p.playerId, field, v)}
                                onAccept={() => acceptPlayer(p.playerId)}
                                onClose={() => setOpenPlayerId(null)}
                              />
                            );
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-cypher-4-2-2">Los ausentes no aparecen.</p>

          <textarea
            value={notes}
            maxLength={500}
            rows={2}
            placeholder="Observaciones (opcional)"
            onChange={(e) => setNotes(e.target.value)}
            className="mt-3 w-full resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5 px-3 py-2 text-xs text-cypher-4 outline-none placeholder:text-cypher-4-2-2 focus:border-cypher-2"
          />

          {/* SaveBar sticky: el guardado exige sumas completas (0 restantes por lado) */}
          <div className="sticky bottom-4 z-20 mt-4 rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1/95 p-3 shadow-lg shadow-black/40">
            <div className="flex items-center gap-3">
              <p className="flex-1 text-[10px] text-cypher-4-2">
                {goalsComplete ? `${present.length} jugadores en la plantilla` : saveBlockReason}
              </p>
              <Button
                size="sm"
                disabled={isPending || !goalsComplete}
                onClick={() => setSaveConfirmOpen(true)}
              >
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>

          {/* Confirmación de guardado: inline al final del formulario, no flotante.
              (Inalcanzable con goles incompletos: el botón está bloqueado.) */}
          {saveConfirmOpen && (
            <div ref={saveConfirmRef} className="mt-3 rounded-2xl border border-cypher-5-1-1 bg-cypher-5 p-4">
              <p className="text-sm font-semibold text-cypher-4">
                {homeTeam.name} {score.home} – {score.away} {awayTeam.name}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-cypher-4-2">
                {present.length} jugadores · el partido pasará a Finalizado; la acción es definitiva.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={isPending} onClick={handleSave}>
                  {isPending ? "Guardando…" : "Enviar plantilla"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSaveConfirmOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Doble confirmación del score: única confirmación flotante (ratificada) */}
      <ConfirmModal
        isOpen={confirmScoreOpen}
        title="Confirmar resultado"
        message={`${homeTeam.name} ${score.home} – ${score.away} ${awayTeam.name}\nEl marcador quedará fijado y pasarás a las estadísticas. Nada se envía al servidor todavía.`}
        confirmText="Fijar marcador"
        variant="danger"
        onConfirm={() => {
          setConfirmScoreOpen(false);
          setConfirmed(true);
        }}
        onCancel={() => setConfirmScoreOpen(false)}
      />
    </section>
  );
}