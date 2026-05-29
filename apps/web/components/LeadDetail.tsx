"use client";

import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import type { LeadStatus } from "@/lib/types";

const DEMO_STORAGE_KEY = "gt:demo-mode";

interface Detection { class: string; confidence: number; bbox_pixels: number[] }

interface TileMeta { id: string; width_px: number; height_px: number }

interface Props {
  lead: {
    id: string;
    business_name: string | null;
    business_type: string | null;
    formatted_addr: string | null;
    confidence: number;
    status: LeadStatus;
    notes: string | null;
    zones?: { name: string } | null;
  };
  satelliteUrl: string | null;
  satelliteTile: TileMeta | null;
  satelliteDetections: Detection[];
  streetViewUrl: string | null;
  streetViewTile: TileMeta | null;
  streetViewDetections: Detection[];
  streetViewEmbedSrc: string | null;
  latLng: { lat: number; lng: number } | null;
}

type View = "street" | "satellite";

export default function LeadDetail({
  lead,
  satelliteUrl, satelliteTile, satelliteDetections,
  streetViewUrl, streetViewTile, streetViewDetections,
  streetViewEmbedSrc, latLng,
}: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [name, setName] = useState(lead.business_name ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Persist demo toggle across page navigations and lead changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDemoMode(window.localStorage.getItem(DEMO_STORAGE_KEY) === "1");
  }, []);

  // Wake the YOLO worker in the background as soon as the page loads so
  // the user's first detect click lands warm instead of cold-starting.
  useEffect(() => {
    fetch("/api/worker/warmup").catch(() => { /* fire and forget */ });
  }, []);
  function toggleDemo() {
    const next = !demoMode;
    setDemoMode(next);
    try { window.localStorage.setItem(DEMO_STORAGE_KEY, next ? "1" : "0"); } catch {}
  }
  const demoQuery = demoMode ? "?demo=1" : "";

  // Default to whichever view we actually have imagery for. Interactive
  // embed wins over the cached static snapshot when both are available.
  const hasInteractiveStreet = !!streetViewEmbedSrc;
  const hasStaticStreet = !!streetViewUrl;
  const showStreet = hasInteractiveStreet || hasStaticStreet;
  const initialView: View = showStreet ? "street" : "satellite";
  const [view, setView] = useState<View>(initialView);

  // Within the Street View tab, the user can flip between the interactive
  // 360 iframe (browsing) and the static image (where detection boxes can
  // be drawn). Default to "static" if there are detections to show.
  const [streetMode, setStreetMode] = useState<"static" | "interactive">(
    streetViewDetections.length > 0 && hasStaticStreet ? "static" : "interactive",
  );

  async function save() {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes, business_name: name || null }),
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function scanStreetView() {
    setScanning(true); setScanError(null); setScanResult(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/streetview${demoQuery}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setScanError(json.message ?? json.error ?? "Scan failed"); return; }
      const parts: string[] = ["Street View fetched"];
      if (json.workerSkipped) {
        parts.push("(AI skipped — WORKER_URL not set)");
      } else if (json.detected > 0) {
        parts.push(`+ ${json.detected} detection${json.detected === 1 ? "" : "s"} from AI`);
      } else if (json.detectionError) {
        parts.push(`(AI failed: ${json.detectionError})`);
      } else {
        parts.push("+ 0 detections from AI");
      }
      setScanResult(parts.join(" "));
      // Give the user a moment to see the result, then refresh.
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function detectHere() {
    setDetecting(true); setDetectError(null); setDetectResult(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/detect${demoQuery}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setDetectError(json.message ?? json.error ?? "Detection failed"); return; }
      setDetectResult(
        `${json.demo ? "[demo] " : ""}${json.detectionsFound} detection${json.detectionsFound === 1 ? "" : "s"} on the tile covering this lead` +
        (json.duplicates ? ` (${json.duplicates} duplicate)` : ""),
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setDetectError((e as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  const gMapsUrl = latLng
    ? `https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`
    : null;
  const gStreetViewUrl = latLng
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLng.lat},${latLng.lng}`
    : null;

  const showSatellite = !!(satelliteUrl && satelliteTile);
  const showTabs = showSatellite && showStreet;

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {/* Imagery preview */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {showTabs && (
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <ViewTab active={view === "street"}    onClick={() => setView("street")}>Street view</ViewTab>
            <ViewTab active={view === "satellite"} onClick={() => setView("satellite")}>Satellite</ViewTab>
          </div>
        )}

        {view === "street" && showStreet ? (
          <div className="relative bg-slate-900">
            {streetMode === "interactive" && hasInteractiveStreet ? (
              <iframe
                src={streetViewEmbedSrc!}
                title="Street View"
                className="w-full block border-0"
                style={{ aspectRatio: "16 / 10" }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : hasStaticStreet ? (
              <>
                <img src={streetViewUrl!} alt="Street View" className="w-full block" />
                {streetViewTile && streetViewDetections.map((d, i) => (
                  <BboxOverlay key={i} bbox={d.bbox_pixels} width={streetViewTile.width_px} height={streetViewTile.height_px} label={`${d.class} ${(d.confidence * 100).toFixed(0)}%`} />
                ))}
              </>
            ) : (
              // Edge: interactive available but no cached static — fall back to iframe.
              <iframe
                src={streetViewEmbedSrc!}
                title="Street View"
                className="w-full block border-0"
                style={{ aspectRatio: "16 / 10" }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}

            {/* Toggle + detection count overlays */}
            {hasInteractiveStreet && hasStaticStreet && (
              <button
                onClick={() => setStreetMode(m => m === "interactive" ? "static" : "interactive")}
                className="absolute top-2 left-2 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/95 text-ink shadow hover:bg-white transition-colors"
              >
                {streetMode === "interactive" ? "Show detections" : "View 360"}
              </button>
            )}
            {streetViewDetections.length > 0 && (
              <div className="absolute top-2 right-2 bg-emerald-600/95 text-white text-[11px] font-medium px-2 py-1 rounded-full shadow">
                {streetViewDetections.length} detection{streetViewDetections.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        ) : view === "satellite" && showSatellite ? (
          <div className="relative bg-slate-900">
            <img src={satelliteUrl!} alt="Satellite" className="w-full block" />
            {satelliteDetections.map((d, i) => (
              <BboxOverlay key={i} bbox={d.bbox_pixels} width={satelliteTile!.width_px} height={satelliteTile!.height_px} label={`${d.class} ${(d.confidence * 100).toFixed(0)}%`} />
            ))}
            {satelliteDetections.length > 0 && (
              <div className="absolute top-2 right-2 bg-emerald-600/95 text-white text-[11px] font-medium px-2 py-1 rounded-full shadow">
                {satelliteDetections.length} detection{satelliteDetections.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-[4/3] sm:aspect-[16/9] flex flex-col items-center justify-center gap-2 text-sm text-slate-500 p-6 text-center">
            <NoImageIcon />
            <div>No imagery yet.</div>
            <div className="text-xs">Use the buttons below to fetch.</div>
          </div>
        )}
      </section>

      {/* Per-lead scan tools */}
      {latLng && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-sm">Scan this lead</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Run just this one premises instead of the whole zone. Cache hits are free.
              </p>
            </div>
            <button
              onClick={toggleDemo}
              role="switch"
              aria-checked={demoMode}
              className={`flex-shrink-0 inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                demoMode
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
              title="Demo mode: generates plausible fake detections instead of calling the worker. Use for sales demos before the model is fine-tuned."
            >
              <span className={`w-1.5 h-1.5 rounded-full ${demoMode ? "bg-amber-500" : "bg-slate-300"}`} />
              Demo mode {demoMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={scanStreetView} disabled={scanning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 text-ink px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <EyeIcon className={scanning ? "animate-pulse" : ""} />
              {scanning ? "Scanning…" : streetViewUrl ? "Re-scan Street View" : "Scan Street View"}
            </button>
            <button onClick={detectHere} disabled={detecting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-white px-4 py-2.5 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-sm">
              <TargetIcon className={detecting ? "animate-pulse" : ""} />
              {detecting ? "Detecting…" : "Detect on satellite tile"}
            </button>
          </div>
          {(scanError || detectError) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {scanError ?? detectError}
            </div>
          )}
          {(scanResult || detectResult) && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 space-y-0.5">
              {scanResult && <div>{scanResult}</div>}
              {detectResult && <div>{detectResult}</div>}
            </div>
          )}
        </section>
      )}

      {/* Header card */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              {lead.zones?.name ?? "—"}
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-0.5 truncate">
              {lead.business_name ?? <em className="text-slate-400">unknown</em>}
            </h1>
            {lead.business_type && (
              <div className="text-xs text-slate-500 capitalize mt-0.5">{lead.business_type}</div>
            )}
          </div>
          <StatusPill status={status} />
        </div>

        <div className="mt-3 text-sm text-slate-700">
          {lead.formatted_addr ?? <span className="italic text-slate-400">no address</span>}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="text-xs text-slate-500">Confidence</div>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${Math.round(lead.confidence * 100)}%` }} />
          </div>
          <div className="text-xs tabular-nums">{(lead.confidence * 100).toFixed(0)}%</div>
        </div>

        {(gMapsUrl || gStreetViewUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {gMapsUrl && (
              <a href={gMapsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50">
                <ExternalIcon /> Maps
              </a>
            )}
            {gStreetViewUrl && (
              <a href={gStreetViewUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50">
                <ExternalIcon /> Street View (live)
              </a>
            )}
          </div>
        )}
      </section>

      {/* Edit form — sticky-saved on mobile */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <Field label="Business name">
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            value={name} onChange={e => setName(e.target.value)}
            placeholder="If known"
          />
        </Field>

        <Field label="Status">
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
            value={status} onChange={e => setStatus(e.target.value as LeadStatus)}>
            {(["new","verified","contacted","converted","rejected"] as LeadStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm h-24"
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Anything worth remembering for the next call." />
        </Field>

        {/* Inline save (visible at md+; mobile uses the sticky bar below). */}
        <div className="hidden md:flex justify-end">
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink/90 disabled:opacity-50">
            {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </section>

      {/* Sticky mobile save bar — floats above the bottom nav */}
      <div className="md:hidden fixed left-0 right-0 z-20 px-3 pb-safe-nav pointer-events-none" style={{ bottom: 0 }}>
        <button onClick={save} disabled={saving}
          className="pointer-events-auto w-full rounded-xl bg-ink text-white py-3 text-sm font-semibold shadow-lg disabled:opacity-60 active:scale-[0.99] transition-transform">
          {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 text-xs font-medium py-2.5 transition-colors ${
        active ? "text-ink border-b-2 border-ink" : "text-slate-500 hover:text-ink"
      }`}>
      {children}
    </button>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function BboxOverlay({ bbox, width, height, label }: { bbox: number[]; width: number; height: number; label: string }) {
  if (bbox.length < 4) return null;
  const [x1, y1, x2, y2] = bbox;
  return (
    <div
      className="absolute border-2 border-emerald-400 pointer-events-none rounded-sm"
      style={{
        left:   `${(x1 / width) * 100}%`,
        top:    `${(y1 / height) * 100}%`,
        width:  `${((x2 - x1) / width) * 100}%`,
        height: `${((y2 - y1) / height) * 100}%`,
      }}
    >
      <span className="absolute -top-5 left-0 text-[10px] font-semibold text-emerald-100 bg-emerald-700/90 px-1.5 py-0.5 rounded whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

function NoImageIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
    </svg>
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

function TargetIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
