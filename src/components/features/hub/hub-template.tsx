"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";

import { api } from "torneos/trpc/react";
import { HUB_CENTER, HUB_ZOOM } from "torneos/lib/hub";
import { CourtBubble } from "torneos/components/features/hub/court-bubble";

type HubFilter = "todas" | "activas" | "disponibles";

// Leaflet no soporta SSR: se carga solo en cliente
const CourtMap = dynamic(
  () => import("torneos/components/features/hub/court-map").then((m) => m.CourtMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
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

interface HubTemplateProps {
  isLoggedIn: boolean;
}

export function HubTemplate({ isLoggedIn }: HubTemplateProps) {
  const [filter, setFilter] = useState<HubFilter>("todas");
  const [search, setSearch] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; subtitle: string } | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // getMap es publicProcedure: legal para anónimos y logueados por igual
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

  const handleZoom = (delta: 1 | -1) => {
    if (!mapRef.current || selectedCourtId) return;
    delta === 1 ? mapRef.current.zoomIn() : mapRef.current.zoomOut();
  };

  const handleCenter = () => {
    if (!mapRef.current || selectedCourtId) return;
    mapRef.current.setView(HUB_CENTER, HUB_ZOOM);
    showToast("Vista", "Mapa centrado");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCourtId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-white">
      <main
        className="relative isolate flex-1 touch-none overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, #00ff87 0%, transparent 40%)," +
            "radial-gradient(circle at 80% 0%, #60efff 0%, transparent 40%)," +
            "radial-gradient(circle at 50% 100%, #a855f7 0%, transparent 50%)," +
            "#0f172a",
        }}
      >
        <CourtMap
          courts={visibleCourts}
          onSelectCourt={handleSelectCourt}
          onReady={(map) => (mapRef.current = map)}
        />

        {/* Buscador */}
        <div className="absolute inset-x-4 top-4 z-30">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
              <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 24 24">
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

        {/* Zoom + centrar */}
        <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-2">
          <button
            onClick={() => handleZoom(1)}
            aria-label="Zoom in"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg transition-colors hover:bg-zinc-50 active:bg-zinc-100"
          >
            <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={() => handleZoom(-1)}
            aria-label="Zoom out"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg transition-colors hover:bg-zinc-50 active:bg-zinc-100"
          >
            <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
        <div className="absolute bottom-44 right-4 z-30">
          <button
            onClick={handleCenter}
            aria-label="Centrar vista"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg transition-colors hover:bg-zinc-50 active:bg-zinc-100"
          >
            <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
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

      {/* Chrome anónimo: CTA Entrar en lugar de nav. El BottomNav del
          público lo monta el layout (anon), no este template. */}
      {!isLoggedIn && (
        <div className="border-t border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Link
            href="/login"
            className="block w-full rounded-2xl bg-zinc-900 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800"
          >
            Entrar
          </Link>
        </div>
      )}
    </div>
  );
}