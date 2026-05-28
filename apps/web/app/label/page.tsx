import { supabaseService } from "@/lib/supabase/server";
import LabelCanvas from "@/components/LabelCanvas";

export const dynamic = "force-dynamic";

export default async function LabelPage() {
  const sb = supabaseService();
  const { data: tiles } = await sb
    .from("imagery_tiles")
    .select("id, storage_path, width_px, height_px, kind")
    .eq("kind", "satellite")
    .order("fetched_at", { ascending: false })
    .limit(50);

  const withUrls = await Promise.all((tiles ?? []).map(async t => {
    const signed = await sb.storage.from("imagery").createSignedUrl(t.storage_path, 60 * 60);
    return { ...t, signedUrl: signed.data?.signedUrl ?? "" };
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Labelling</h1>
        <p className="text-slate-600 text-sm mt-1 max-w-2xl">
          Draw boxes around gas cylinders, bulk LNG tanks, or oxy-acetylene
          bottle banks. Aim for ~300 boxes across positive and negative
          examples before fine-tuning the model.
        </p>
      </div>
      <LabelCanvas tiles={withUrls} />
    </div>
  );
}
