"use client";

import { useState } from "react";
import StreetViewScanButton from "@/components/StreetViewScanButton";

interface Props {
  zone: {
    id: string; name: string; description: string | null;
    status: string; zoom: number; created_at: string;
    boundary: unknown;
  };
  tileCount: number;
  detectionCount: number;
  leadCount: number;
}

export default function ZoneDetail({ zone, tileCount, detectionCount, leadCount }: Props) {
  const [status, setStatus] = useState(zone.status);
  const [busy, setBusy] = useState<null | "fetch" | "consolidate">(null);
  const [log, setLog] = useState<string | null>(null);

  async function setZoneStatus(next: string) {
    setStatus(next);
    await fetch(`/api/zones/${zone.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function runFetch() {
    setBusy("fetch"); setLog(null);
    const res = await fetch(`/api/zones/${zone.id}/fetch`, { method: "POST" });
    const json = await res.json();
    setLog(JSON.stringify(json, null, 2));
    setBusy(null);
  }

  async function runConsolidate() {
    setBusy("consolidate"); setLog(null);
    const res = await fetch(`/api/zones/${zone.id}/consolidate`, { method: "POST" });
    const json = await res.json();
    setLog(JSON.stringify(json, null, 2));
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-slate-500">Zone</div>
        <h1 className="text-2xl font-semibold">{zone.name}</h1>
        {zone.description && <p className="text-slate-600 text-sm mt-1">{zone.description}</p>}
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Status" value={status} />
        <Stat label="Cached tiles" value={tileCount} />
        <Stat label="Detections" value={detectionCount} />
        <Stat label="Leads" value={leadCount} />
      </section>

      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-medium">Status</h2>
        <div className="flex gap-2 text-sm">
          {["draft","active","paused","archived"].map(s => (
            <button key={s} onClick={() => setZoneStatus(s)}
              className={`px-3 py-1 rounded-full border ${status === s ? "bg-ink text-white" : "bg-white"}`}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <h2 className="font-medium text-sm">Pipeline actions</h2>
        <div className="flex flex-col sm:flex-row gap-2 text-sm">
          <button onClick={runFetch} disabled={busy !== null || status !== "active"}
            className="px-4 py-2.5 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-40 hover:bg-ink/90 transition-colors">
            {busy === "fetch" ? "Fetching tiles…" : "Run imagery sweep"}
          </button>
          <button onClick={runConsolidate} disabled={busy !== null}
            className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors">
            {busy === "consolidate" ? "Consolidating…" : "Cluster → leads"}
          </button>
        </div>
        {log && <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64">{log}</pre>}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-medium text-sm">Enrich this zone</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pull a Street View image at every lead&apos;s site centroid. Needs <code className="text-[11px] bg-slate-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code>.
          </p>
        </div>
        <StreetViewScanButton zoneId={zone.id} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold mt-1 capitalize">{value}</div>
    </div>
  );
}
