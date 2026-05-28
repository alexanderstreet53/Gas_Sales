import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchStreetViewTile } from "@/lib/imagery/google";

const Q = z.object({
  zoneId: z.string().uuid().nullish(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  heading: z.coerce.number().min(0).max(360).default(0),
  pitch: z.coerce.number().min(-90).max(90).default(0),
});

export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Q.safeParse(sp);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const tile = await fetchStreetViewTile({
      zoneId: parsed.data.zoneId ?? null,
      lat: parsed.data.lat, lng: parsed.data.lng,
      heading: parsed.data.heading, pitch: parsed.data.pitch,
    });
    return NextResponse.json({ tile });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
