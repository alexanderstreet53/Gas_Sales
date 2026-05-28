"use client";

// Minimal labelling tool: pick a tile from the strip, drag-rectangle on it,
// pick a class, save. Aims to be enough for a labelling marathon, not
// a Labelbox replacement.

import { useRef, useState } from "react";

interface Tile {
  id: string; signedUrl: string;
  width_px: number; height_px: number;
}

const CLASSES = ["cylinder", "bulk_tank", "bottle_bank", "lng_tank"] as const;
type LabelClass = typeof CLASSES[number];

interface Drag { x: number; y: number; w: number; h: number }

export default function LabelCanvas({ tiles }: { tiles: Tile[] }) {
  const [active, setActive] = useState<Tile | null>(tiles[0] ?? null);
  const [klass, setKlass] = useState<LabelClass>("cylinder");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  if (!active) {
    return <div className="bg-white rounded-xl border p-8 text-center text-slate-500">Fetch some imagery first.</div>;
  }

  function pos(e: React.PointerEvent) {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  async function save(isNegative: boolean) {
    if (!isNegative && !drag) return;
    setSaving(true);
    const bbox = isNegative
      ? [0, 0, active!.width_px, active!.height_px]
      : (() => {
          const r = imgRef.current!.getBoundingClientRect();
          const sx = active!.width_px / r.width;
          const sy = active!.height_px / r.height;
          return [
            Math.round(drag!.x * sx),
            Math.round(drag!.y * sy),
            Math.round((drag!.x + drag!.w) * sx),
            Math.round((drag!.y + drag!.h) * sy),
          ];
        })();

    await fetch("/api/labels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileId: active!.id, class: klass, bbox, isNegative }),
    });
    setSavedCount(c => c + 1);
    setDrag(null); setStart(null); setSaving(false);
  }

  return (
    <div className="grid md:grid-cols-4 gap-4">
      <aside className="md:col-span-1 space-y-2">
        <div className="text-xs uppercase tracking-wide text-slate-500">Tiles</div>
        {/* Horizontal strip on mobile, vertical column on desktop. */}
        <div className="flex md:block gap-2 md:space-y-2 overflow-x-auto md:overflow-x-visible md:max-h-[520px] md:overflow-y-auto pb-2 md:pb-0">
          {tiles.map(t => (
            <button key={t.id} onClick={() => { setActive(t); setDrag(null); }}
              className={`shrink-0 w-24 md:w-full block overflow-hidden rounded-lg border ${active.id === t.id ? "ring-2 ring-accent" : ""}`}>
              <img src={t.signedUrl} alt="" className="w-full" />
            </button>
          ))}
        </div>
      </aside>

      <section className="md:col-span-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <select value={klass} onChange={e => setKlass(e.target.value as LabelClass)}
            className="border rounded-lg px-3 py-1.5 text-sm capitalize">
            {CLASSES.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
          </select>
          <div className="text-sm text-slate-500">{savedCount} saved this session</div>
        </div>

        <div className="relative bg-white rounded-xl border overflow-hidden select-none touch-none">
          <img
            ref={imgRef}
            src={active.signedUrl}
            alt=""
            className="w-full block"
            onPointerDown={e => {
              (e.target as Element).setPointerCapture(e.pointerId);
              const p = pos(e);
              setStart(p);
              setDrag({ x: p.x, y: p.y, w: 0, h: 0 });
            }}
            onPointerMove={e => {
              if (!start) return;
              const p = pos(e);
              setDrag({
                x: Math.min(start.x, p.x),
                y: Math.min(start.y, p.y),
                w: Math.abs(p.x - start.x),
                h: Math.abs(p.y - start.y),
              });
            }}
            onPointerUp={() => setStart(null)}
            onPointerCancel={() => setStart(null)}
            draggable={false}
          />
          {drag && (
            <div className="absolute border-2 border-accent pointer-events-none"
              style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => save(false)} disabled={!drag || saving}
            className="px-3 py-2 rounded-lg bg-ink text-white disabled:opacity-40 text-sm">
            Save box ({klass})
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="px-3 py-2 rounded-lg border text-sm">
            Mark whole tile negative
          </button>
        </div>
      </section>
    </div>
  );
}
