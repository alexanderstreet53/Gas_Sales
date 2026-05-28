"use client";

import { useState } from "react";

interface Result { total: number; scanned: number; cached: number; failed: number; skipped: number }

export default function StreetViewScanButton({ zoneId, variant = "primary" }: {
  zoneId?: string;
  variant?: "primary" | "ghost";
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null); setErrorHint(null); setResult(null);
    try {
      const url = zoneId ? `/api/leads/streetview-scan?zone=${zoneId}` : `/api/leads/streetview-scan`;
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Scan failed");
        setErrorHint(json.message ?? null);
        return;
      }
      setResult(json);
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cls = variant === "primary"
    ? "inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 py-2.5 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-sm"
    : "inline-flex items-center gap-2 rounded-lg bg-white text-ink px-3 py-1.5 text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-2">
      <button onClick={go} disabled={busy} className={cls}>
        <EyeIcon className={busy ? "animate-pulse" : ""} />
        {busy ? "Scanning Street View…" : "Run Street View scan"}
      </button>
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <div className="font-medium">{error}</div>
          {errorHint && <div className="text-red-600 mt-1">{errorHint}</div>}
        </div>
      )}
      {result && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 space-y-0.5">
          <div className="font-medium">Scanned {result.scanned} of {result.total} leads</div>
          <div className="text-emerald-700">
            {result.cached} from cache · {result.failed} failed · {result.skipped} skipped
          </div>
        </div>
      )}
    </div>
  );
}

function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
