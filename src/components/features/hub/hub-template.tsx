"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import { Search } from "lucide-react";
import { BellTrigger } from "torneos/components/app-shell/notification-center";
import { api } from "torneos/trpc/react";
import { CourtBubble } from "torneos/components/features/hub/court-bubble";
import { Toast } from "torneos/components/ui/toast";

type HubFilter = "todas" | "activas" | "disponibles";

// Leaflet no soporta SSR: se carga solo en cliente
const CourtMap = dynamic(
  () => import("torneos/components/features/hub/court-map").then((m) => m.CourtMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-cypher-5/40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cypher-5-1-1 border-t-cypher-2" />
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCourtId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-transparent text-cypher-4">
      <main className="relative isolate flex-1 touch-none overflow-hidden">
        {/* Fondo Aurora centralizado (Regla 3.2) */}
        <div className="hub-aurora" />

        <CourtMap
          courts={visibleCourts}
          onSelectCourt={handleSelectCourt}
          onReady={(map) => (mapRef.current = map)}
        />

        {/* Buscador (offset top-4) */}
        {/* Search + campana: la fila superior del hub. top-3 libera el search del header fantasma */}
<div className="absolute inset-x-4 top-3 z-search flex items-center gap-2">
  <div className="flex flex-1 items-center gap-3 rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 px-4 py-3 shadow-lg">
    <Search className="h-5 w-5 shrink-0 text-cypher-4-2" /> {/* lucide: reemplaza el SVG manual */}
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Buscar cancha por nombre..."
      className="w-full bg-transparent text-sm text-cypher-4 outline-none placeholder:text-cypher-4-2"
    />
  </div>
  <div className="rounded-full border border-cypher-5-1-1 bg-cypher-5-1 shadow-lg">
    <BellTrigger />
  </div>
</div>



        {/* Filtros (offset top-20) */}
        <div className="scrollbar-hide absolute inset-x-4 top-[4.5rem] z-filters flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                showToast("Filtros", FILTER_LABELS[f.id]);
              }}
              className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-cypher-2 text-cypher-5 glow-neon"
                  : "border border-cypher-5-1-1 bg-cypher-5-1 text-cypher-4-2 hover:bg-cypher-5-1-1"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Burbuja de cancha */}
        <CourtBubble courtId={selectedCourtId} onClose={() => setSelectedCourtId(null)} />

        {/* Toast */}
                <Toast toast={toast} />
      </main>

      {/* Chrome anónimo: CTA Entrar en lugar de nav. El BottomNav del
          público lo monta el layout (anon), no este template. */}
      {!isLoggedIn && (
        <div className="border-t border-cypher-5-1-1 bg-cypher-5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Link
            href="/login"
            className="block w-full rounded-2xl bg-cypher-2 py-3.5 text-center text-sm font-semibold text-cypher-5 transition-colors hover:bg-cypher-2-1 active:bg-cypher-2/80 glow-neon"
          >
            Entrar
          </Link>
        </div>
      )}
    </div>
  );
}