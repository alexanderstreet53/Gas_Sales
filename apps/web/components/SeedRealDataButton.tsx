"use client";

import { useState } from "react";

interface ZoneResult { slug: string; found: number; inserted: number }

export default function SeedRealDataButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ZoneResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null); setResults(null);
    try {
      const res = await fetch("/api/leads/seed-osm", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Request failed"); return; }
      setResults(json.results ?? []);
      // Soft refresh so the dashboard counts update.
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isPrimary = variant === "primary";
  const cls = isPrimary
    ? "inline-flex items-center gap-2 rounded-lg bg-ink text-white px-4 py-2.5 text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors shadow-sm"
    : "inline-flex items-center gap-2 rounded-lg bg-white text-ink px-3 py-1.5 text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-2">
      <button onClick={go} disabled={busy} className={cls}>
        <DownloadIcon className={busy ? "animate-pulse" : ""} />
        {busy ? "Pulling from OpenStreetMap…" : "Pull real businesses from OSM"}
      </button>
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {results && results.length > 0 && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 space-y-0.5">
          <div className="font-medium">Pulled real businesses:</div>
          {results.map(r => (
            <div key={r.slug}>
              <span className="font-mono">{r.slug}</span>: {r.inserted} leads
            </div>
          ))}
          <div className="text-[11px] text-emerald-700 mt-1">Refreshing…</div>
        </div>
      )}
    </div>
  );
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
