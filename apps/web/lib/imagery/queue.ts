// Bulk tile fetcher with QPS limiting + spend cap awareness.
//
// Vercel's serverless functions cap out at 60–300s depending on plan, so for
// big zones the caller should chunk and resume; this helper handles a chunk.

import pLimit from "p-limit";
import { env } from "@/lib/env";
import { tileZone, type TileCell } from "@/lib/geo/tiles";
import { fetchSatelliteTile } from "@/lib/imagery/google";
import { spendLast24hUsd } from "@/lib/imagery/cost";

export interface FetchZoneChunkResult {
  zoneId: string;
  attempted: number;
  fetched: number;
  cacheHits: number;
  spent24hAfter: number;
  stoppedReason: "complete" | "budget_cap" | "chunk_limit";
}

export async function fetchZoneChunk(args: {
  zoneId: string;
  boundary: GeoJSON.Polygon;
  zoom: number;
  maxTiles?: number;
}): Promise<FetchZoneChunkResult> {
  const cells: TileCell[] = tileZone(args.boundary, args.zoom);
  const limit = pLimit(env.imageryQps);
  const cap = args.maxTiles ?? 200;

  let fetched = 0;
  let cacheHits = 0;
  let stoppedReason: FetchZoneChunkResult["stoppedReason"] = "complete";

  const work = cells.slice(0, cap).map(cell => limit(async () => {
    const spent = await spendLast24hUsd();
    if (spent >= env.imageryDailyCapUsd) { stoppedReason = "budget_cap"; return; }
    const tile = await fetchSatelliteTile({
      zoneId: args.zoneId,
      centerLat: cell.centerLat, centerLng: cell.centerLng,
      zoom: cell.z,
    });
    fetched += 1;
    // findFreshTile returns same shape on a cache hit; cheap heuristic:
    // tiles whose fetched_at < 5s old were definitely just written.
    const isHit = Date.now() - new Date(tile.fetched_at).getTime() > 5_000;
    if (isHit) cacheHits += 1;
  }));

  await Promise.all(work);
  if (cells.length > cap) stoppedReason = "chunk_limit";

  return {
    zoneId: args.zoneId,
    attempted: Math.min(cells.length, cap),
    fetched,
    cacheHits,
    spent24hAfter: await spendLast24hUsd(),
    stoppedReason,
  };
}
