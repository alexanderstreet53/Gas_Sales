import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";

const Bbox = z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]);
const Body = z.object({
  tileId: z.string().uuid(),
  class: z.string().min(1).max(40),
  bbox: Bbox,
  isNegative: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb.from("training_labels").insert({
    tile_id: parsed.data.tileId,
    class: parsed.data.class,
    bbox_pixels: parsed.data.bbox,
    is_negative: parsed.data.isNegative,
    notes: parsed.data.notes ?? null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ label: data }, { status: 201 });
}
