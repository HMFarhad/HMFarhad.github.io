import * as THREE from 'three';

/**
 * Procedural canvas textures for the forest, created lazily and cached so
 * every system shares one GPU upload per texture. Cutout shapes are drawn at
 * alpha >= 0.65 and their materials use alphaTest >= 0.4, which avoids the
 * dark premultiplied fringes semi-transparent canvas edges otherwise produce.
 *
 * Browser-only (uses document.createElement('canvas')); the forest scene is
 * only ever constructed in the browser.
 */

const cache = new Map<string, THREE.Texture>();

function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const tex = make();
  cache.set(key, tex);
  return tex;
}

/** Dispose and forget every cached texture (called from ForestScene.dispose). */
export function clearTextureCache(): void {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!];
}

interface TexOpts { srgb?: boolean; repeat?: boolean; anisotropy?: number; }
function toTexture(canvas: HTMLCanvasElement, opts: TexOpts = {}): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = opts.anisotropy ?? 4;
  tex.needsUpdate = true;
  return tex;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];

/** Almond leaf path centred on the origin, long axis on x. */
function leafPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(0, -h, w / 2, 0);
  ctx.quadraticCurveTo(0, h, -w / 2, 0);
}

/** Draw `fn` at (x,y) and at its wrapped copies so the canvas tiles seamlessly. */
function drawWrapped(size: number, x: number, y: number, margin: number, fn: (x: number, y: number) => void): void {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      const px = x + ox, py = y + oy;
      if (px < -margin || px > size + margin || py < -margin || py > size + margin) continue;
      fn(px, py);
    }
  }
}

// ------------------------------------------------------------- tileable noise
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, period: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (n: number) => ((n % period) + period) % period;
  const a = hash2(m(xi), m(yi)), b = hash2(m(xi + 1), m(yi));
  const c = hash2(m(xi), m(yi + 1)), d = hash2(m(xi + 1), m(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tileable fBm in 0..1 over a `size` square with base frequency `base` cells. */
function fbmField(size: number, base = 4, octaves = 5): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 0.5, sum = 0, norm = 0, freq = base;
      for (let o = 0; o < octaves; o++) {
        sum += amp * valueNoise((x / size) * freq, (y / size) * freq, freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      out[y * size + x] = sum / norm;
    }
  }
  return out;
}

// -------------------------------------------------------------- foliage cards
/** Dense leaf-cluster puff for tree crowns and the canopy overhang. */
export function leafCanopyTexture(): THREE.CanvasTexture {
  return cached('leafCanopy', () => {
    const size = 512;
    const [canvas, ctx] = makeCanvas(size);
    const cx = size / 2, cy = size / 2;
    const palettes = [
      ['#283d1c', '#34501f', '#3a5a25', '#456a2c'],
      ['#3b5a2c', '#4f6e34', '#5e7e38', '#67833d', '#7c9a47'],
      ['#7c9a47', '#8aa84d', '#94b352', '#aac265', '#c0d27a'],
    ];
    // Opaque, lumpy core first so the puff reads as a dense volume and only
    // its rim is broken up by individual leaves.
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * size * 0.2;
      ctx.fillStyle = pick(['#2c4220', '#33501f', '#3a5a25']);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size * rand(0.1, 0.17), size * rand(0.08, 0.14), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const passes = [2600, 2600, 1300];
    const passRadius = [0.5, 0.48, 0.42];
    for (let pi = 0; pi < passes.length; pi++) {
      const R = passRadius[pi] * size;
      for (let i = 0; i < passes[pi]; i++) {
        const a = Math.random() * Math.PI * 2;
        // Lumpy outline so the puff never reads as a disc.
        const lump = 0.82 + 0.18 * Math.sin(a * 5 + pi) * Math.cos(a * 3);
        const r = Math.pow(Math.random(), 0.55) * R * lump;
        const w = rand(3.5, 11.5);
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.96);
        ctx.rotate(Math.random() * Math.PI * 2);
        ctx.fillStyle = pick(palettes[pi]);
        ctx.globalAlpha = rand(0.7, 1);
        leafPath(ctx, w, w * rand(0.4, 0.95));
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.5);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.8, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    return toTexture(canvas, { anisotropy: 8 });
  });
}

/** Low leafy shrub, base along the bottom edge. */
export function bushTexture(): THREE.CanvasTexture {
  return cached('bush', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    const cx = size / 2, cy = size * 0.98;
    const palette = ['#3b5a2c', '#4f6e34', '#67833d', '#7c9a47', '#5c7a3f'];
    for (let i = 0; i < 900; i++) {
      const a = rand(0.05, 0.95) * Math.PI;
      const r = Math.pow(Math.random(), 0.7) * size * 0.46;
      const w = rand(4, 11);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy - Math.abs(Math.sin(a)) * r * 1.6);
      ctx.rotate(Math.random() * Math.PI * 2);
      ctx.fillStyle = pick(palette);
      ctx.globalAlpha = rand(0.7, 1);
      leafPath(ctx, w, w * rand(0.4, 0.9));
      ctx.fill();
      ctx.restore();
    }
    return toTexture(canvas);
  });
}

/** Bark fallback used until the Poly Haven bark photo loads (or forever, offline). */
export function barkFallbackTexture(): THREE.CanvasTexture {
  return cached('bark', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 2) {
      ctx.fillStyle = `hsl(28, 24%, ${rand(26, 52)}%)`;
      ctx.fillRect(x, 0, rand(1, 2.5), size);
    }
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = 'rgba(20,12,5,0.4)';
      ctx.fillRect(Math.random() * size, Math.random() * size, rand(0.6, 1.6), rand(30, 110));
    }
    const tex = toTexture(canvas, { repeat: true });
    tex.repeat.set(1, 4);
    return tex;
  });
}

/** One fern frond, base at the bottom edge (v = 0), tip at the top. */
export function fernTexture(): THREE.CanvasTexture {
  return cached('fern', () => {
    const w = 128, h = 256;
    const [canvas, ctx] = makeCanvas(w, h);
    const colours = ['#5f7d43', '#6f8f4c', '#4d6b37', '#7a9a55'];
    const spine = (t: number) => ({ x: w / 2 + Math.sin(t * 2.2) * 6, y: h - 4 - t * (h - 14) });
    ctx.strokeStyle = '#4a5e30';
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = spine(i / 40);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    for (let t = 0.06; t < 0.97; t += 0.035) {
      const p = spine(t);
      const len = 54 * Math.pow(1 - t, 0.75) * Math.min(1, 0.55 + t * 3);
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(p.x, p.y);
        // Pinnae point outward and slightly up (canvas y grows downward).
        ctx.rotate(dir > 0 ? -0.5 : Math.PI + 0.5);
        ctx.fillStyle = pick(colours);
        ctx.globalAlpha = rand(0.85, 1);
        // Pinna: a long narrow lobed leaflet.
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const lobes = 5;
        for (let k = 0; k <= lobes; k++) {
          const f = k / lobes;
          ctx.lineTo(f * len, -(4.2 * (1 - f) + 1) * (k % 2 ? 1.25 : 0.85));
        }
        for (let k = lobes; k >= 0; k--) {
          const f = k / lobes;
          ctx.lineTo(f * len, (4.2 * (1 - f) + 1) * (k % 2 ? 1.25 : 0.85));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    return toTexture(canvas);
  });
}

/** Clump of grass blades rising from the bottom edge. */
export function grassTexture(): THREE.CanvasTexture {
  return cached('grass', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    const colours = ['#8d9c6a', '#9fae78', '#7d8f5c', '#b2b787', '#6f8452'];
    for (let i = 0; i < 70; i++) {
      const x0 = size / 2 + rand(-0.32, 0.32) * size;
      const hgt = rand(0.45, 0.97) * size;
      const lean = rand(-0.35, 0.35) * hgt;
      const wBase = rand(3, 6.5);
      ctx.fillStyle = pick(colours);
      ctx.globalAlpha = rand(0.8, 1);
      ctx.beginPath();
      ctx.moveTo(x0 - wBase / 2, size);
      ctx.quadraticCurveTo(x0 - wBase / 2 + lean * 0.3, size - hgt * 0.6, x0 + lean, size - hgt);
      ctx.quadraticCurveTo(x0 + wBase / 2 + lean * 0.3, size - hgt * 0.6, x0 + wBase / 2, size);
      ctx.closePath();
      ctx.fill();
    }
    return toTexture(canvas);
  });
}

/** Hanging vine: wavy stem with alternating heart-shaped leaves (top = v 1). */
export function vineTexture(): THREE.CanvasTexture {
  return cached('vine', () => {
    const w = 64, h = 512;
    const [canvas, ctx] = makeCanvas(w, h);
    const xAt = (y: number) => w / 2 + Math.sin(y * 0.035) * 6;
    ctx.strokeStyle = '#4b5634';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y <= h; y += 4) { if (y === 0) ctx.moveTo(xAt(y), y); else ctx.lineTo(xAt(y), y); }
    ctx.stroke();
    const colours = ['#55703a', '#647f43', '#4a6332', '#73904d'];
    let side = 1;
    for (let y = 10; y < h - 6; y += rand(13, 22)) {
      const s = rand(7, 12) * (0.6 + 0.4 * (1 - y / h));
      ctx.save();
      ctx.translate(xAt(y), y);
      ctx.rotate(side * rand(0.6, 1.1));
      ctx.fillStyle = pick(colours);
      ctx.globalAlpha = rand(0.85, 1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-s, s * 0.2, -s * 0.8, s * 1.4, 0, s * 1.8);
      ctx.bezierCurveTo(s * 0.8, s * 1.4, s, s * 0.2, 0, 0);
      ctx.fill();
      ctx.restore();
      side = -side;
    }
    return toTexture(canvas);
  });
}

/** Bamboo leaf tuft: narrow lanceolate leaves fanning down from the top. */
export function bambooLeafTexture(): THREE.CanvasTexture {
  return cached('bambooLeaf', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    const colours = ['#6d8a3f', '#7f9b4a', '#5c7836', '#91aa58'];
    for (let i = 0; i < 46; i++) {
      const x = size / 2 + rand(-60, 60);
      const y = rand(30, 150);
      const len = rand(50, 95);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(0.25, 1.3) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2);
      ctx.fillStyle = pick(colours);
      ctx.globalAlpha = rand(0.85, 1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.4, -7, len, 0);
      ctx.quadraticCurveTo(len * 0.4, 7, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    return toTexture(canvas);
  });
}

// ---------------------------------------------------------------- surfaces
/** Seamless leaf-litter + moss forest floor. */
export function floorTexture(): THREE.CanvasTexture {
  return cached('floor', () => {
    const size = 512;
    const [canvas, ctx] = makeCanvas(size);
    const noise = fbmField(size, 4, 5);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = noise[i];
      const moss = Math.max(0, Math.min(1, (n - 0.5) * 4));
      img.data[i * 4] = 70 + n * 30 - moss * 18;
      img.data[i * 4 + 1] = 58 + n * 26 + moss * 22;
      img.data[i * 4 + 2] = 40 + n * 16 - moss * 6;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const leafCols = ['#7a5a35', '#8c6a3c', '#6b4c2c', '#9a7a48', '#5d4a2c', '#757446', '#a0844d', '#584027'];
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const w = rand(6, 16);
      const rot = Math.random() * Math.PI * 2;
      const col = pick(leafCols);
      const alpha = rand(0.75, 1);
      drawWrapped(size, x, y, 20, (px, py) => {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.globalAlpha = alpha;
        leafPath(ctx, w, w * 0.55);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,28,16,0.55)';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
        ctx.restore();
      });
    }
    // Moss cushions where the noise is high.
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const n = noise[(y | 0) * size + (x | 0)];
      if (n < 0.52) continue;
      const r = rand(2, 5);
      const col = pick(['#5d7134', '#6b7f3a', '#4f6430', '#788c45']);
      drawWrapped(size, x, y, 6, (px, py) => {
        ctx.globalAlpha = rand(0.7, 0.95);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      });
    }
    // Twigs.
    ctx.strokeStyle = '#3c2c1c';
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const a = Math.random() * Math.PI, l = rand(10, 34);
      drawWrapped(size, x, y, 40, (px, py) => {
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = rand(1, 2.2);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    return toTexture(canvas, { repeat: true, anisotropy: 8 });
  });
}

/** Seamless trodden-earth fallback for the trail (replaced by mud_forest when present). */
export function mudFallbackTexture(): THREE.CanvasTexture {
  return cached('mud', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    const noise = fbmField(size, 8, 4);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = noise[i];
      img.data[i * 4] = 92 + n * 46;
      img.data[i * 4 + 1] = 74 + n * 36;
      img.data[i * 4 + 2] = 54 + n * 26;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = rand(0.6, 2);
      const c = Math.random() < 0.5 ? 'rgba(40,30,20,0.6)' : 'rgba(170,150,120,0.5)';
      drawWrapped(size, x, y, 3, (px, py) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      });
    }
    return toTexture(canvas, { repeat: true, anisotropy: 8 });
  });
}

/** Grey lichen-flecked stone. */
export function stoneTexture(): THREE.CanvasTexture {
  return cached('stone', () => {
    const size = 256;
    const [canvas, ctx] = makeCanvas(size);
    const noise = fbmField(size, 6, 5);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = noise[i];
      const v = 110 + n * 90;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v * 1.01;
      img.data[i * 4 + 2] = v * 0.97;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = rand(1, 4);
      const c = pick(['rgba(190,196,160,0.55)', 'rgba(60,62,58,0.45)', 'rgba(150,170,120,0.45)']);
      drawWrapped(size, x, y, 5, (px, py) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      });
    }
    return toTexture(canvas, { repeat: true });
  });
}

/** Bamboo culm: green with darker node rings, repeats vertically. */
export function bambooTexture(): THREE.CanvasTexture {
  return cached('bamboo', () => {
    const w = 64, h = 256;
    const [canvas, ctx] = makeCanvas(w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#5f7a35');
    g.addColorStop(0.45, '#9db35f');
    g.addColorStop(1, '#55702f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(230,240,190,${rand(0.05, 0.15)})`;
      ctx.fillRect(Math.random() * w, 0, 1, h);
    }
    for (const y of [0, h / 2]) {
      ctx.fillStyle = '#4a5a2a';
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = 'rgba(220,225,170,0.6)';
      ctx.fillRect(0, y + 4, w, 2);
    }
    const tex = toTexture(canvas, { repeat: true });
    tex.repeat.set(1, 6);
    return tex;
  });
}

/** Concentric growth rings for the cut ends of logs. */
export function treeRingTexture(): THREE.CanvasTexture {
  return cached('rings', () => {
    const size = 128;
    const [canvas, ctx] = makeCanvas(size);
    ctx.fillStyle = '#a07a4e';
    ctx.fillRect(0, 0, size, size);
    for (let r = size / 2; r > 2; r -= rand(2.5, 5)) {
      ctx.strokeStyle = `rgba(90,60,30,${rand(0.3, 0.7)})`;
      ctx.lineWidth = rand(0.8, 1.8);
      ctx.beginPath();
      ctx.arc(size / 2 + rand(-1, 1), size / 2 + rand(-1, 1), r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a3420';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
    return toTexture(canvas);
  });
}

// ------------------------------------------------------------- effects
/** Four flame frames side by side (u = frame / 4). */
export function flameFramesTexture(): THREE.CanvasTexture {
  return cached('flames', () => {
    const fw = 128, fh = 256, frames = 4;
    const [canvas, ctx] = makeCanvas(fw * frames, fh);
    for (let f = 0; f < frames; f++) {
      const ox = f * fw;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, 0, fw, fh);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const x = ox + fw / 2 + Math.sin(f * 1.7 + i * 0.9) * 14 * t;
        const y = fh - 18 - t * fh * 0.72;
        const r = (1 - t) * 38 + 8;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,${200 - t * 90},${120 - t * 90},${0.5 - t * 0.25})`);
        g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.65, r, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    const tex = toTexture(canvas);
    tex.repeat.set(1 / frames, 1);
    return tex;
  });
}

/** Soft radial blob (mist sprites, glows). */
export function softBlobTexture(): THREE.CanvasTexture {
  return cached('blob', () => {
    const size = 128;
    const [canvas, ctx] = makeCanvas(size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return toTexture(canvas);
  });
}

/** Single small leaf for falling-leaf particles. */
export function smallLeafTexture(): THREE.CanvasTexture {
  return cached('smallLeaf', () => {
    const size = 64;
    const [canvas, ctx] = makeCanvas(size);
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#b08a46';
    leafPath(ctx, size * 0.9, size * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,25,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-size * 0.45, 0); ctx.lineTo(size * 0.45, 0); ctx.stroke();
    return toTexture(canvas);
  });
}

/** One butterfly wing; the hinge (body) is the left edge, u = 0. */
export function butterflyWingTexture(): THREE.CanvasTexture {
  return cached('wing', () => {
    const size = 128;
    const [canvas, ctx] = makeCanvas(size);
    ctx.fillStyle = '#f2f0e6';
    ctx.beginPath();
    ctx.moveTo(2, size * 0.5);
    ctx.bezierCurveTo(size * 0.3, size * 0.02, size * 1.0, size * 0.0, size * 0.92, size * 0.42);
    ctx.bezierCurveTo(size * 0.88, size * 0.55, size * 0.7, size * 0.6, size * 0.6, size * 0.56);
    ctx.bezierCurveTo(size * 0.8, size * 0.75, size * 0.6, size * 1.0, size * 0.3, size * 0.92);
    ctx.bezierCurveTo(size * 0.15, size * 0.85, 4, size * 0.62, 2, size * 0.5);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(40,36,30,0.8)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,36,30,0.65)';
    ctx.beginPath(); ctx.arc(size * 0.72, size * 0.22, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return toTexture(canvas);
  });
}

/** Tileable greyscale fBm noise (linear, not sRGB). */
export function noiseTexture(): THREE.DataTexture {
  return cached('noise', () => {
    const size = 256;
    const field = fbmField(size, 4, 5);
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(field[i] * 255);
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  });
}

/** Tangent-space ripple normals for the stream surface. */
export function waterNormalTexture(): THREE.DataTexture {
  return cached('waterNormal', () => {
    const size = 128;
    const h = fbmField(size, 6, 4);
    const data = new Uint8Array(size * size * 4);
    const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  });
}

/** Light-shaft gradient: soft across, fading in at the top and out near the ground. */
export function shaftTexture(): THREE.CanvasTexture {
  return cached('shaft', () => {
    const w = 64, h = 256;
    const [canvas, ctx] = makeCanvas(w, h);
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.18, 'rgba(255,255,255,0.9)');
    v.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.5, 'rgba(0,0,0,1)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);
    return toTexture(canvas);
  });
}

// ----------------------------------------------------------- photo upgrades
/**
 * Load an optional photo texture and hand it over only once it decodes. The
 * caller keeps using its procedural fallback until then, and forever when the
 * file is missing (Poly Haven assets are optional; `npm run fetch:assets`).
 * Returns a cancel function; a texture that arrives after cancel is disposed.
 */
export function loadTextureWithFallback(
  path: string,
  setup: (t: THREE.Texture) => void,
  onLoad: (t: THREE.Texture) => void,
): () => void {
  let cancelled = false;
  const url = new URL(path, document.baseURI).toString();
  new THREE.TextureLoader().load(
    url,
    (t) => {
      if (cancelled) { t.dispose(); return; }
      setup(t);
      onLoad(t);
    },
    undefined,
    () => { /* missing or undecodable: keep the procedural fallback */ },
  );
  return () => { cancelled = true; };
}
