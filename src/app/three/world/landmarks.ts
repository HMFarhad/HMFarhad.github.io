import * as THREE from 'three';
import type { Zone } from '../../core/content/zone.model';

/**
 * Each station is a futuristic, transparent holographic screen floating
 * in mid-air over the trail.
 *
 * Composition per station:
 *   - A faint cyan ground projector ring (just a glow disc).
 *   - A holographic "screen" plane: transparent canvas with cyan grid,
 *     scanlines, corner brackets, and emissive HUD text rendered from
 *     the zone's content.
 *   - A second additive-blended copy slightly behind for bloom/halo.
 *
 * No solid frames, no pedestals, no support posts — the screen reads as
 * a holo-projection. All descendants carry `userData.stationIndex` so
 * the raycaster attributes hits to the right zone.
 */
export function buildStationLandmarks(
  zones: Zone[],
  stationProgress: number[],
  curve: THREE.CatmullRomCurve3
): THREE.Group {
  const root = new THREE.Group();

  zones.forEach((zone, idx) => {
    const t   = stationProgress[idx] ?? idx / Math.max(1, zones.length - 1);
    const p   = curve.getPointAt(t);

    // Place the screen a small bit FURTHER ALONG the curve than the snap
    // point so when the walker eases into the snap they see the screen
    // straight ahead. For zones near the very end of the trail there is
    // no "ahead" left, so we extrapolate using the end tangent — that
    // keeps the screen front oriented toward the walker, no mirror.
    const VIEW_DELTA = 0.012;
    const tAhead = t + VIEW_DELTA;

    const station = makeHoloScreen(zone);
    if (tAhead <= 1) {
      const sp = curve.getPointAt(tAhead);
      station.position.set(sp.x, 0, sp.z);
      // lookAt the snap point — screen +Z faces walker arriving at p.
      station.lookAt(p.x, station.position.y, p.z);
    } else {
      // Beyond the curve end: extrapolate using the end tangent.
      const tan = curve.getTangentAt(1).clone().normalize();
      const reach = VIEW_DELTA * (curve.getLength());
      station.position.set(p.x + tan.x * reach, 0, p.z + tan.z * reach);
      // Walker is behind us along -tangent. Aim screen +Z back along
      // -tangent so its front face shows the content head-on.
      station.lookAt(
        station.position.x - tan.x,
        station.position.y,
        station.position.z - tan.z
      );
    }

    station.traverse((o) => { o.userData['stationIndex'] = idx; });
    root.add(station);
  });

  return root;
}

function makeHoloScreen(zone: Zone): THREE.Group {
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
  const tex = makeHoloPanelTexture(zone);
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
 * Render the zone's content into a 1024×608 holographic-style canvas
 * (transparent background, cyan grid + scanlines + corner brackets +
 * HUD-styled emissive text). With AdditiveBlending on the mesh, the
 * darker pixels disappear and the light pixels glow against the forest.
 */
function makeHoloPanelTexture(zone: Zone): THREE.CanvasTexture {
  // Canvas scaled to match the expanded plane (1.30x wide, 1.15x tall)
  // so text isn't stretched. Original was 1536 x 896.
  const W = Math.round(1536 * 1.30); // 1997
  const H = Math.round(896 * 1.15);  // 1030
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fully transparent panel — no background fill. Keep only frame + text.
  ctx.clearRect(0, 0, W, H);

  // ---- dark-glass backdrop for guaranteed text contrast ----
  // Matches the look of the HTML contact pills (rgba(8, 22, 32, 0.78))
  // so canvas text reads as crisply as the DOM overlay. A vertical
  // gradient adds depth without losing contrast at the bottom.
  ctx.save();
  drawRoundedRectPath(ctx, 16, 16, W - 32, H - 32, 22);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,    'rgba(6, 18, 28, 0.82)');
  bg.addColorStop(0.5,  'rgba(8, 22, 32, 0.80)');
  bg.addColorStop(1,    'rgba(10, 26, 38, 0.78)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ---- subtle grid lines (very faint, hint of structure) ----
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

  // ---- header bar (transparent, just an underline) ----
  ctx.strokeStyle = 'rgba(180, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110); ctx.lineTo(W - 40, 110);
  ctx.stroke();

  // Outline-and-fill: every fillText below first strokes a thin dark
  // outline (for sub-pixel crispness against the dark backdrop), then
  // fills with near-white. With the new opaque backdrop the heavy outline
  // is no longer needed — keep it slim so glyphs stay sharp.
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

  // Body content (zone-typed). Color values are kept for compatibility but
  // the override above paints every line near-white with a thin outline.
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
      // bio is split into paragraphs on blank lines so each paragraph
      // wraps independently with a small gap, matching the HTML page.
      const paragraphs = zone.payload.bio.split(/\n\s*\n/);
      for (let i = 0; i < paragraphs.length; i++) {
        wrap(paragraphs[i], '500 40px "Segoe UI", system-ui, sans-serif', 46, W - bodyX - 80);
        if (i < paragraphs.length - 1) y += 22;
      }
      break;
    }
    case 'education': {
      for (const it of zone.payload.items) {
        // Extra breathing room before the Languages section.
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
      // 3 columns x 2 rows (up to 6 groups).
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
          // Wrap each bullet to column width.
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
        W - bodyX - 80
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

  // ---- footer hairline + scroll cue ----
  ctx.fillStyle = 'rgba(180, 240, 255, 0.45)';
  ctx.fillRect(40, H - 80, W - 80, 1);
  ctx.fillStyle = 'rgba(220, 235, 245, 0.95)';
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SCROLL ↓ TO CONTINUE', W - 64, H - 60);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
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
