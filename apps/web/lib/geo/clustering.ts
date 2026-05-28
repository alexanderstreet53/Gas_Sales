// Cluster nearby detections into candidate sites.
//
// We use DBSCAN with great-circle distances on the detection centroids.
// Epsilon defaults to 25m — close enough that two tanks on the same
// premises hit one cluster, far enough that adjacent units don't merge.

import { DBSCAN } from "density-clustering";
import * as turf from "@turf/turf";

export interface ClusterableDetection {
  id: string;
  lng: number;
  lat: number;
  confidence: number;
}

export interface SiteCluster {
  centroidLng: number;
  centroidLat: number;
  hull: GeoJSON.Polygon | null;
  bestConfidence: number;
  detectionIds: string[];
}

/** Approximate distance between two lng/lat points in metres (good enough for ε≪1km). */
function haversineMetres(a: [number, number], b: [number, number]): number {
  return turf.distance(turf.point(a), turf.point(b), { units: "meters" });
}

export function clusterDetections(
  detections: ClusterableDetection[],
  epsilonMetres = 25,
  minPoints = 1,
): SiteCluster[] {
  if (detections.length === 0) return [];

  const points = detections.map(d => [d.lng, d.lat] as [number, number]);
  const dbscan = new DBSCAN();
  const clusterIndexes: number[][] = dbscan.run(
    points,
    epsilonMetres,
    minPoints,
    haversineMetres as (a: number[], b: number[]) => number,
  );

  // DBSCAN's `noise` array holds points that didn't fit a cluster; for our
  // purposes, a single high-confidence tank IS a site. Promote each.
  const allClusters: number[][] = [...clusterIndexes, ...dbscan.noise.map(i => [i])];

  return allClusters.map(idxs => {
    const memberPoints = idxs.map(i => points[i]);
    const memberDets   = idxs.map(i => detections[i]);
    const centroid     = turf.centroid(turf.featureCollection(memberPoints.map(p => turf.point(p))));
    let hull: GeoJSON.Polygon | null = null;
    if (memberPoints.length >= 3) {
      const hullFeat = turf.convex(turf.featureCollection(memberPoints.map(p => turf.point(p))));
      hull = (hullFeat?.geometry as GeoJSON.Polygon) ?? null;
    }
    return {
      centroidLng:    centroid.geometry.coordinates[0],
      centroidLat:    centroid.geometry.coordinates[1],
      hull,
      bestConfidence: Math.max(...memberDets.map(d => d.confidence)),
      detectionIds:   memberDets.map(d => d.id),
    };
  });
}
