"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX2, Search, Trophy } from "lucide-react";
import { api } from "torneos/trpc/react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { TournamentCard } from "torneos/components/ui/tournament/tournament-card";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { DAY_SHORT } from "torneos/lib/hub";
import { TOURNAMENT_STATUS_LABEL } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

type DayFilter = number | "ALL";
/** "ALL" = sin filtro; si no, un TournamentStatus de la vitrina. */
type StatusFilter = string;

/** W7 — Lista de torneos. Filtrado 100% cliente sobre la query materializada
 *  (decisión vigente, patrón W3). Chips derivados de los días y estados
 *  presentes en los datos. Prefetch del detalle por intención (hover/touch). */
export function TournamentsListTemplate() {
  const utils = api.useUtils();
  const { data: tournaments, isLoading, isError, dataUpdatedAt } = api.tournament.listPublic.useQuery(
    undefined,
    // Vitrina: sin refetch al enfocar (el montaje refetcha si pasó el stale global).
    { retry: false, refetchOnWindowFocus: false },
  );
  const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const list = useMemo(() => tournaments ?? [], [tournaments]);
  
  const days = useMemo(
    () => Array.from(new Set(list.map((t) => t.dayOfWeek))).sort((a, b) => a - b),
    [list],
  );
  const statuses = useMemo(
    () => Array.from(new Set(list.map((t) => t.status))).sort(),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (t) =>
        (dayFilter === "ALL" || t.dayOfWeek === dayFilter) &&
        (statusFilter === "ALL" || t.status === statusFilter) &&
        (q === "" ||
          t.name.toLowerCase().includes(q) ||
          t.court.name.toLowerCase().includes(q)),
    );
  }, [list, dayFilter, statusFilter, query]);

  const prefetchDetail = (tournamentId: string) => {
    void utils.tournament.getPublicById.prefetch({ tournamentId });
  };

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title="Torneos" />

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 transition-colors focus-within:border-cypher-4-2">
          <Search className="size-4 shrink-0 text-cypher-4-2-2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por torneo o cancha…"
            aria-label="Buscar torneos"
            className="w-full bg-transparent text-sm text-cypher-4 outline-none placeholder:text-cypher-4-2-2"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
        <button
          type="button"
          aria-pressed={dayFilter === "ALL"}
          onClick={() => setDayFilter("ALL")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            dayFilter === "ALL" ? "border-transparent bg-cypher-2 text-cypher-5" : "border-cypher-4-2-2/40 text-cypher-4-2",
          )}
        >
          Todos
        </button>
        {days.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={dayFilter === day}
            onClick={() => setDayFilter(day)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              dayFilter === day ? "border-transparent bg-cypher-2 text-cypher-5" : "border-cypher-4-2-2/40 text-cypher-4-2",
            )}
          >
            {DAY_SHORT[day] ?? `Día ${day}`}
          </button>
        ))}
      </div>

      {statuses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1">
          <button
            type="button"
            aria-pressed={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === "ALL" ? "border-transparent bg-cypher-2 text-cypher-5" : "border-cypher-4-2-2/40 text-cypher-4-2",
            )}
          >
            Cualquiera
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s ? "border-transparent bg-cypher-2 text-cypher-5" : "border-cypher-4-2-2/40 text-cypher-4-2",
              )}
            >
              {TOURNAMENT_STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      )}

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
            title="Sin torneos con esos filtros"
            description="Prueba con otro día, estado o búsqueda."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/torneos/${t.id}`}
              onMouseEnter={() => prefetchDetail(t.id)}
              onFocus={() => prefetchDetail(t.id)}
              onTouchStart={() => prefetchDetail(t.id)}
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