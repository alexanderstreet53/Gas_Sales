import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";

const Patch = z.object({
  status: z.enum(["new","verified","contacted","converted","rejected"]).optional(),
  business_name: z.string().max(200).nullable().optional(),
  business_type: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  formatted_addr: z.string().max(300).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const sb = supabaseService();
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "contacted") updates.contacted_at = new Date().toISOString();
  const { data, error } = await sb
    .from("leads")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();
  const { error } = await sb.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
