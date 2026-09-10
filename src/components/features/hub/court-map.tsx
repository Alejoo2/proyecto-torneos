"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./hub.css"; // ← ÚNICO CAMBIO: los estilos viajan garantizados con el componente


import type { RouterOutputs } from "torneos/trpc/react";
import { HUB_BOUNDS, HUB_CENTER, HUB_ZOOM } from "torneos/lib/hub";

type CourtPin = RouterOutputs["court"]["getMap"][number];

interface CourtMapProps {
  courts: CourtPin[];
  onSelectCourt: (courtId: string) => void;
}

function buildPinHtml(court: CourtPin): string {
  const isEnabled = court.status === "ENABLED";
  return `
    <div class="custom-pin-inner">
      <div class="relative flex flex-col items-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full border-4 shadow-lg ${
          isEnabled ? "border-white bg-zinc-800" : "border-zinc-200 bg-zinc-400"
        }">
          <svg class="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-1 8h1m-1-4h1m-1 4h1"/>
          </svg>
        </div>
        ${court.hasTournaments ? `<span class="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500"></span>` : ""}
      </div>
    </div>`;
}

export function CourtMap({ courts, onSelectCourt }: CourtMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const didFitRef = useRef(false);

  const onSelectRef = useRef(onSelectCourt);
  onSelectRef.current = onSelectCourt;

  // Init único del mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      minZoom: 12, // permite encuadrar todo el corredor en pantallas chicas
      maxZoom: 19,
      maxBounds: HUB_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    // Basemap oscuro nativo (CARTO, sin API key). La atribución es obligatoria.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    map.setView(HUB_CENTER, HUB_ZOOM);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  // Pines + encuadre inicial
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layerRef.current?.remove();
    const group = L.layerGroup();
    const valid: CourtPin[] = [];

    for (const court of courts) {
      if (court.lat === 0 && court.lon === 0) {
        console.warn(
          `[Hub] "${court.name}" (${court.id}) sin coordenadas. Bórrala o edítala en Prisma Studio.`,
        );
        continue;
      }
      valid.push(court);

      const marker = L.marker([court.lat, court.lon], {
        icon: L.divIcon({
          className: "custom-pin-wrapper",
          html: buildPinHtml(court),
          iconSize: [48, 48],
          iconAnchor: [24, 48],
        }),
        keyboard: false,
      });

      marker.on("click", () => {
        map.panTo([court.lat + 0.004, court.lon]);
        onSelectRef.current(court.id);
      });

      group.addLayer(marker);
    }

    group.addTo(map);
    layerRef.current = group;

    // Al primer fetch con datos: encuadra todos los pines de una vez
    if (!didFitRef.current && valid.length > 0) {
      didFitRef.current = true;

      const only = valid[0];
      if (valid.length === 1 && only) {
        map.setView([only.lat, only.lon], 15);
      } else if (valid.length > 1) {
        map.fitBounds(
          L.latLngBounds(valid.map((c) => [c.lat, c.lon] as [number, number])),
          { padding: [48, 48] },
        );
      }
    }
  }, [courts]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {/* Aurora encima del mapa: screen-blend sobre tiles oscuros = glow */}
      <div className="hub-aurora" aria-hidden />
    </>
  );
}