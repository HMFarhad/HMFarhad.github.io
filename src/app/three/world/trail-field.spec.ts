import { describe, expect, it } from 'vitest';
import { TrailField, type TrailPoint } from './trail-field';

function line(n: number, from: TrailPoint, to: TrailPoint): TrailPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const f = i / (n - 1);
    return { x: from.x + (to.x - from.x) * f, z: from.z + (to.z - from.z) * f };
  });
}

function bruteDistance(points: TrailPoint[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l2 = dx * dx + dz * dz;
    const f = Math.min(1, Math.max(0, l2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / l2 : 0));
    best = Math.min(best, Math.hypot(x - (a.x + dx * f), z - (a.z + dz * f)));
  }
  return best;
}

describe('TrailField', () => {
  it('finds the closest point, arc fraction and side on a straight line', () => {
    const field = new TrailField(line(101, { x: 0, z: 0 }, { x: 100, z: 0 }));
    const hit = field.nearest(50, 3)!;
    expect(hit.distance).toBeCloseTo(3, 6);
    expect(hit.x).toBeCloseTo(50, 6);
    expect(hit.z).toBeCloseTo(0, 6);
    expect(hit.u).toBeCloseTo(0.5, 6);
    expect(hit.tx).toBeCloseTo(1, 6);
    // Tangent +x: three's cross(tangent, up) points to +z, so +z is side +1.
    expect(hit.side).toBe(1);
    expect(field.nearest(50, -3)!.side).toBe(-1);
  });

  it('clamps to the end points beyond the ends of the line', () => {
    const field = new TrailField(line(50, { x: 0, z: 0 }, { x: 10, z: 0 }));
    const hit = field.nearest(-4, 3)!;
    expect(hit.distance).toBeCloseTo(5, 6);
    expect(hit.u).toBe(0);
    expect(field.nearest(13, 4)!.u).toBeCloseTo(1, 6);
  });

  it('respects maxDist and answers far queries without a limit', () => {
    const field = new TrailField(line(200, { x: 0, z: 0 }, { x: 0, z: 100 }));
    expect(field.nearest(30, 50, 10)).toBeNull();
    expect(field.distance(30, 50, 10)).toBe(Infinity);
    expect(field.distance(30, 50)).toBeCloseTo(30, 6);
    expect(field.distance(500, -400)).toBeCloseTo(Math.hypot(500, 400), 4);
  });

  it('matches a brute-force search on a winding polyline', () => {
    const pts: TrailPoint[] = [];
    for (let i = 0; i < 1200; i++) {
      const a = (i / 1199) * Math.PI * 3;
      pts.push({ x: Math.cos(a) * (40 + a * 6), z: Math.sin(a) * (40 + a * 6) });
    }
    const field = new TrailField(pts);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 400; k++) {
      const x = (rand() - 0.5) * 260;
      const z = (rand() - 0.5) * 260;
      const expected = bruteDistance(pts, x, z);
      expect(field.distance(x, z)).toBeCloseTo(expected, 4);
      const capped = field.distance(x, z, 6);
      if (expected <= 5.99) expect(capped).toBeCloseTo(expected, 4);
      if (expected > 6.01) expect(capped).toBe(Infinity);
    }
  });

  it('interpolates points and tangents by arc length', () => {
    const field = new TrailField([...line(11, { x: 0, z: 0 }, { x: 10, z: 0 }), ...line(11, { x: 10, z: 1 }, { x: 10, z: 11 })]);
    const p = field.pointAt(0.25);
    expect(p.z).toBeCloseTo(0, 6);
    const t = field.tangentAt(0.9);
    expect(t.x).toBeCloseTo(0, 6);
    expect(t.z).toBeCloseTo(1, 6);
  });
});
