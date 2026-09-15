"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { RouterOutputs } from "torneos/trpc/react";
import { HUB_BOUNDS, HUB_CENTER, HUB_ZOOM } from "torneos/lib/hub";

type CourtPin = RouterOutputs["court"]["getMap"][number];

interface CourtMapProps {
  courts: CourtPin[];
  onSelectCourt: (courtId: string) => void;
  onReady?: (map: L.Map) => void;
}

function buildPinHtml(court: CourtPin): string {
  const isEnabled = court.status === "ENABLED";
  return `
    <div class="custom-pin-inner">
      <div class="relative flex flex-col items-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full border-4 shadow-lg ${
          isEnabled ? "border-cypher-4 bg-cypher-5-1" : "border-cypher-4-2 bg-cypher-5-1-1"
        }">
          <svg class="h-5 w-5 ${isEnabled ? "text-cypher-4" : "text-cypher-4-2"}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-1 8h1m-1-4h1m-1 4h1"/>
          </svg>
        </div>
        ${court.hasTournaments ? `<span class="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-cypher-5 bg-green-500"></span>` : ""}
      </div>
    </div>`;
}

export function CourtMap({ courts, onSelectCourt, onReady }: CourtMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const onSelectRef = useRef(onSelectCourt);
  onSelectRef.current = onSelectCourt;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 13,
      maxZoom: 19,
      maxBounds: HUB_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    map.setView(HUB_CENTER, HUB_ZOOM);
    mapRef.current = map;
    onReadyRef.current?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layerRef.current?.remove();
    const group = L.layerGroup();

    for (const court of courts) {
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
  }, [courts]);

  return <div ref={containerRef} className="absolute inset-0 z-map" />;
}