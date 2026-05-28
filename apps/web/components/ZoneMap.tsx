"use client";

import { useEffect, useRef, useState } from "react";

interface LeadPin {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  type: string | null;
  confidence: number;
  status: string;
}

interface DetectionPin {
  id: string;
  lat: number;
  lng: number;
  class: string;
  confidence: number;
  reviewResult: string | null;
}

interface Boundary { type: "Polygon"; coordinates: number[][][] }

interface Props {
  zoneName: string;
  boundary: Boundary | null;
  leads: LeadPin[];
  detections: DetectionPin[];
  mapboxToken: string;
}

export default function ZoneMap({ boundary, leads, detections, mapboxToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LeadPin | DetectionPin | null>(null);

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || !boundary) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled) return;

      mapboxgl.accessToken = mapboxToken;

      // Compute centroid + zoom from the boundary's bbox.
      const coords = boundary.coordinates[0];
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [centerLng, centerLat],
        zoom: 14,
      });

      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 0 });

      map.on("load", () => {
        // Zone boundary outline.
        map.addSource("boundary", { type: "geojson", data: { type: "Feature", properties: {}, geometry: boundary } });
        map.addLayer({ id: "boundary-line", type: "line", source: "boundary",
          paint: { "line-color": "#fbbf24", "line-width": 2, "line-dasharray": [2, 2] } });
        map.addLayer({ id: "boundary-fill", type: "fill", source: "boundary",
          paint: { "fill-color": "#fbbf24", "fill-opacity": 0.05 } });

        // Lead pins.
        for (const l of leads) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 14px; height: 14px; border-radius: 50%;
            background: ${statusColor(l.status)}; border: 2px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.3); cursor: pointer;
          `;
          el.title = l.name ?? "unknown";
          el.onclick = () => setSelected(l);
          new mapboxgl.Marker(el).setLngLat([l.lng, l.lat]).addTo(map);
        }

        // Detection pins (smaller, different shape).
        for (const d of detections) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 10px; height: 10px; transform: rotate(45deg);
            background: #ef4444; border: 1.5px solid white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.3); cursor: pointer;
          `;
          el.title = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
          el.onclick = () => setSelected(d);
          new mapboxgl.Marker(el).setLngLat([d.lng, d.lat]).addTo(map);
        }
      });

      return () => map.remove();
    })();

    return () => { cancelled = true; };
  }, [mapboxToken, boundary, leads, detections]);

  if (!mapboxToken) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Set <code className="px-1 bg-amber-100 rounded text-[12px]">NEXT_PUBLIC_MAPBOX_TOKEN</code> in Vercel to enable the map. Free 50,000 loads/month, no card required — see https://account.mapbox.com/access-tokens/.
        </div>
        <PinList leads={leads} detections={detections} onSelect={setSelected} />
        {selected && <SelectionCard item={selected} onClose={() => setSelected(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="w-full h-[60vh] sm:h-[70vh] rounded-2xl overflow-hidden border border-slate-200" />
      <Legend />
      {selected && <SelectionCard item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function statusColor(status: string): string {
  return ({
    new:       "#3b82f6",
    verified:  "#10b981",
    contacted: "#f59e0b",
    converted: "#8b5cf6",
    rejected:  "#94a3b8",
  } as Record<string, string>)[status] ?? "#3b82f6";
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow" />
        Lead
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 bg-red-500 border border-white shadow" style={{ transform: "rotate(45deg)" }} />
        Detection
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-0.5 bg-amber-400" style={{ borderTop: "1px dashed currentColor" }} />
        Zone boundary
      </span>
    </div>
  );
}

function PinList({ leads, detections, onSelect }: {
  leads: LeadPin[]; detections: DetectionPin[];
  onSelect: (i: LeadPin | DetectionPin) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-medium">
        {leads.length} leads · {detections.length} detections
      </div>
      <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
        {leads.map(l => (
          <li key={l.id} onClick={() => onSelect(l)}
            className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50">
            <div className="font-medium">{l.name ?? "unknown"}</div>
            <div className="text-xs text-slate-500">{l.type ?? "—"} · {l.lat.toFixed(4)}, {l.lng.toFixed(4)}</div>
          </li>
        ))}
        {detections.map(d => (
          <li key={d.id} onClick={() => onSelect(d)}
            className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50">
            <div className="font-medium capitalize">{d.class}</div>
            <div className="text-xs text-slate-500">{(d.confidence * 100).toFixed(0)}% · {d.lat.toFixed(4)}, {d.lng.toFixed(4)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectionCard({ item, onClose }: { item: LeadPin | DetectionPin; onClose: () => void }) {
  const isLead = "name" in item;
  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-96 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {isLead ? "Lead" : "Detection"}
          </div>
          <div className="font-semibold truncate mt-0.5">
            {isLead ? (item.name ?? "unknown") : item.class}
          </div>
          {isLead && item.type && <div className="text-xs text-slate-500 capitalize mt-0.5">{item.type}</div>}
          <div className="text-xs text-slate-500 mt-1">
            {item.lat.toFixed(5)}, {item.lng.toFixed(5)} · {(item.confidence * 100).toFixed(0)}%
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50">
              Street View
            </a>
            {isLead && (
              <a href={`/leads/${item.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50">
                Open lead →
              </a>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-ink p-1 -m-1" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
