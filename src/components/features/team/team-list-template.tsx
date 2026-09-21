"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogIn, ShieldOff, Users } from "lucide-react";
import { api } from "torneos/trpc/react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { TeamCard } from "torneos/components/ui/team-card/team-card";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { CreateTeamSheet } from "torneos/components/features/team/create-team-sheet";

/** W7 — Lista de equipos. Patrón A: el RSC siembra vía prefetch+HydrateClient;
 *  este template vive en Capa 2 desde el primer frame (cero flash de carga). */
export function TeamListTemplate() {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Patrón inline de tournament-detail-template (el hook useMyTeams no acepta opciones;
  // su contrato queda intacto).
  const { data: teams, isLoading, isError } = api.team.getMyTeams.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false,
  });

  const openSheet = () => setSheetOpen(true);

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Mis equipos" />

      {!isLoggedIn ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<LogIn className="size-8" />}
            title="Inicia sesión"
            description="Accede para ver tus equipos."
            action={
              <Link
                href="/login"
                className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
              >
                Iniciar sesión
              </Link>
            }
          />
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3 px-4 pt-4">
          <LoadingSkeleton variant="grid" />
        </div>
      ) : isError ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<ShieldOff className="size-8" />}
            title="No pudimos cargar tus equipos"
            description="Intenta de nuevo en unos segundos."
          />
        </div>
      ) : !teams || teams.length === 0 ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<Users className="size-8" />}
            title="Aún no perteneces a ningún equipo"
            description="Crea tu primer equipo o acepta una invitación desde la bandeja."
            action={
              <button
                type="button"
                onClick={openSheet}
                className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
              >
                Crear equipo
              </button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-4">
          {/* Columna única SIN breakpoints desktop (decisión vigente) */}
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/equipos/${team.id}`}
              className="block rounded-2xl transition-opacity active:opacity-80"
            >
              <TeamCard
                name={team.name}
                abbreviation={team.abbreviation}
                primaryColor={team.primaryColor}
                secondaryColor={team.secondaryColor}
                status={team.status}
              />
            </Link>
          ))}
          <button
            type="button"
            onClick={openSheet}
            className="mt-2 w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1 py-3 text-sm font-bold uppercase tracking-wide text-cypher-4 transition-colors active:bg-cypher-5-1-1"
          >
            Crear equipo
          </button>
        </div>
      )}

      <CreateTeamSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}