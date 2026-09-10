"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { api } from "torneos/trpc/react";
import { CourtBubble } from "torneos/components/features/hub/court-bubble";
import "./hub.css"; // ← ÚNICO CAMBIO: los estilos viajan garantizados con el componente ← ÚNICO CAMBIO: los estilos viajan garantizados con el componente

type HubFilter = "todas" | "activas" | "disponibles";

const CourtMap = dynamic(
  () => import("torneos/components/features/hub/court-map").then((m) => m.CourtMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    ),
  },
);

const FILTERS: { id: HubFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "activas", label: "Con torneos" },
  { id: "disponibles", label: "Disponibles hoy" },
];

const FILTER_LABELS: Record<HubFilter, string> = {
  todas: "Mostrando todas las canchas",
  activas: "Mostrando canchas con torneos activos",
  disponibles: "Mostrando canchas con franjas disponibles hoy",
};

export function HubTemplate() {
  const [filter, setFilter] = useState<HubFilter>("todas");
  const [search, setSearch] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; subtitle: string } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: courts = [] } = api.court.getMap.useQuery(undefined, {
    staleTime: 60_000,
  });

  const visibleCourts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courts.filter((court) => {
      if (q && !court.name.toLowerCase().includes(q)) return false;
      if (filter === "activas" && !court.hasTournaments) return false;
      if (filter === "disponibles" && !court.hasSlotsToday) return false;
      return true;
    });
  }, [courts, filter, search]);

  const showToast = useCallback((title: string, subtitle: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ title, subtitle });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelectCourt = useCallback((courtId: string) => {
    setSelectedCourtId(courtId);
    if (navigator.vibrate) navigator.vibrate(50);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCourtId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative isolate flex-1 touch-none overflow-hidden bg-slate-950">
      <CourtMap courts={visibleCourts} onSelectCourt={handleSelectCourt} />

      {/* Buscador */}
      <div className="absolute inset-x-4 top-4 z-30">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cancha por nombre..."
            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="scrollbar-hide absolute inset-x-4 top-20 z-20 flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
              showToast("Filtros", FILTER_LABELS[f.id]);
            }}
            className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.id
                ? "bg-zinc-800 text-white"
                : "bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Burbuja de cancha */}
      <CourtBubble courtId={selectedCourtId} onClose={() => setSelectedCourtId(null)} />

      {/* Toast */}
      {toast && (
        <div className="absolute inset-x-4 top-20 z-[70] opacity-95">
          <div className="flex items-center gap-3 rounded-2xl bg-zinc-800 px-4 py-3 shadow-lg">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-600">
              <svg className="h-4 w-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{toast.title}</p>
              <p className="text-xs text-zinc-400">{toast.subtitle}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}