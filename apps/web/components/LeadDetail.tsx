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
    sites?: { centroid: GeoJSON.Point | unknown } | null;
  };
  topDetection: {
    bbox_pixels: number[] | null;
    confidence: number;
    imagery_tiles: { width_px: number; height_px: number } | null;
  } | null;
  signedUrl: string | null;
}

export default function LeadDetail({ lead, topDetection, signedUrl }: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [name, setName] = useState(lead.business_name ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes, business_name: name || null }),
    });
    setSaving(false);
  }

  const tile = topDetection?.imagery_tiles;
  const bbox = topDetection?.bbox_pixels as [number, number, number, number] | undefined;

  return (
    <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
      <section className="md:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border overflow-hidden">
          {signedUrl && tile ? (
            <div className="relative">
              <img src={signedUrl} alt="" className="w-full" />
              {bbox && (
                <div className="absolute border-2 border-emerald-400 pointer-events-none" style={{
                  left:   `${(bbox[0] / tile.width_px) * 100}%`,
                  top:    `${(bbox[1] / tile.height_px) * 100}%`,
                  width:  `${((bbox[2] - bbox[0]) / tile.width_px) * 100}%`,
                  height: `${((bbox[3] - bbox[1]) / tile.height_px) * 100}%`,
                }} />
              )}
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center text-sm text-slate-500">
              No imagery available yet.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Lead</h2>
            <StatusPill status={status} />
          </div>
          <div className="text-xs text-slate-500">{lead.zones?.name}</div>
          <div className="text-sm">{lead.formatted_addr ?? <em>address unknown</em>}</div>
          <div className="text-xs text-slate-500">Confidence {(lead.confidence * 100).toFixed(0)}%</div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <label className="block text-xs uppercase tracking-wide text-slate-500">Business name</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={name} onChange={e => setName(e.target.value)}
            placeholder="If known"
          />
          <label className="block text-xs uppercase tracking-wide text-slate-500">Status</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={status}
            onChange={e => setStatus(e.target.value as LeadStatus)}>
            {(["new","verified","contacted","converted","rejected"] as LeadStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="block text-xs uppercase tracking-wide text-slate-500">Notes</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-24"
            value={notes} onChange={e => setNotes(e.target.value)} />
          <button onClick={save} disabled={saving}
            className="w-full text-sm px-3 py-2 rounded-lg bg-ink text-white disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
}
