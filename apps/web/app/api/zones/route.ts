import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

const CreateZoneBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  boundary: PolygonSchema,
  zoom: z.number().int().min(14).max(21).default(19),
  status: z.enum(["draft","active","paused","archived"]).default("draft"),
});

export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("zones")
    .select("id, name, description, status, zoom, created_at, updated_at, boundary")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data });
}

export async function POST(req: Request) {
  const parsed = CreateZoneBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sb = supabaseService();
  const ring = parsed.data.boundary.coordinates[0]
    .map(([lng, lat]) => `${lng} ${lat}`).join(",");
  const ewkt = `SRID=4326;POLYGON((${ring}))`;

  const { data, error } = await sb
    .from("zones")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      boundary: ewkt,
      zoom: parsed.data.zoom,
      status: parsed.data.status,
    })
    .select("id, name, status, zoom")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data }, { status: 201 });
}
