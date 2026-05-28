import clsx from "clsx";
import type { LeadStatus } from "@/lib/types";

const STYLES: Record<LeadStatus, { tone: string; dot: string }> = {
  new:       { tone: "bg-blue-50 text-blue-700 border-blue-100",         dot: "bg-blue-500" },
  verified:  { tone: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  contacted: { tone: "bg-amber-50 text-amber-800 border-amber-100",      dot: "bg-amber-500" },
  converted: { tone: "bg-violet-50 text-violet-700 border-violet-100",   dot: "bg-violet-500" },
  rejected:  { tone: "bg-slate-100 text-slate-500 border-slate-200",     dot: "bg-slate-400" },
};

export default function StatusPill({ status }: { status: LeadStatus }) {
  const s = STYLES[status];
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full capitalize border font-medium",
      s.tone,
    )}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}
