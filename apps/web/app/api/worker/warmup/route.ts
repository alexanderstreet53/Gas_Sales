// Wake the YOLO worker before a detect call so cold starts don't surface
// as "fetch failed" errors. The client fires this on page load; the
// detect endpoints also retry it once if the first detect attempt
// fails. Cheap (just hits /healthz), idempotent.

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.workerUrl || env.workerUrl.includes("localhost")) {
    return NextResponse.json({ ok: false, reason: "worker_not_configured" });
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(`${env.workerUrl}/healthz`, {
      signal: AbortSignal.timeout(50_000), // generous: PyTorch import is slow
    });
    const tookMs = Date.now() - startedAt;
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, tookMs });
    }
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, tookMs, ...body });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      reason: "unreachable",
      detail: (e as Error).message,
      tookMs: Date.now() - startedAt,
    });
  }
}
