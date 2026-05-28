// On-demand fetch for a single satellite tile, used by the labelling and
// review pages. Always goes through the cache.

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSatelliteTile } from "@/lib/imagery/google";

const Q = z.object({
  zoneId: z.string().uuid().nullish(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  zoom: z.coerce.number().int().min(14).max(21).default(19),
});

export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Q.safeParse(sp);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const tile = await fetchSatelliteTile({
      zoneId: parsed.data.zoneId ?? null,
      centerLat: parsed.data.lat, centerLng: parsed.data.lng, zoom: parsed.data.zoom,
    });
    return NextResponse.json({ tile });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
