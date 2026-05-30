"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ZonePin {
  id: string;
  name: string;
  description: string | null;
  status: string;
  leads: number;
  detections: number;
  verified: number;
  contacted: number;
  converted: number;
  boundary: { type: "Polygon"; coordinates: number[][][] } | null;
}

interface Props {
  zones: ZonePin[];
  mapboxToken: string;
}

export default function UkMap({ zones, mapboxToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!mapboxToken || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled) return;

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-3.5, 54.0],
        zoom: 5.2,
      });

      map.on("load", () => {
        if (zones.length === 0) return;

        // Pre-compute each zone's bbox + centroid for markers.
        const features = zones
          .filter(z => z.boundary && z.boundary.coordinates?.[0]?.length)
          .map(z => {
            const coords = z.boundary!.coordinates[0];
            const lngs = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            return { z, centerLng, centerLat, lngs, lats };
          });

        // Add filled zone polygons. Colour by funnel-progress (verified+contacted+converted / leads).
        map.addSource("zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: features.map(f => ({
              type: "Feature",
              properties: {
                id: f.z.id,
                name: f.z.name,
                leads: f.z.leads,
                progress: f.z.leads > 0
                  ? Math.round(((f.z.verified + f.z.contacted + f.z.converted) / f.z.leads) * 100)
                  : 0,
              },
              geometry: f.z.boundary!,
            })),
          },
        });

        // Fill colour interpolated by funnel progress — cold blue → warm green.
        map.addLayer({
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": [
              "interpolate", ["linear"], ["get", "progress"],
              0, "#3b82f6",
              25, "#06b6d4",
              50, "#10b981",
              75, "#22c55e",
              100, "#16a34a",
            ],
            "fill-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "zones-outline",
          type: "line",
          source: "zones",
          paint: { "line-color": "#fbbf24", "line-width": 1.5 },
        });

        // Clickable marker per zone with name + lead count badge.
        for (const f of features) {
          const wrap = document.createElement("div");
          wrap.style.cssText = "cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;";

          const dot = document.createElement("div");
          dot.style.cssText = `
            width: 14px; height: 14px; border-radius: 50%;
            background: #fbbf24; border: 2px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 12px rgba(251,191,36,0.6);
          `;
          wrap.appendChild(dot);

          const label = document.createElement("div");
          label.style.cssText = `
            font-size: 11px; font-weight: 600; color: white;
            background: rgba(11, 19, 32, 0.85);
            padding: 3px 8px; border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.1);
            white-space: nowrap; backdrop-filter: blur(4px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          `;
          label.textContent = `${f.z.name} · ${f.z.leads} leads`;
          wrap.appendChild(label);

          wrap.onclick = () => router.push(`/zones/${f.z.id}`);

          new mapboxgl.Marker(wrap).setLngLat([f.centerLng, f.centerLat]).addTo(map);
        }

        // Fit map to all zones if there are any.
        if (features.length > 0) {
          const allLngs = features.flatMap(f => f.lngs);
          const allLats = features.flatMap(f => f.lats);
          map.fitBounds(
            [[Math.min(...allLngs), Math.min(...allLats)], [Math.max(...allLngs), Math.max(...allLats)]],
            { padding: 80, maxZoom: 9, duration: 0 },
          );
        }
      });

      return () => map.remove();
    })();

    return () => { cancelled = true; };
  }, [mapboxToken, zones, router]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[55vh] sm:h-[65vh] md:h-[72vh] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900" />
      {!mapboxToken && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-amber-50 border border-amber-300 text-sm text-amber-900 p-4 text-center">
          Set <code className="px-1 mx-1 bg-amber-100 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the UK overview map.
        </div>
      )}
    </div>
  );
}
