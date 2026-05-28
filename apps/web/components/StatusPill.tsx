import clsx from "clsx";
import type { LeadStatus } from "@/lib/types";

const STYLES: Record<LeadStatus, string> = {
  new:       "bg-blue-50 text-blue-700",
  verified:  "bg-emerald-50 text-emerald-700",
  contacted: "bg-amber-50 text-amber-700",
  converted: "bg-violet-50 text-violet-700",
  rejected:  "bg-slate-100 text-slate-500",
};

export default function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={clsx("text-xs px-2 py-0.5 rounded-full capitalize", STYLES[status])}>
      {status}
    </span>
  );
}
