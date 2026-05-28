"use client";

// Lightweight polygon drawer. Click points on the map, double-click to
// close. Saves the resulting polygon via POST /api/zones.
//
// Uses Mapbox GL only if NEXT_PUBLIC_MAPBOX_TOKEN is set; otherwise falls
// back to a Leaflet-style "click coords" textarea so the page works
// without a token.

import { useEffect, useRef, useState } from "react";

interface LngLat { lng: number; lat: number }

export default function ZoneDrawer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState<LngLat[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-0.2678, 51.5310],
        zoom: 15,
      });

      const localRing: LngLat[] = [];
      const markers: mapboxgl.Marker[] = [];

      map.on("click", e => {
        localRing.push({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        markers.push(new mapboxgl.Marker().setLngLat(e.lngLat).addTo(map));
        setRing([...localRing]);
        if (localRing.length >= 2) drawRing(map, localRing);
      });

      map.on("dblclick", e => {
        e.preventDefault();
      });
    })();
    return () => { cancelled = true; };
  }, [token]);

  function drawRing(map: import("mapbox-gl").Map, pts: LngLat[]) {
    const closed = [...pts, pts[0]].map(p => [p.lng, p.lat]);
    const src = map.getSource("draft-ring") as import("mapbox-gl").GeoJSONSource | undefined;
    const data: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: closed } };
    if (src) { src.setData(data); return; }
    map.addSource("draft-ring", { type: "geojson", data });
    map.addLayer({ id: "draft-ring", type: "line", source: "draft-ring",
      paint: { "line-color": "#2f6df0", "line-width": 2 } });
  }

  async function submit() {
    if (ring.length < 3) { setError("Need at least 3 points."); return; }
    if (!name.trim())    { setError("Name required."); return; }
    setSaving(true); setError(null);
    const closed = [...ring, ring[0]];
    const payload = {
      name,
      boundary: {
        type: "Polygon",
        coordinates: [closed.map(p => [p.lng, p.lat])],
      },
      status: "draft",
    };
    const res = await fetch("/api/zones", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error?.formErrors?.join(", ") ?? "save failed"); return; }
    window.location.reload();
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 bg-white rounded-xl border overflow-hidden">
        {token ? (
          <div ref={containerRef} className="w-full h-[280px] sm:h-[420px]" />
        ) : (
          <div className="w-full h-[280px] sm:h-[420px] flex items-center justify-center text-sm text-slate-500 p-4 text-center">
            Set <code className="mx-1 px-1 bg-slate-100 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to draw zones on a map.
            For now, paste a GeoJSON polygon directly into your DB or call <code className="mx-1 px-1 bg-slate-100 rounded">POST /api/zones</code>.
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-medium">New zone</h3>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Name (e.g. Park Royal)" value={name}
          onChange={e => setName(e.target.value)}
        />
        <div className="text-xs text-slate-500">
          Click the map to add corners ({ring.length}). Close at 3+ points.
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          onClick={submit} disabled={saving || ring.length < 3}
          className="w-full text-sm px-3 py-2 rounded-lg bg-ink text-white disabled:opacity-40"
        >{saving ? "Saving…" : "Save as draft"}</button>
      </div>
    </div>
  );
}
