import SeedRealDataButton from "./SeedRealDataButton";
import CompaniesHouseSeedButton from "./CompaniesHouseSeedButton";
import StreetViewScanButton from "./StreetViewScanButton";

export default function DataSourcesPanel({
  hasLeads,
  zoneId,
}: { hasLeads: boolean; zoneId?: string }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Source
        title="OpenStreetMap"
        desc="Real welders, fabricators, gas suppliers tagged in OSM. No API key required."
        action={<SeedRealDataButton />}
      />
      <Source
        title="Companies House"
        desc="Registered UK businesses by SIC code (metalwork, gas, engineering). Free API key required."
        action={<CompaniesHouseSeedButton />}
      />
      <Source
        title="Street View scan"
        desc={hasLeads
          ? "Pull a Google Street View image of each lead. ~$0.007 per call after free tier."
          : "Pull leads first, then run a Street View scan."}
        action={<StreetViewScanButton zoneId={zoneId} variant={hasLeads ? "primary" : "ghost"} />}
        disabled={!hasLeads}
      />
    </div>
  );
}

function Source({ title, desc, action, disabled }: {
  title: string; desc: string; action: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col gap-3 ${disabled ? "opacity-60" : ""}`}>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  );
}
