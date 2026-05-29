"use client";

import { useState } from "react";
import StatusPill from "@/components/StatusPill";
import type { LeadStatus } from "@/lib/types";

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
  topDetection: {
    bbox_pixels: number[] | null;
    confidence: number;
    imagery_tiles: { width_px: number; height_px: number } | null;
  } | null;
  satelliteUrl: string | null;
  streetViewUrl: string | null;
  streetViewEmbedSrc: string | null;
  latLng: { lat: number; lng: number } | null;
}

type View = "street" | "satellite";

export default function LeadDetail({ lead, topDetection, satelliteUrl, streetViewUrl, streetViewEmbedSrc, latLng }: Props) {
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

  // Default to whichever view we actually have imagery for. Interactive
  // embed wins over the cached static snapshot when both are available.
  const hasInteractiveStreet = !!streetViewEmbedSrc;
  const hasStaticStreet = !!streetViewUrl;
  const showStreet = hasInteractiveStreet || hasStaticStreet;
  const initialView: View = showStreet ? "street" : "satellite";
  const [view, setView] = useState<View>(initialView);

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
      const res = await fetch(`/api/leads/${lead.id}/streetview`, { method: "POST" });
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
      const res = await fetch(`/api/leads/${lead.id}/detect`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setDetectError(json.message ?? json.error ?? "Detection failed"); return; }
      setDetectResult(
        `${json.detectionsFound} detection${json.detectionsFound === 1 ? "" : "s"} on the tile covering this lead` +
        (json.duplicates ? ` (${json.duplicates} duplicate)` : ""),
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setDetectError((e as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  const tile = topDetection?.imagery_tiles;
  const bbox = topDetection?.bbox_pixels as [number, number, number, number] | undefined;

  const gMapsUrl = latLng
    ? `https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`
    : null;
  const gStreetViewUrl = latLng
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLng.lat},${latLng.lng}`
    : null;

  const showSatellite = satelliteUrl && tile;
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
          hasInteractiveStreet ? (
            <div className="bg-slate-900">
              <iframe
                src={streetViewEmbedSrc!}
                title="Street View"
                className="w-full block border-0"
                style={{ aspectRatio: "16 / 10" }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="relative bg-slate-900">
              <img src={streetViewUrl!} alt="Street View" className="w-full block" />
            </div>
          )
        ) : view === "satellite" && showSatellite ? (
          <div className="relative bg-slate-900">
            <img src={satelliteUrl!} alt="Satellite" className="w-full block" />
            {bbox && (
              <div className="absolute border-2 border-emerald-400 pointer-events-none rounded-sm" style={{
                left:   `${(bbox[0] / tile!.width_px) * 100}%`,
                top:    `${(bbox[1] / tile!.height_px) * 100}%`,
                width:  `${((bbox[2] - bbox[0]) / tile!.width_px) * 100}%`,
                height: `${((bbox[3] - bbox[1]) / tile!.height_px) * 100}%`,
              }} />
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
          <div>
            <h2 className="font-medium text-sm">Scan this lead</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Run just this one premises instead of the whole zone. Cache hits are free.
            </p>
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
