"use client";

import { useState } from "react";

interface ZoneResult { slug: string; found: number; insideZone: number; inserted: number }

export default function CompaniesHouseSeedButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ZoneResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null); setErrorHint(null); setResults(null);
    try {
      const res = await fetch("/api/leads/seed-companies-house", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        setErrorHint(json.message ?? null);
        return;
      }
      setResults(json.results ?? []);
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cls = variant === "primary"
    ? "inline-flex items-center gap-2 rounded-lg bg-white text-ink px-4 py-2.5 text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
    : "inline-flex items-center gap-2 rounded-lg bg-white text-ink px-3 py-1.5 text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-2">
      <button onClick={go} disabled={busy} className={cls}>
        <BuildingIcon className={busy ? "animate-pulse" : ""} />
        {busy ? "Querying Companies House…" : "Pull from Companies House"}
      </button>
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <div className="font-medium">{error}</div>
          {errorHint && (
            <div className="text-red-600 mt-1 break-words">{errorHint}</div>
          )}
        </div>
      )}
      {results && results.length > 0 && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 space-y-0.5">
          <div className="font-medium">Imported from Companies House:</div>
          {results.map(r => (
            <div key={r.slug}>
              <span className="font-mono">{r.slug}</span>:
              {" "}{r.inserted} inserted ({r.insideZone}/{r.found} inside zone)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuildingIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="9" y1="22" x2="9" y2="18"/>
      <line x1="15" y1="22" x2="15" y2="18"/>
      <line x1="8" y1="6" x2="8" y2="6"/>
      <line x1="12" y1="6" x2="12" y2="6"/>
      <line x1="16" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="8" y2="10"/>
      <line x1="12" y1="10" x2="12" y2="10"/>
      <line x1="16" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="8" y2="14"/>
      <line x1="12" y1="14" x2="12" y2="14"/>
      <line x1="16" y1="14" x2="16" y2="14"/>
    </svg>
  );
}
