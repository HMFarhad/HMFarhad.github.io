/**
 * Spatial index over the trail centre line. The curve is sampled into a dense
 * polyline (default 1200 arc-length samples) and bucketed into a uniform grid,
 * so "how far is this point from the trail, and where is the closest trail
 * point" is a handful of array reads instead of a scan of every sample.
 *
 * Pure TypeScript with no three.js or DOM dependency so it can be unit-tested.
 * Coordinates are world X/Z in metres; `u` is the arc-length fraction 0..1 of
 * the closest point (the same parameter `curve.getPointAt(u)` takes).
 */
export interface TrailPoint { x: number; z: number; }

export interface TrailNearest {
  /** Distance from the query point to the trail centre line. */
  distance: number;
  /** Closest point on the centre line. */
  x: number;
  z: number;
  /** Arc-length fraction of the closest point. */
  u: number;
  /** Unit tangent (direction of travel) at the closest point. */
  tx: number;
  tz: number;
  /**
   * +1 when the query lies on the side of `(-tz, tx)` (three's
   * `cross(tangent, up)`), -1 on the other side, 0 on the line.
   */
  side: number;
}

export class TrailField {
  readonly count: number;
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  /** Cumulative arc length at each sample. */
  readonly lengths: Float64Array;
  readonly length: number;

  private readonly cell: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly cols: number;
  private readonly rows: number;
  /** cellStart[c]..cellStart[c+1] index into cellItems. */
  private readonly cellStart: Int32Array;
  private readonly cellItems: Int32Array;

  constructor(points: readonly TrailPoint[], cellSize = 4) {
    if (points.length < 2) throw new Error('TrailField needs at least two points');
    this.count = points.length;
    this.cell = cellSize;
    this.xs = new Float64Array(this.count);
    this.zs = new Float64Array(this.count);
    this.lengths = new Float64Array(this.count);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const p = points[i];
      this.xs[i] = p.x;
      this.zs[i] = p.z;
      if (i > 0) {
        this.lengths[i] = this.lengths[i - 1] + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      }
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    this.length = this.lengths[this.count - 1];
    this.minX = minX - cellSize;
    this.minZ = minZ - cellSize;
    this.cols = Math.max(1, Math.ceil((maxX - this.minX) / cellSize) + 2);
    this.rows = Math.max(1, Math.ceil((maxZ - this.minZ) / cellSize) + 2);

    // Counting sort of samples into cells (CSR layout).
    const cells = this.cols * this.rows;
    const counts = new Int32Array(cells + 1);
    const cellOf = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const c = this.cellIndex(this.xs[i], this.zs[i]);
      cellOf[i] = c;
      counts[c + 1]++;
    }
    for (let c = 0; c < cells; c++) counts[c + 1] += counts[c];
    this.cellStart = counts;
    this.cellItems = new Int32Array(this.count);
    const fill = counts.slice(0, cells);
    for (let i = 0; i < this.count; i++) this.cellItems[fill[cellOf[i]]++] = i;
  }

  /** Build from any sampler, e.g. `(u) => curve.getPointAt(u)`. */
  static fromSampler(sample: (u: number) => TrailPoint, count = 1200, cellSize = 4): TrailField {
    const pts: TrailPoint[] = [];
    for (let i = 0; i < count; i++) {
      const p = sample(count === 1 ? 0 : i / (count - 1));
      pts.push({ x: p.x, z: p.z });
    }
    return new TrailField(pts, cellSize);
  }

  /**
   * Closest point on the trail. Returns null when nothing lies within
   * `maxDist` (pass a small `maxDist` for fast "is this near the trail" tests).
   */
  nearest(x: number, z: number, maxDist = Infinity): TrailNearest | null {
    const idx = this.nearestSample(x, z, maxDist);
    if (idx < 0) return null;
    // Refine against the two segments adjacent to the nearest sample.
    let bestD2 = Infinity, bestX = 0, bestZ = 0, bestSeg = idx, bestF = 0;
    for (let s = Math.max(0, idx - 1); s <= Math.min(this.count - 2, idx); s++) {
      const ax = this.xs[s], az = this.zs[s];
      const dx = this.xs[s + 1] - ax, dz = this.zs[s + 1] - az;
      const len2 = dx * dx + dz * dz;
      let f = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      const px = ax + dx * f, pz = az + dz * f;
      const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d2 < bestD2) { bestD2 = d2; bestX = px; bestZ = pz; bestSeg = s; bestF = f; }
    }
    const distance = Math.sqrt(bestD2);
    if (distance > maxDist) return null;
    const s = Math.min(bestSeg, this.count - 2);
    let tx = this.xs[s + 1] - this.xs[s];
    let tz = this.zs[s + 1] - this.zs[s];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const along = this.lengths[s] + (this.lengths[s + 1] - this.lengths[s]) * bestF;
    const cross = tx * (z - bestZ) - tz * (x - bestX);
    return {
      distance, x: bestX, z: bestZ,
      u: this.length > 0 ? along / this.length : 0,
      tx, tz,
      side: distance < 1e-9 ? 0 : cross > 0 ? 1 : -1,
    };
  }

  /** Distance to the trail centre line, or Infinity when beyond `maxDist`. */
  distance(x: number, z: number, maxDist = Infinity): number {
    return this.nearest(x, z, maxDist)?.distance ?? Infinity;
  }

  /** Interpolated centre-line point at arc-length fraction `u` (clamped). */
  pointAt(u: number, out: TrailPoint = { x: 0, z: 0 }): TrailPoint {
    const target = Math.min(1, Math.max(0, u)) * this.length;
    const i = this.segmentAt(target);
    const seg = this.lengths[i + 1] - this.lengths[i];
    const f = seg > 0 ? (target - this.lengths[i]) / seg : 0;
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * f;
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * f;
    return out;
  }

  /** Unit tangent at arc-length fraction `u` (clamped). */
  tangentAt(u: number, out: TrailPoint = { x: 0, z: 1 }): TrailPoint {
    const target = Math.min(1, Math.max(0, u)) * this.length;
    const i = this.segmentAt(target);
    const dx = this.xs[i + 1] - this.xs[i], dz = this.zs[i + 1] - this.zs[i];
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
  }

  // ---------------------------------------------------------------- internals
  private cellIndex(x: number, z: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)));
    const cz = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)));
    return cz * this.cols + cx;
  }

  private segmentAt(arc: number): number {
    let lo = 0, hi = this.count - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.lengths[mid] <= arc) lo = mid; else hi = mid;
    }
    return Math.min(lo, this.count - 2);
  }

  /** Index of the closest sample within maxDist (ring search), or -1. */
  private nearestSample(x: number, z: number, maxDist: number): number {
    const fx = (x - this.minX) / this.cell;
    const fz = (z - this.minZ) / this.cell;
    const cx = Math.floor(fx), cz = Math.floor(fz);
    // Distance from the query to the grid's bounding box, in cells; rings
    // closer than this are empty by construction.
    const outsideX = fx < 0 ? -fx : fx > this.cols ? fx - this.cols : 0;
    const outsideZ = fz < 0 ? -fz : fz > this.rows ? fz - this.rows : 0;
    const startRing = Math.max(0, Math.floor(Math.max(outsideX, outsideZ)) - 1);
    const maxRingByDist = Number.isFinite(maxDist) ? Math.ceil(maxDist / this.cell) + 2 : Infinity;
    const maxRingByGrid = Math.max(this.cols, this.rows) + startRing + 2;
    const maxRing = Math.min(maxRingByDist, maxRingByGrid);
    // Padding samples beyond maxDist accounts for the segment refinement step,
    // which can only move the answer closer.
    const limit2 = Number.isFinite(maxDist) ? (maxDist + this.cell) * (maxDist + this.cell) : Infinity;

    let best = -1;
    let bestD2 = limit2;
    for (let r = startRing; r <= maxRing; r++) {
      // Every sample in ring r is at least (r - 1) cells away.
      if (best >= 0 && (r - 1) * this.cell > 0 && ((r - 1) * this.cell) ** 2 > bestD2) break;
      const z0 = cz - r, z1 = cz + r, x0 = cx - r, x1 = cx + r;
      for (let gz = z0; gz <= z1; gz++) {
        if (gz < 0 || gz >= this.rows) continue;
        const edgeRow = gz === z0 || gz === z1;
        const step = edgeRow ? 1 : x1 - x0;
        for (let gx = x0; gx <= x1; gx += step || 1) {
          if (gx < 0 || gx >= this.cols) continue;
          const c = gz * this.cols + gx;
          for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
            const i = this.cellItems[k];
            const dx = this.xs[i] - x, dz = this.zs[i] - z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) { bestD2 = d2; best = i; }
          }
          if (step === 0) break;
        }
      }
    }
    return best;
  }
}

export interface ScatterPoint {
  x: number;
  z: number;
  /** Actual distance to the trail (another leg of the trail may be closer than the one sampled). */
  lateral: number;
  u: number;
}

export interface ScatterOptions {
  latMin: number;
  latMax: number;
  /** >1 biases samples toward latMin (the trail edge). */
  bias?: number;
  maxTries?: number;
  accept?: (x: number, z: number, lateral: number) => boolean;
  rand?: () => number;
}

/** Random points beside the trail, on either side, between latMin and latMax. */
export function scatterNearTrail(field: TrailField, count: number, opts: ScatterOptions): ScatterPoint[] {
  const rand = opts.rand ?? Math.random;
  const bias = opts.bias ?? 1;
  const out: ScatterPoint[] = [];
  const p: TrailPoint = { x: 0, z: 0 };
  const t: TrailPoint = { x: 0, z: 1 };
  let tries = opts.maxTries ?? count * 8;
  while (out.length < count && tries-- > 0) {
    const u = rand();
    field.pointAt(u, p);
    field.tangentAt(u, t);
    const side = rand() < 0.5 ? -1 : 1;
    const lat = opts.latMin + (opts.latMax - opts.latMin) * Math.pow(rand(), bias);
    const x = p.x - t.z * side * lat;
    const z = p.z + t.x * side * lat;
    const lateral = field.distance(x, z, opts.latMax + 4);
    const actual = Number.isFinite(lateral) ? lateral : opts.latMax + 4;
    if (actual < opts.latMin) continue;
    if (opts.accept && !opts.accept(x, z, actual)) continue;
    out.push({ x, z, lateral: actual, u });
  }
  return out;
}
