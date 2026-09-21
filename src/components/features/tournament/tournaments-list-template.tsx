"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX2, Trophy } from "lucide-react";
import { api } from "torneos/trpc/react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { TournamentCard } from "torneos/components/ui/tournament/tournament-card";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { DAY_SHORT } from "torneos/lib/hub";
import { cn } from "torneos/lib/utils";

type DayFilter = number | "ALL";

/** W7 — Lista de torneos. Filtrado 100% cliente sobre la query materializada
 *  (decisión vigente, patrón W3). Chips derivados de los días presentes en los datos. */
export function TournamentsListTemplate() {
  const { data: tournaments, isLoading, isError, dataUpdatedAt } = api.tournament.listPublic.useQuery(
    undefined,
    { retry: false },
  );
  const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");

  const list = tournaments ?? [];

  const days = useMemo(
    () => Array.from(new Set(list.map((t) => t.dayOfWeek))).sort((a, b) => a - b),
    [list],
  );

  const filtered = useMemo(
    () => (dayFilter === "ALL" ? list : list.filter((t) => t.dayOfWeek === dayFilter)),
    [list, dayFilter],
  );

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Torneos" />

      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setDayFilter("ALL")}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            dayFilter === "ALL" ? "bg-cypher-2 text-cypher-5" : "bg-cypher-5-1-1 text-cypher-4-2",
          )}
        >
          Todos
        </button>
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setDayFilter(day)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              dayFilter === day ? "bg-cypher-2 text-cypher-5" : "bg-cypher-5-1-1 text-cypher-4-2",
            )}
          >
            {DAY_SHORT[day] ?? `Día ${day}`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 px-4 pt-3">
          <LoadingSkeleton variant="grid" />
        </div>
      ) : isError ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<Trophy className="size-8" />}
            title="No pudimos cargar los torneos"
            description="Intenta de nuevo en unos segundos."
          />
        </div>
      ) : list.length === 0 ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<Trophy className="size-8" />}
            title="No hay torneos publicados por ahora"
            description="Cuando una cancha publique uno, aparecerá aquí."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 pt-16">
          <EmptyState
            icon={<CalendarX2 className="size-8" />}
            title="Sin torneos ese día"
            description="Prueba con otro día de la semana."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/torneos/${t.id}`}
              className="block rounded-2xl transition-opacity active:opacity-80"
            >
              <TournamentCard tournament={t} dataUpdatedAt={dataUpdatedAt} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}