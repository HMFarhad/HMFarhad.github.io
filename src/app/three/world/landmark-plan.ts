import * as THREE from 'three';
import type { Zone, ZoneId } from '../../core/content/zone.model';
import type { TrailField, TrailPoint } from './trail-field';

/**
 * Where each station's landmark sits. Planned before the terrain is built,
 * because the terrain flattens a pad under every anchor (and carves the
 * stream bed for the projects stop).
 */
export interface LandmarkAnchor {
  index: number;
  id: ZoneId;
  /** Arc fraction of the trail point the landmark sits beside (may exceed the station). */
  t: number;
  x: number;
  z: number;
  /** Ground height at the anchor; filled in once the terrain exists. */
  y: number;
  /** +1: on the `cross(tangent, up)` side (camera right), -1: camera left. */
  side: 1 | -1;
  /** Yaw for the landmark group so its local +Z faces the trail. */
  facing: number;
  /** Distance from the trail centre line. */
  lateral: number;
  /** Trail tangent beside the anchor. */
  tx: number;
  tz: number;
  /** Radius kept clear of procedural trees and undergrowth. */
  clearRadius: number;
  /** Radius of the flat terrain pad. */
  padRadius: number;
  /** Stream centre line in world XZ (projects stop only). */
  stream?: TrailPoint[];
}

/** Metres ahead of the station the landmark sits, so it is in view on arrival. */
const AHEAD_M = 9;
const LATERAL_M = 5;
const STREAM_LATERAL_M = 6.5;
const MIN_ANCHOR_SPACING = 16;

const FOOTPRINT: Record<ZoneId, { clear: number; pad: number }> = {
  about:      { clear: 7.0, pad: 4.0 },
  skills:     { clear: 5.0, pad: 4.0 },
  experience: { clear: 6.0, pad: 5.0 },
  projects:   { clear: 4.0, pad: 2.5 },
  education:  { clear: 4.5, pad: 3.5 },
  blogs:      { clear: 4.0, pad: 3.5 },
  contact:    { clear: 4.5, pad: 4.0 },
};

export function planLandmarkAnchors(
  zones: readonly Zone[],
  stationProgress: readonly number[],
  curve: THREE.Curve<THREE.Vector3>,
  field: TrailField,
): LandmarkAnchor[] {
  const len = field.length;
  const anchors: LandmarkAnchor[] = [];
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();

  zones.forEach((zone, index) => {
    const station = stationProgress[index] ?? 0;
    const wanted = station + AHEAD_M / len;
    const t = Math.min(1, wanted);
    curve.getPointAt(t, pos);
    curve.getTangentAt(t, tan);
    tan.y = 0;
    tan.normalize();
    // Past the end of the trail: extrapolate along the final tangent.
    if (wanted > 1) pos.addScaledVector(tan, (wanted - 1) * len);

    const lateral = zone.id === 'projects' ? STREAM_LATERAL_M : LATERAL_M;
    // Prefer the camera's left (-1): the station card occupies the right of the
    // screen on desktop and the bottom on phones, so a landmark ahead-left
    // stays in view while the card is open. Fall back to the right when the
    // left spot crowds another trail leg or landmark.
    const preferred: 1 | -1 = -1;
    const candidate = (side: 1 | -1) => {
      const x = pos.x - tan.z * side * lateral;
      const z = pos.z + tan.x * side * lateral;
      const trailDist = field.distance(x, z);
      let spacing = Infinity;
      for (const a of anchors) spacing = Math.min(spacing, Math.hypot(a.x - x, a.z - z));
      // Score: how comfortably the spot clears other trail legs and other landmarks.
      const score = Math.min(trailDist - (lateral - 0.75), (spacing - MIN_ANCHOR_SPACING) / 4);
      return { x, z, side, score };
    };
    const a = candidate(preferred);
    const b = candidate((-preferred) as 1 | -1);
    const best = a.score >= 0 || a.score >= b.score ? a : b;

    const near = field.nearest(best.x, best.z);
    const toTrailX = (near?.x ?? pos.x) - best.x;
    const toTrailZ = (near?.z ?? pos.z) - best.z;
    const fp = FOOTPRINT[zone.id];
    const anchor: LandmarkAnchor = {
      index, id: zone.id, t,
      x: best.x, z: best.z, y: 0,
      side: best.side,
      facing: Math.atan2(toTrailX, toTrailZ),
      lateral,
      tx: tan.x, tz: tan.z,
      clearRadius: fp.clear,
      padRadius: fp.pad,
    };
    if (zone.id === 'projects') anchor.stream = planStream(anchor, field);
    anchors.push(anchor);
  });
  return anchors;
}

/** A meandering stream beside the trail whose ends bend away into the forest. */
function planStream(a: LandmarkAnchor, field: TrailField): TrailPoint[] {
  // Unit vector pointing away from the trail.
  const awayX = -a.tz * a.side;
  const awayZ = a.tx * a.side;
  const pts: TrailPoint[] = [];
  for (let s = -11; s <= 11; s += 1) {
    const bend = 0.035 * s * s + Math.sin(s * 0.45) * 0.5;
    let x = a.x + a.tx * s + awayX * bend;
    let z = a.z + a.tz * s + awayZ * bend;
    // Keep the banks well clear of the trail even where it curves toward us.
    for (let k = 0; k < 20 && field.distance(x, z, 6) < 4.6; k++) {
      x += awayX * 0.4;
      z += awayZ * 0.4;
    }
    pts.push({ x, z });
  }
  return pts;
}

/** Distance from (x, z) to a polyline. */
export function distanceToPolyline(pts: readonly TrailPoint[], x: number, z: number): { d: number; f: number } {
  let best = Infinity, bestF = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, az = pts[i].z;
    const dx = pts[i + 1].x - ax, dz = pts[i + 1].z - az;
    const l2 = dx * dx + dz * dz;
    const f = Math.min(1, Math.max(0, l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0));
    const d = Math.hypot(x - (ax + dx * f), z - (az + dz * f));
    if (d < best) { best = d; bestF = (i + f) / (pts.length - 1); }
  }
  return { d: best, f: bestF };
}

/**
 * Signed clearance from the nearest landmark footprint: negative inside a
 * footprint (or within 2.2 m of the stream), positive outside.
 */
export function landmarkClearance(anchors: readonly LandmarkAnchor[], x: number, z: number): number {
  let best = Infinity;
  for (const a of anchors) {
    const d = Math.hypot(x - a.x, z - a.z);
    best = Math.min(best, d - a.clearRadius);
    if (a.stream && d < 20) best = Math.min(best, distanceToPolyline(a.stream, x, z).d - 2.2);
  }
  return best;
}

export function nearLandmark(anchors: readonly LandmarkAnchor[], x: number, z: number, pad = 0): boolean {
  return landmarkClearance(anchors, x, z) < pad;
}
