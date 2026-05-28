"use client";

import { useState } from "react";

interface ReviewItem {
  id: string;
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
  signedUrl: string;
  tileWidth: number;
  tileHeight: number;
}

export default function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const [queue, setQueue] = useState(items);

  async function decide(id: string, result: "confirmed" | "rejected") {
    await fetch(`/api/detections/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    setQueue(q => q.filter(i => i.id !== id));
  }

  if (queue.length === 0) {
    return <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No detections waiting for review.</div>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {queue.map(it => (
        <div key={it.id} className="bg-white rounded-xl border overflow-hidden">
          <div className="relative">
            <img src={it.signedUrl} alt="" className="w-full" />
            <div
              className="absolute border-2 border-emerald-400 pointer-events-none"
              style={{
                left:   `${(it.bbox[0] / it.tileWidth) * 100}%`,
                top:    `${(it.bbox[1] / it.tileHeight) * 100}%`,
                width:  `${((it.bbox[2] - it.bbox[0]) / it.tileWidth) * 100}%`,
                height: `${((it.bbox[3] - it.bbox[1]) / it.tileHeight) * 100}%`,
              }}
            />
          </div>
          <div className="p-3 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium capitalize">{it.class}</div>
              <div className="text-xs text-slate-500">{(it.confidence * 100).toFixed(0)}%</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => decide(it.id, "rejected")}
                className="px-3 py-1.5 rounded-lg border text-slate-600">Reject</button>
              <button onClick={() => decide(it.id, "confirmed")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
