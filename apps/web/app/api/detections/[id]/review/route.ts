import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";

const Body = z.object({ result: z.enum(["confirmed", "rejected"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("detections")
    .update({
      reviewed: true,
      review_result: parsed.data.result,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ detection: data });
}
