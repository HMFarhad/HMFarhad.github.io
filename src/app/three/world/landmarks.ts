import * as THREE from 'three';
import type { Zone } from '../../core/content/zone.model';

/**
 * Each station is a futuristic, transparent holographic screen floating
 * in mid-air over the trail.
 *
 * Composition per station:
 *   - A faint cyan ground projector ring (just a glow disc).
 *   - A holographic "screen" plane: dark-glass backdrop + frame, plus a
 *     compositor canvas that animates a natural rainfall of 0/1 glyphs.
 *     Drops fall top-to-bottom at random speeds, sizes and x-positions.
 *     Where each drop passes a text pixel it "writes" or "washes" it,
 *     giving a build / dissolve effect.
 *   - A second additive-blended copy slightly behind for bloom/halo.
 *
 * State machine per station, driven by the active station index:
 *   - empty     : no text on the panel; light ambient rainfall plays.
 *   - building  : station is active and not fully written — rain heads
 *                 sweep down and reveal the text behind them.
 *   - built     : station is fully written; rain still falls lightly.
 *   - dissolving: walker has just left this station — rain washes the
 *                 text away from top to bottom; once gone, panel is
 *                 marked empty again, ready for a fresh rebuild.
 *
 * No solid frames, no pedestals, no support posts — the screen reads as
 * a holo-projection. All descendants carry `userData.stationIndex` so
 * the raycaster attributes hits to the right zone.
 */

export interface StationLandmarksHandle {
  group: THREE.Group;
  /** Drive per-station rain. Call once per frame. */
  update(dt: number, activeIdx: number): void;
}

export function buildStationLandmarks(
  zones: Zone[],
  stationProgress: number[],
  curve: THREE.CatmullRomCurve3
): StationLandmarksHandle {
  const root = new THREE.Group();
  const states: StationRevealState[] = [];

  zones.forEach((zone, idx) => {
    const t   = stationProgress[idx] ?? idx / Math.max(1, zones.length - 1);
    const p   = curve.getPointAt(t);

    const VIEW_DELTA = 0.012;
    const tAhead = t + VIEW_DELTA;

    const station = makeHoloScreen(zone, (s) => states.push(s));
    if (tAhead <= 1) {
      const sp = curve.getPointAt(tAhead);
      station.position.set(sp.x, 0, sp.z);
      station.lookAt(p.x, station.position.y, p.z);
    } else {
      const tan = curve.getTangentAt(1).clone().normalize();
      const reach = VIEW_DELTA * (curve.getLength());
      station.position.set(p.x + tan.x * reach, 0, p.z + tan.z * reach);
      station.lookAt(
        station.position.x - tan.x,
        station.position.y,
        station.position.z - tan.z
      );
    }

    station.traverse((o) => { o.userData['stationIndex'] = idx; });
    root.add(station);
  });

  let lastActive = -1;
  return {
    group: root,
    update(dt: number, activeIdx: number): void {
      // When the active station changes, push the OLD active station into
      // the dissolving phase (if it had any text built up).
      if (activeIdx !== lastActive) {
        if (lastActive >= 0 && lastActive < states.length) {
          const prev = states[lastActive];
          if (prev.phase === 'building' || prev.phase === 'built') {
            prev.phase = 'dissolving';
            prev.dissolveT = 0;
            // Restart the front sweep from the top so the dissolve rains
            // down from the top edge of the body region.
            for (let c = 0; c < prev.cols; c++) prev.frontY[c] = 0;
          }
        }
        // If the user comes BACK to a station that's mid-dissolve or
        // already empty, kick it into building from scratch.
        if (activeIdx >= 0 && activeIdx < states.length) {
          const cur = states[activeIdx];
          if (cur.phase === 'dissolving' || cur.phase === 'empty') {
            cur.phase = 'building';
            cur.buildT = 0;
            for (let c = 0; c < cur.cols; c++) cur.frontY[c] = 0;
            cur.revealMask.fill(0);
          }
        }
        lastActive = activeIdx;
      }

      // Only animate panels that are mid build / dissolve. Once a panel
      // reaches `built` or `empty` it freezes — no per-frame canvas work,
      // no continuous ambient rain. This keeps idle frames cheap.
      for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (s.phase !== 'building' && s.phase !== 'dissolving') continue;
        tickStationPanel(s, dt, i === activeIdx);
      }
    },
  };
}

function makeHoloScreen(
  zone: Zone,
  registerState: (s: StationRevealState) => void
): THREE.Group {
  const g = new THREE.Group();

  // Expanded by 15% on left/right/bottom vs. the original 5.4 x 3.15
  // panel, while the top edge stays anchored at its previous height.
  // Original top edge: 2.4 + 3.15/2 = 3.975 world units.
  const screenW = 5.4 * 1.30;          // +15% each side -> +30% width
  const screenH = 3.15 * 1.15;         // +15% only on the bottom
  const screenY = 3.975 - screenH / 2; // keep top edge fixed

  // ---- ground projector: subtle cyan disc on the floor ----
  const projTex = makeProjectorDiscTexture();
  const proj = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({
      map: projTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x9ee6ff,
      opacity: 0.55,
    })
  );
  proj.rotation.x = -Math.PI / 2;
  proj.position.y = 0.02;
  g.add(proj);

  // ---- thin "beam" rising from the projector to the screen base ----
  // Simulated with a tall narrow additive plane (cheaper than a cone).
  const beamTex = makeBeamTexture();
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, screenY - 0.05),
    new THREE.MeshBasicMaterial({
      map: beamTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x9ee6ff,
      opacity: 0.35,
    })
  );
  beam.position.set(0, (screenY - 0.05) / 2 + 0.02, 0);
  // Make the beam billboard-like by leaving it on the screen plane —
  // it's mostly visible from the front anyway.
  g.add(beam);

  // ---- main holographic screen ----
  // Use NormalBlending with a translucent dark-glass background baked
  // into the canvas so text always has guaranteed contrast against the
  // forest behind it. The glow plane behind it adds the holographic feel.
  const state = createStationPanel(zone);
  registerState(state);
  const tex = state.tex;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 1.0,
    })
  );
  screen.position.set(0, screenY, 0);
  g.add(screen);

  // ---- back glow halo: soft radial behind for bloom (no text ghost) ----
  const glowTex = makeScreenHaloTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW * 1.25, screenH * 1.4),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      color: 0x66e0ff,
      opacity: 0.55,
    })
  );
  glow.position.set(0, screenY, 0.05);
  g.add(glow);

  return g;
}

// =================== textures ===================

function makeProjectorDiscTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;
  // Outer ring glow
  const grad = ctx.createRadialGradient(cx, cy, size * 0.20, cx, cy, size * 0.5);
  grad.addColorStop(0,    'rgba(150,230,255,0.0)');
  grad.addColorStop(0.55, 'rgba(150,230,255,0.55)');
  grad.addColorStop(0.78, 'rgba(110,210,255,0.35)');
  grad.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Crisp ring
  ctx.strokeStyle = 'rgba(180,240,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180,240,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.30, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBeamTexture(w = 64, h = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Vertical gradient: bright at bottom, fade to top, plus center-vs-edge falloff.
  const vert = ctx.createLinearGradient(0, h, 0, 0);
  vert.addColorStop(0,   'rgba(170,235,255,0.55)');
  vert.addColorStop(0.4, 'rgba(170,235,255,0.18)');
  vert.addColorStop(1,   'rgba(170,235,255,0.0)');
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, w, h);
  // Horizontal falloff
  const horiz = ctx.createLinearGradient(0, 0, w, 0);
  horiz.addColorStop(0,   'rgba(0,0,0,1)');
  horiz.addColorStop(0.5, 'rgba(0,0,0,0)');
  horiz.addColorStop(1,   'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeScreenHaloTexture(w = 256, h = 192): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w / 2, cy = h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);
  grad.addColorStop(0,    'rgba(150,230,255,0.55)');
  grad.addColorStop(0.45, 'rgba(110,210,255,0.25)');
  grad.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Render the zone's content into a holographic-style canvas. The panel
 * is composed of two pre-rendered layers (a static frame + a transparent
 * content layer) blitted into a live canvas at runtime, so a matrix-rain
 * reveal can wipe the content into view column-by-column. With the dark-
 * glass backdrop in the frame layer the white-fill text reads crisply.
 */

// ---------- rain animation tunables ----------
const RAIN_GLYPHS = ['0', '1'];

// Reveal grid: each panel is divided into cells. A per-column "front"
// sweeps top-to-bottom while building, and the same front sweeps in the
// other direction when dissolving. Smaller cells = smoother reveal but
// more memory; these values give ~80×27 cells on the 1997×1030 panel.
const CELL_W = 24;
const CELL_H = 36;

// Build/dissolve sweep speeds (px/sec). Each column gets a random speed
// in this range so the wavefront looks irregular and "rain-like".
const BUILD_SPEED_MIN     = 480;
const BUILD_SPEED_MAX     = 820;
const DISSOLVE_SPEED_MIN  = 560;
const DISSOLVE_SPEED_MAX  = 940;

// Drop population while a station is mid-reveal. Once the panel reaches
// the `built` or `empty` phase, the drop pool is emptied and the panel
// stops repainting entirely — no continuous ambient rain, no lag.
const DROPS_ACTIVE  = 90;

// Per-drop physics ranges.
const DROP_VY_MIN   = 380;   // px / sec
const DROP_VY_MAX   = 1100;
const DROP_SIZE_MIN = 14;    // font px
const DROP_SIZE_MAX = 26;
const DROP_TAIL_MIN = 4;
const DROP_TAIL_MAX = 9;
const DROP_SHUFFLE  = 0.07;  // sec, glyph reroll interval

interface RainDrop {
  x: number;       // px on the canvas
  y: number;       // px on the canvas (drop head position)
  vy: number;      // px/sec
  size: number;    // font size in px
  tail: number;    // tail length in chars
  glyph: string;
  shuffleAcc: number;
}

type StationPhase = 'empty' | 'building' | 'built' | 'dissolving';

interface StationRevealState {
  W: number;
  H: number;
  bodyTop: number;
  bodyBottom: number;
  bodyLeft: number;
  bodyRight: number;
  cols: number;        // number of cell columns across the body region
  rows: number;        // number of cell rows down the body region
  /** revealMask[r * cols + c] in [0..1] — fraction of cell revealed */
  revealMask: Float32Array;
  /** per-column build/dissolve front (px from bodyTop). */
  frontY: Float32Array;
  /** per-column random speed multiplier (0.6 .. 1.0) */
  colSpeed: Float32Array;

  liveCanvas: HTMLCanvasElement;
  liveCtx: CanvasRenderingContext2D;
  frameCanvas: HTMLCanvasElement;
  contentCanvas: HTMLCanvasElement;
  drops: RainDrop[];
  tex: THREE.CanvasTexture;

  phase: StationPhase;
  buildT: number;
  dissolveT: number;
}

function createStationPanel(zone: Zone): StationRevealState {
  // Canvas scaled to match the expanded plane (1.30x wide, 1.15x tall)
  // so text isn't stretched. Original was 1536 x 896.
  const W = Math.round(1536 * 1.30); // 1997
  const H = Math.round(896 * 1.15);  // 1030

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = W; frameCanvas.height = H;
  drawFrameInto(frameCanvas.getContext('2d')!, W, H);

  const contentCanvas = document.createElement('canvas');
  contentCanvas.width = W; contentCanvas.height = H;
  drawContentInto(contentCanvas.getContext('2d')!, zone, W, H);

  const liveCanvas = document.createElement('canvas');
  liveCanvas.width = W; liveCanvas.height = H;
  const liveCtx = liveCanvas.getContext('2d')!;
  liveCtx.drawImage(frameCanvas, 0, 0);

  const tex = new THREE.CanvasTexture(liveCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  // Body region (avoids the rounded outline + footer scroll cue).
  const bodyTop = 20;
  const bodyBottom = H - 84;
  const bodyLeft = 32;
  const bodyRight = W - 32;
  const cols = Math.max(1, Math.floor((bodyRight - bodyLeft) / CELL_W));
  const rows = Math.max(1, Math.floor((bodyBottom - bodyTop) / CELL_H));

  const revealMask = new Float32Array(cols * rows); // all zero — empty
  const frontY = new Float32Array(cols);            // 0 = nothing built yet
  const colSpeed = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    colSpeed[c] = 0.6 + Math.random() * 0.4;
  }

  // Drops are populated lazily by tickStationPanel when the station
  // enters the building phase. Idle panels keep an empty drops array so
  // they don't repaint at all.
  const drops: RainDrop[] = [];

  return {
    W, H, bodyTop, bodyBottom, bodyLeft, bodyRight,
    cols, rows, revealMask, frontY, colSpeed,
    liveCanvas, liveCtx, frameCanvas, contentCanvas,
    drops, tex,
    phase: 'empty',
    buildT: 0,
    dissolveT: 0,
  };
}

function spawnDrop(
  bodyLeft: number, bodyRight: number,
  bodyTop: number, bodyBottom: number,
  initial: boolean,
): RainDrop {
  const size = DROP_SIZE_MIN + Math.random() * (DROP_SIZE_MAX - DROP_SIZE_MIN);
  return {
    x: bodyLeft + Math.random() * (bodyRight - bodyLeft),
    // On initial spawn, scatter drops across the panel so rain is already
    // mid-fall; afterwards new drops spawn just above the panel.
    y: initial
      ? bodyTop + Math.random() * (bodyBottom - bodyTop)
      : bodyTop - 20 - Math.random() * 200,
    vy: DROP_VY_MIN + Math.random() * (DROP_VY_MAX - DROP_VY_MIN),
    size,
    tail: DROP_TAIL_MIN + ((Math.random() * (DROP_TAIL_MAX - DROP_TAIL_MIN)) | 0),
    glyph: RAIN_GLYPHS[(Math.random() * RAIN_GLYPHS.length) | 0],
    shuffleAcc: Math.random() * DROP_SHUFFLE,
  };
}

function tickStationPanel(s: StationRevealState, dt: number, isActive: boolean): void {
  // 1) Advance per-column build / dissolve fronts.
  const bodyH = s.bodyBottom - s.bodyTop;

  if (s.phase === 'building') {
    let allFull = true;
    for (let c = 0; c < s.cols; c++) {
      const v = BUILD_SPEED_MIN + (BUILD_SPEED_MAX - BUILD_SPEED_MIN) * s.colSpeed[c];
      s.frontY[c] = Math.min(bodyH, s.frontY[c] + v * dt);
      // Update reveal mask up to the front.
      const rowsRevealed = Math.min(s.rows, Math.floor(s.frontY[c] / CELL_H));
      for (let r = 0; r < rowsRevealed; r++) {
        s.revealMask[r * s.cols + c] = 1;
      }
      // Partial cell at the wavefront.
      if (rowsRevealed < s.rows) {
        const remainder = (s.frontY[c] - rowsRevealed * CELL_H) / CELL_H;
        s.revealMask[rowsRevealed * s.cols + c] = remainder;
      }
      if (s.frontY[c] < bodyH) allFull = false;
    }
    s.buildT += dt;
    if (allFull) s.phase = 'built';
  } else if (s.phase === 'dissolving') {
    let allClear = true;
    for (let c = 0; c < s.cols; c++) {
      const v = DISSOLVE_SPEED_MIN + (DISSOLVE_SPEED_MAX - DISSOLVE_SPEED_MIN) * s.colSpeed[c];
      // dissolve front travels DOWN from top, eating mask above it.
      s.frontY[c] = Math.min(bodyH, s.frontY[c] + v * dt);
      const rowsCleared = Math.min(s.rows, Math.floor(s.frontY[c] / CELL_H));
      for (let r = 0; r < rowsCleared; r++) {
        s.revealMask[r * s.cols + c] = 0;
      }
      if (rowsCleared < s.rows) {
        const remainder = (s.frontY[c] - rowsCleared * CELL_H) / CELL_H;
        // 1 - remainder of the front cell still has text.
        s.revealMask[rowsCleared * s.cols + c] = 1 - remainder;
      }
      if (s.frontY[c] < bodyH) allClear = false;
    }
    s.dissolveT += dt;
    if (allClear) {
      s.phase = 'empty';
      // Reset fronts so a future rebuild starts from zero again.
      for (let c = 0; c < s.cols; c++) s.frontY[c] = 0;
      s.revealMask.fill(0);
    }
  }

  // 2) Advance drop physics. Drops only exist during build / dissolve;
  //    when the panel finishes either phase we drop them entirely so the
  //    canvas stops being re-blitted.
  const stillAnimating = (s.phase === 'building' || s.phase === 'dissolving');
  const targetDropCount = stillAnimating ? DROPS_ACTIVE : 0;
  if (s.drops.length < targetDropCount) {
    while (s.drops.length < targetDropCount) {
      s.drops.push(spawnDrop(s.bodyLeft, s.bodyRight, s.bodyTop, s.bodyBottom, false));
    }
  } else if (s.drops.length > targetDropCount) {
    s.drops.length = targetDropCount;
  }

  for (const d of s.drops) {
    d.y += d.vy * dt;
    d.shuffleAcc += dt;
    if (d.shuffleAcc >= DROP_SHUFFLE) {
      d.shuffleAcc = 0;
      d.glyph = RAIN_GLYPHS[(Math.random() * RAIN_GLYPHS.length) | 0];
    }
    // Recycle drops that have fallen off the bottom.
    if (d.y - d.tail * d.size * 1.05 > s.bodyBottom + 40) {
      const fresh = spawnDrop(s.bodyLeft, s.bodyRight, s.bodyTop, s.bodyBottom, false);
      d.x = fresh.x;
      d.y = fresh.y;
      d.vy = fresh.vy;
      d.size = fresh.size;
      d.tail = fresh.tail;
      d.glyph = fresh.glyph;
      d.shuffleAcc = 0;
    }
  }

  // 3) Composite the panel: frame -> revealed text strips -> rain drops.
  redrawStationPanel(s, isActive);
}

function redrawStationPanel(s: StationRevealState, isActive: boolean): void {
  const ctx = s.liveCtx;
  const { W, H, bodyTop, bodyLeft, cols, rows, revealMask, frameCanvas, contentCanvas } = s;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(frameCanvas, 0, 0);

  // ---- blit revealed text cells ----
  // Walk the mask cell-by-cell. For full cells we batch contiguous runs
  // along the same row to reduce drawImage calls.
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= cols; c++) {
      const m = c < cols ? revealMask[r * cols + c] : 0;
      if (m >= 0.999) {
        if (runStart < 0) runStart = c;
      } else {
        if (runStart >= 0) {
          const sx = bodyLeft + runStart * CELL_W;
          const sy = bodyTop + r * CELL_H;
          const sw = (c - runStart) * CELL_W;
          ctx.drawImage(contentCanvas, sx, sy, sw, CELL_H, sx, sy, sw, CELL_H);
          runStart = -1;
        }
        // Partial cell — draw a fractional vertical slice (top portion
        // for build, bottom portion for dissolve).
        if (m > 0.001 && c < cols) {
          const sx = bodyLeft + c * CELL_W;
          const sy = bodyTop + r * CELL_H;
          const sliceH = Math.max(1, m * CELL_H);
          if (s.phase === 'building' || s.phase === 'built') {
            ctx.drawImage(contentCanvas, sx, sy, CELL_W, sliceH, sx, sy, CELL_W, sliceH);
          } else {
            // dissolving: keep the BOTTOM portion of the cell (top is being eaten).
            const yOff = CELL_H - sliceH;
            ctx.drawImage(
              contentCanvas,
              sx, sy + yOff, CELL_W, sliceH,
              sx, sy + yOff, CELL_W, sliceH,
            );
          }
        }
      }
    }
  }

  // ---- draw falling drops on top ----
  ctx.textBaseline = 'top';
  for (const d of s.drops) {
    // Tail: each preceding glyph is offset upward by ~size*1.05 px.
    const stride = d.size * 1.05;
    ctx.font = `700 ${Math.round(d.size)}px "Consolas", "Menlo", "Courier New", monospace`;
    for (let k = 0; k < d.tail; k++) {
      const yy = d.y - k * stride;
      if (yy + d.size < bodyTop - 80) break;
      if (yy > s.bodyBottom + 40) continue;
      const fade = 1 - k / d.tail;
      let alpha: number;
      let color: string;
      if (k === 0) {
        // Bright wet head.
        alpha = isActive ? 0.95 * fade : 0.75 * fade;
        color = `rgba(235, 255, 245, ${alpha})`;
      } else {
        // Trailing drips — cool cyan/green fading out.
        alpha = (isActive ? 0.55 : 0.30) * fade;
        color = `rgba(120, 220, 200, ${alpha})`;
      }
      ctx.fillStyle = color;
      ctx.fillText(d.glyph, d.x, yy);
    }
  }

  s.tex.needsUpdate = true;
}

/**
 * Paint the always-visible scaffolding: dark-glass backdrop, faint grid,
 * rounded outline, corner brackets, header underline, footer hairline +
 * "SCROLL ↓ TO CONTINUE" cue. NO zone text — that lives on the content
 * layer so it can be hidden until the rain reveal exposes it.
 */
function drawFrameInto(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.clearRect(0, 0, W, H);

  // ---- dark-glass backdrop for guaranteed text contrast ----
  ctx.save();
  drawRoundedRectPath(ctx, 16, 16, W - 32, H - 32, 22);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   'rgba(6, 18, 28, 0.82)');
  bg.addColorStop(0.5, 'rgba(8, 22, 32, 0.80)');
  bg.addColorStop(1,   'rgba(10, 26, 38, 0.78)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ---- subtle grid lines ----
  ctx.save();
  drawRoundedRectPath(ctx, 16, 16, W - 32, H - 32, 22);
  ctx.clip();
  ctx.strokeStyle = 'rgba(140, 220, 255, 0.08)';
  ctx.lineWidth = 1;
  const cell = 64;
  for (let x = 16; x < W - 16; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, H - 16); ctx.stroke();
  }
  for (let y = 16; y < H - 16; y += cell) {
    ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(W - 16, y); ctx.stroke();
  }
  ctx.restore();

  // ---- outer rounded outline ----
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(180, 240, 255, 0.55)';
  drawRoundedRectPath(ctx, 16, 16, W - 32, H - 32, 22);
  ctx.stroke();

  // ---- corner brackets ----
  drawCornerBrackets(ctx, 16, 16, W - 32, H - 32, 42, 'rgba(200, 245, 255, 0.95)', 5);

  // ---- header underline ----
  ctx.strokeStyle = 'rgba(180, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110); ctx.lineTo(W - 40, 110);
  ctx.stroke();

  // ---- footer hairline + scroll cue ----
  ctx.fillStyle = 'rgba(180, 240, 255, 0.45)';
  ctx.fillRect(40, H - 80, W - 80, 1);
  ctx.fillStyle = 'rgba(220, 235, 245, 0.95)';
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText('SCROLL ↓ TO CONTINUE', W - 64, H - 60);
  ctx.textAlign = 'left';
}

/**
 * Paint the zone's text content (header title + body) onto a transparent
 * canvas. Uses a thin dark outline + near-white fill so text reads on the
 * dark-glass backdrop after it's blitted onto the live canvas.
 */
function drawContentInto(
  ctx: CanvasRenderingContext2D,
  zone: Zone,
  W: number,
  H: number,
): void {
  ctx.clearRect(0, 0, W, H);

  // Outline-and-fill text helper override (same as before).
  const baseFillText = ctx.fillText.bind(ctx);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  (ctx as any).fillText = (text: string, tx: number, ty: number, maxW?: number) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 8, 20, 0.85)';
    if (maxW != null) ctx.strokeText(text, tx, ty, maxW);
    else ctx.strokeText(text, tx, ty);
    const prev = ctx.fillStyle;
    ctx.fillStyle = 'rgba(240, 250, 255, 1.0)';
    if (maxW != null) baseFillText(text, tx, ty, maxW);
    else baseFillText(text, tx, ty);
    ctx.fillStyle = prev;
  };

  // Header title.
  ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('// ' + zone.title.toUpperCase(), 64, 75);
  ctx.textBaseline = 'top';

  const bodyX = 64;
  let y = 180;
  const accent  = 'rgba(120, 220, 255, 1.0)';
  const primary = 'rgba(255, 235, 180, 1.0)';
  const muted   = 'rgba(220, 235, 245, 1.0)';
  const dim     = 'rgba(180, 205, 220, 1.0)';

  const wrap = (txt: string, font: string, lineHeight: number, maxW: number) => {
    ctx.font = font;
    const lines = wrapText(ctx, txt, maxW);
    for (const ln of lines) {
      if (y > H - 56) return;
      ctx.fillText(ln, bodyX, y);
      y += lineHeight;
    }
  };

  switch (zone.id) {
    case 'about': {
      ctx.fillStyle = primary;
      ctx.font = '700 80px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(zone.payload.name, bodyX, y); y += 92;
      ctx.fillStyle = accent;
      wrap(zone.payload.tagline, 'italic 600 45px "Segoe UI", system-ui, sans-serif', 52, W - bodyX - 80);
      y += 30;
      ctx.fillStyle = muted;
      const paragraphs = zone.payload.bio.split(/\n\s*\n/);
      for (let i = 0; i < paragraphs.length; i++) {
        wrap(paragraphs[i], '500 40px "Segoe UI", system-ui, sans-serif', 46, W - bodyX - 80);
        if (i < paragraphs.length - 1) y += 22;
      }
      break;
    }
    case 'education': {
      for (const it of zone.payload.items) {
        if (it.institution.toLowerCase().startsWith('language')) y += 32;
        ctx.fillStyle = primary;
        ctx.font = '700 46px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(it.institution, bodyX, y); y += 56;
        ctx.fillStyle = accent;
        const head = it.period ? `${it.degree} · ${it.period}` : it.degree;
        wrap(head, '600 34px "Segoe UI", system-ui, sans-serif', 44, W - bodyX - 80);
        if (it.details) {
          ctx.fillStyle = muted;
          wrap(it.details, '400 32px "Segoe UI", system-ui, sans-serif', 42, W - bodyX - 80);
        }
        y += 22;
        if (y > H - 90) break;
      }
      break;
    }
    case 'skills': {
      const groups = zone.payload.groups.slice(0, 6);
      const cols = 3;
      const colW = (W - bodyX - 80) / cols;
      const rowTop0 = y;
      const rowTop1 = y + (H - y - 90) / 2;
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = bodyX + col * colW;
        let cy = row === 0 ? rowTop0 : rowTop1;
        ctx.fillStyle = primary;
        ctx.font = '700 38px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(grp.name, cx, cy); cy += 50;
        ctx.fillStyle = muted;
        ctx.font = '500 28px "Segoe UI", system-ui, sans-serif';
        for (const s of grp.items) {
          if (cy > H - 80) break;
          const lines = wrapText(ctx, '› ' + s, colW - 16);
          for (const ln of lines) {
            if (cy > H - 80) break;
            ctx.fillText(ln, cx, cy); cy += 36;
          }
        }
      }
      break;
    }
    case 'experience': {
      for (const it of zone.payload.items) {
        ctx.fillStyle = primary;
        ctx.font = '700 36px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(`${it.role} — ${it.company}`, bodyX, y); y += 44;
        ctx.fillStyle = accent;
        ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(it.period, bodyX, y); y += 36;
        ctx.fillStyle = muted;
        wrap(it.summary, '400 26px "Segoe UI", system-ui, sans-serif', 34, W - bodyX - 80);
        if (it.highlights) {
          for (const h of it.highlights) {
            if (y > H - 80) break;
            ctx.fillStyle = dim;
            const lines = wrapText(ctx, '› ' + h, W - bodyX - 100);
            for (const ln of lines) {
              if (y > H - 80) break;
              ctx.font = '400 25px "Segoe UI", system-ui, sans-serif';
              ctx.fillText(ln, bodyX + 18, y); y += 32;
            }
          }
        }
        y += 18;
        if (y > H - 90) break;
      }
      break;
    }
    case 'projects': {
      const items = zone.payload.items.slice(0, 3);
      for (const p of items) {
        ctx.fillStyle = primary;
        ctx.font = '700 42px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(p.name, bodyX, y); y += 52;
        ctx.fillStyle = muted;
        wrap(p.blurb, '400 32px "Segoe UI", system-ui, sans-serif', 40, W - bodyX - 80);
        ctx.fillStyle = accent;
        ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(p.tech.join(' · '), bodyX, y); y += 38;
        y += 14;
        if (y > H - 90) break;
      }
      break;
    }
    case 'blogs': {
      for (const b of zone.payload.items) {
        ctx.fillStyle = primary;
        ctx.font = '700 40px "Segoe UI", system-ui, sans-serif';
        wrap(b.title, '700 40px "Segoe UI", system-ui, sans-serif', 50, W - bodyX - 80);
        ctx.fillStyle = accent;
        ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(b.date, bodyX, y); y += 40;
        ctx.fillStyle = muted;
        wrap(b.excerpt, '400 32px "Segoe UI", system-ui, sans-serif', 40, W - bodyX - 80);
        y += 24;
        if (y > H - 90) break;
      }
      break;
    }
    case 'contact': {
      ctx.fillStyle = primary;
      ctx.font = '600 60px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Let’s grab a coffee ☕', bodyX, y); y += 80;
      ctx.fillStyle = muted;
      wrap(
        'Working on a project together would be great — but even if you’re not, I’d still love to meet up, swap stories and grow the network. Reach out anytime.',
        '400 40px "Segoe UI", system-ui, sans-serif',
        46,
        W - bodyX - 80,
      );
      y += 18;
      ctx.fillStyle = accent;
      ctx.font = '600 38px "Segoe UI", system-ui, sans-serif';
      if (y < H - 110) {
        ctx.fillText('Tap a link below ↓', bodyX, y);
        y += 56;
      }
      break;
    }
  }
}


function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  size: number, color: string, lineWidth: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  // top-left
  ctx.beginPath();
  ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y); ctx.stroke();
  // top-right
  ctx.beginPath();
  ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size); ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - size); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - size, y + h); ctx.stroke();
  // bottom-left
  ctx.beginPath();
  ctx.moveTo(x + size, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - size); ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
