"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, History, UserPlus } from "lucide-react";
import { api } from "torneos/trpc/react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { TabBar } from "torneos/components/ui/tab-bar";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";
import { useMyProfile, useToggleSlot, useUpdateProfile } from "torneos/components/features/profile/use-profile";
import { StatCard } from "torneos/components/features/profile/stat-card";
import { TeamPill } from "torneos/components/features/profile/team-pill";
import { MatchHistoryRow } from "torneos/components/features/profile/match-history-row";

const TABS = [
  { id: "stats", label: "Estadísticas" },
  { id: "edit", label: "Editar perfil" },
  { id: "schedule", label: "Disponibilidad" },
] as const;

// Época/locale fijos: Bogotá (decisión vigente). Sin Date.now() a nivel de módulo.
const DATE_FMT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MAX_TEAM_PILLS = 3;

/** W9 — Perfil (wireframe del dueño): header (avatar+nombre+bio+chips de equipos)
 *  + 3 tabs (Estadísticas / Editar / Disponibilidad). Patrón A: el RSC siembra
 *  las 4 lecturas; este template vive en Capa 2. Hooks de use-profile.ts INTACTOS. */
export function ProfileView() {
  const { data: session } = useSession();
  const { data: profile, isLoading } = useMyProfile();
  const { mutate: toggleSlot } = useToggleSlot();
  const { mutate: updateProfile } = useUpdateProfile();

  const myStatsQuery = api.stats.getMyStats.useQuery(undefined, { retry: false });
  const teamsQuery = api.team.getMyTeams.useQuery(undefined, { retry: false });
  const historyQuery = api.stats.getMyMatchHistory.useQuery(undefined, { retry: false });

  const [tab, setTab] = useState<string>("stats");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [toast, setToast] = useState<{ title: string; subtitle?: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (title: string, subtitle?: string) => setToast({ title, subtitle });

  // Formulario (espejo exacto del zod de profile.update)
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setPhone(profile.phone ?? "");
    setBio(profile.bio ?? "");
    setBirthDate(profile.birthDate ? new Date(profile.birthDate).toISOString().slice(0, 10) : "");
  }, [profile]);

  if (isLoading) return <LoadingSkeleton variant="card" rows={5} className="pt-14" />;

  if (!profile?.player) {
    return (
      <div className="pt-14 pb-28">
        <HeaderTitle title="Mi perfil" />
        <div className="px-4 pt-16">
          <EmptyState
            icon={<UserPlus className="size-8" />}
            title="Aún no eres jugador"
            description="Completa tu onboarding para configurar tu disponibilidad."
            action={
              <Link
                href="/onboarding"
                className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
              >
                Ir a onboarding
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const stats = myStatsQuery.data ?? null;
  const teams = teamsQuery.data ?? [];
  const visibleTeams = teams.slice(0, MAX_TEAM_PILLS);
  const extraTeams = teams.length - visibleTeams.length;
  const history = historyQuery.data ?? [];

  // Mapeo probado del scaffold: columnas Lun→Dom; modelo dayOfWeek 0 = domingo
  const allSlots = Array.from({ length: 12 }, (_, timeSlot) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const dayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
      const found = profile.player?.availabilities.find(
        (a) => a.dayOfWeek === dayOfWeek && a.timeSlot === timeSlot,
      );
      return {
        dayOfWeek,
        timeSlot,
        status: found?.status ?? "UNAVAILABLE",
      };
    }),
  ).flat();

  const statCards = stats
    ? [
        {
          value: String(stats.matchesWithStats),
          label: "Partidos con stats",
          detail: "Total de partidos donde se cargaron tus estadísticas.",
        },
        {
          value: stats.avgGoalsLast10.toFixed(1),
          label: "Prom. goles últ. 10",
          detail: "Promedio de goles en tus últimos 10 partidos con estadísticas.",
        },
        {
          value: stats.fairPlayScore.toFixed(2),
          label: "Puntaje Fair Play",
          note: "(menor = mejor)",
          detail: "Fórmula: (AM×1 + RO×3 + AZ×0.5 + FA×0.25) ÷ partidos. Menor es mejor.",
        },
        {
          value: String(
            stats.totalBlueCardsLast10 + stats.totalYellowCardsLast10 + stats.totalRedCardsLast10,
          ),
          label: "Tarjetas últ. 10",
          detail: "Suma de tarjetas azules, amarillas y rojas en tus últimos 10 partidos.",
        },
      ]
    : [];

  const handleSave = () => {
    updateProfile(
      {
        displayName,
        phone,
        bio,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
      { onSuccess: () => notify("Perfil actualizado", "Tus cambios fueron guardados") },
    );
  };

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Mi perfil" />

      {/* HEADER DE PERFIL */}
      <div className="flex flex-col items-center px-4 pt-6">
        <div className="rounded-full ring-2 ring-cypher-5-1-1">
          <PlayerAvatar
            profile={{
              displayName: profile.displayName ?? "Jugador",
              image: session?.user?.image ?? null,
            }}
            size="lg"
          />
        </div>
        <h1 className="mt-3 text-xl font-bold text-cypher-4">
          {profile.displayName ?? "Jugador"}
        </h1>
        {profile.bio && (
          <button
            type="button"
            onClick={() => setBioExpanded((cur) => !cur)}
            className="mt-1 max-w-[280px] text-center text-sm text-cypher-4-2"
          >
            <span className={bioExpanded ? "" : "line-clamp-2"}>{profile.bio}</span>
            {bioExpanded ? (
              <ChevronUp className="mx-auto mt-0.5 size-3.5 text-cypher-4-2-2" />
            ) : (
              <ChevronDown className="mx-auto mt-0.5 size-3.5 text-cypher-4-2-2" />
            )}
          </button>
        )}

        {/* Chips de equipos (A2: isCaptain viaja en getMyTeams) */}
        <div className="mt-4 flex w-full items-center justify-center gap-2 overflow-x-auto pb-1">
          {teams.length === 0 ? (
            <span className="text-xs text-cypher-4-2-2">Sin equipo</span>
          ) : (
            <>
              {visibleTeams.map((t) => (
                <TeamPill
                  key={t.id}
                  href={`/equipos/${t.id}`}
                  abbreviation={t.abbreviation}
                  primaryColor={t.primaryColor}
                  isCaptain={t.isCaptain}
                />
              ))}
              {extraTeams > 0 && (
                <Link
                  href="/equipos"
                  className="shrink-0 rounded-full bg-cypher-5-1-1 px-3 py-1.5 text-xs font-medium text-cypher-4-2"
                >
                  +{extraTeams}
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="px-4 pt-6">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* TAB: ESTADÍSTICAS */}
      {tab === "stats" && (
        <div className="space-y-6 px-4 pt-6">
          {stats ? (
            <div className="grid grid-cols-2 gap-4">
              {statCards.map((c) => (
                <StatCard
                  key={c.label}
                  value={c.value}
                  label={c.label}
                  note={c.note}
                  detail={c.detail}
                  onTap={notify}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<History className="size-8" />}
              title="Aún no tienes estadísticas"
              description="Aparecen cuando se cargue el primer resultado con tus datos."
            />
          )}

          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">
              Historial de partidos
            </h2>
            {history.length === 0 ? (
              <EmptyState
                icon={<History className="size-8" />}
                title="Sin partidos con estadísticas"
                description="Cuando se cargue un resultado tuyo, aparecerá aquí."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((m) => (
                  <MatchHistoryRow
                    key={m.matchId}
                    href={`/torneos/${m.match.tournamentId}/partidos/${m.matchId}`}
                    title={`${m.match.tournament.name} — ${m.match.phase.name}`}
                    subtitle={
                      m.match.scheduledAt || m.match.date
                        ? DATE_FMT.format(new Date(m.match.scheduledAt ?? m.match.date))
                        : "Por programar"
                    }
                    goals={m.goals}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: EDITAR PERFIL (espejo zod: name 1-50 · phone ≤20 · bio ≤500 · date) */}
      {tab === "edit" && (
        <form
          className="space-y-4 px-4 pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-name" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
              Nombre
            </label>
            <input
              id="profile-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={1}
              maxLength={50}
              className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
              placeholder="¿Cómo te llaman en la cancha?"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-phone" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
              Teléfono (opcional)
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
              placeholder="+57 300 123 4567"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-bio" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
              Biografía (opcional)
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
              placeholder="Cuéntale a los capitanes un poco sobre ti..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-birthdate" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
              Fecha de nacimiento
            </label>
            <input
              id="profile-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors [color-scheme:dark] focus:border-cypher-4-2"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-cypher-2 py-3 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1"
          >
            Guardar cambios
          </button>
        </form>
      )}

      {/* TAB: DISPONIBILIDAD (matrix + hook existentes, optimistic ya vivo) */}
      {tab === "schedule" && (
        <div className="px-4 pt-6">
          <h2 className="text-sm font-semibold text-cypher-4">Mi disponibilidad</h2>
          <p className="mb-4 mt-1 text-xs text-cypher-4-2-2">
            Toca para marcar cuándo puedes jugar. Todo lo demás queda bloqueado para convocatorias.
          </p>
          <div className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-3">
            <AvailabilityMatrix
              slots={allSlots}
              onToggleSlot={(dayOfWeek, timeSlot) => toggleSlot({ dayOfWeek, timeSlot })}
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-[10px] text-cypher-4-2-2">
              <span className="size-3 rounded border border-cypher-5-1-1 bg-cypher-3" />
              Disponible
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-cypher-4-2-2">
              <span className="size-3 rounded border border-cypher-5-1-1 bg-cypher-5" />
              No disponible
            </span>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}