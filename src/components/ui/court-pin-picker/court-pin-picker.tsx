"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";
import { HUB_BOUNDS, HUB_CENTER } from "torneos/lib/hub";

export interface PinValue {
  lat: number;
  lon: number;
}

interface CourtPinPickerProps {
  /** null = sin ubicar (crear) o Isla Nula (0,0: backfill pendiente). */
  value: PinValue | null;
  onChange: (v: PinValue) => void;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** El pin nunca sale de Sogamoso–Nobsa (misma frontera que el hub). */
function clampToBounds(lat: number, lon: number): PinValue {
  const sw = HUB_BOUNDS[0] ?? HUB_CENTER;
  const ne = HUB_BOUNDS[1] ?? HUB_CENTER;
  return {
    lat: round(Math.min(ne[0], Math.max(sw[0], lat))),
    lon: round(Math.min(ne[1], Math.max(sw[1], lon))),
  };
}

/** Selector de pin sobre Leaflet: tap para ubicar, drag para ajustar. Puro (sin tRPC). */
export function CourtPinPicker({ value, onChange }: CourtPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = value ?? { lat: HUB_CENTER[0], lon: HUB_CENTER[1] };
    const map = L.map(containerRef.current, {
      attributionControl: true,
      minZoom: 13,
      maxZoom: 19,
      maxBounds: HUB_BOUNDS,
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    map.setView([start.lat, start.lon], 15);
    const marker = L.marker([start.lat, start.lon], { draggable: true, autoPan: true });
    const place = (lat: number, lon: number) => {
      const v = clampToBounds(lat, lon);
      marker.setLatLng([v.lat, v.lon]);
      onChangeRef.current(v);
    };
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      place(p.lat, p.lng);
    });
    marker.addTo(map);
    markerRef.current = marker;
    map.on("click", (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Init única por montaje (el form usa key por cancha en edición).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const v = clampToBounds(pos.coords.latitude, pos.coords.longitude);
        markerRef.current?.setLatLng([v.lat, v.lon]);
        mapRef.current?.setView([v.lat, v.lon], 16);
        onChangeRef.current(v);
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { timeout: 8000 },
    );
  };

  return (
    <div>
      <div ref={containerRef} className="h-[260px] w-full rounded-xl border border-cypher-5-1-1" />
      <div className="mt-2 flex min-h-[44px] items-center justify-between gap-2">
        <p className="text-xs text-cypher-4-2-2" aria-live="polite">
          {value ? `${value.lat}, ${value.lon}` : "Toca el mapa para ubicar la cancha"}
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-cypher-5-1-1 px-3 text-xs font-bold text-cypher-4-2 transition-colors hover:bg-cypher-4/10 disabled:opacity-50"
        >
          <LocateFixed className="size-4" />
          {locating ? "Ubicando…" : "Mi ubicación"}
        </button>
      </div>
      {geoError && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          No se pudo obtener tu ubicación: ubica el pin manualmente.
        </p>
      )}
    </div>
  );
}
