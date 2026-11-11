import type { CourtStyle, RacketStyle, ShuttleStyle, TrailStyle } from '../../types';
import { drawCosmeticMark, type EffectQuality } from './gameCosmeticEvents';

type Point = { x: number; y: number };
type CourtBounds = { left: number; top: number; width: number; height: number };

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, axes = 2) {
  ctx.beginPath();
  for (let i = 0; i < axes; i += 1) {
    const angle = i * Math.PI / axes;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
  }
  ctx.stroke();
}

export function drawCourtDecoration(ctx: CanvasRenderingContext2D, style: CourtStyle, court: CourtBounds, now: number, quality: EffectQuality) {
  if (style === 'classic') return;
  const { left, top, width, height } = court;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left - 7, top - 6, width + 14, height + 12);
  ctx.clip();
  ctx.lineWidth = 1;

  if (style === 'neon') {
    ctx.strokeStyle = '#a78bfa25';
    ctx.beginPath();
    for (let x = 1; x < 10; x += quality === 'low' ? 2 : 1) {
      ctx.moveTo(left + width * x / 10, top);
      ctx.lineTo(left + width * x / 10, top + height);
    }
    for (let y = 0; y < 18; y += quality === 'low' ? 2 : 1) {
      const row = top + height * ((y + now / 1400) % 18) / 18;
      ctx.moveTo(left - 5, row);
      ctx.lineTo(left + width + 5, row);
    }
    ctx.stroke();
    ctx.strokeStyle = '#67e8f94d';
    for (const inset of [7, 13]) {
      ctx.strokeRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
    }
    const pulse = 0.5 + Math.sin(now / 460) * 0.25;
    ctx.strokeStyle = '#67e8f9';
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const side of [left + 7, left + width - 7]) {
      const y = top + 20 + ((now / 14) % Math.max(1, height - 90));
      ctx.moveTo(side, y);
      ctx.lineTo(side, y + 48);
    }
    ctx.stroke();
  } else {
    const icy = style === 'ice';
    const count = quality === 'high' ? 38 : quality === 'medium' ? 23 : 12;
    for (let i = 0; i < count; i += 1) {
      const lane = ((i * 73 + 19) % 101) / 101;
      const x = left + width * (i % 2 ? 0.8 + lane * 0.2 : lane * 0.2);
      const drift = icy ? now / (30 + i % 5 * 8) : now / (90 + i % 6 * 28);
      const y = top + (height * ((i * 47 + 13) % 97) / 97 + drift) % height;
      const radius = i % 5 === 0 ? 1.6 : 0.8;
      ctx.fillStyle = i % 5 === 0 ? '#f8fafc75' : '#dbeafe32';
      ctx.fillRect(x, y, radius * 2, radius * 2);
      if (i % 5 === 0) {
        ctx.strokeStyle = icy ? '#e0faffaa' : '#e9d5ffb0';
        ctx.globalAlpha = icy ? 1 : 0.55 + Math.sin(now / 480 + i) * 0.35;
        drawCosmeticMark(ctx, icy ? 'snow' : 'star', x, y, icy ? 5.5 : 3.8, now / 2900 + i, icy ? '#bae6fd' : '#e9d5ff');
        ctx.globalAlpha = 1;
      }
    }
    if (icy) {
      // Slow frost bands stay close to the edge and off the landing area.
      const band = 5 + Math.sin(now / 1300) * 3;
      for (const side of [left, left + width]) {
        const inside = side === left ? 1 : -1;
        const mist = ctx.createLinearGradient(side, 0, side + inside * width * 0.18, 0);
        mist.addColorStop(0, '#bae6fd38');
        mist.addColorStop(1, '#bae6fd00');
        ctx.fillStyle = mist;
        ctx.fillRect(Math.min(side, side + inside * width * 0.18), top + band, width * 0.18, height - band * 2);
      }
    } else {
      const x = left + width * 0.91;
      const y = top + height * 0.11;
      const radius = Math.min(width, height) * 0.12;
      const planet = ctx.createRadialGradient(x - radius * 0.45, y - radius * 0.45, 0, x, y, radius);
      planet.addColorStop(0, '#c4b5fd75');
      planet.addColorStop(1, '#6366f126');
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c4b5fd60';
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.5, radius * 0.28, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      const nebulaY = top + height * 0.77 + Math.sin(now / 1850) * height * 0.08;
      const nebula = ctx.createRadialGradient(left, nebulaY, 2, left, nebulaY, width * 0.57);
      nebula.addColorStop(0, '#a855f74f');
      nebula.addColorStop(0.56, '#4f46e523');
      nebula.addColorStop(1, '#4f46e500');
      ctx.fillStyle = nebula;
      ctx.fillRect(left, top + height * 0.43, width * 0.6, height * 0.57);
    }
  }
  ctx.restore();
}

export function drawRacketAccent(
  ctx: CanvasRenderingContext2D, style: Exclude<RacketStyle, 'classic'>, rx: number, ry: number,
  now: number, quality: EffectQuality,
) {
  const turn = now / 520;
  const low = quality === 'low';
  const high = quality === 'high';
  const vertical = ry > rx;
  const spread = (a: number, pad: number) => ({
    x: Math.cos(a) * (rx + pad),
    y: Math.sin(a) * (ry + pad),
  });
  const arc = (color: string, pad: number, start: number, length: number, width: number, tilt = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx + pad, ry + pad * 0.72, tilt, start, start + length);
    ctx.stroke();
  };
  ctx.globalAlpha = 0.96;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (style) {
    case 'emerald':
      arc('#4ade80', 3, turn * 0.44, Math.PI * 1.33, 1.8);
      for (let i = 0; i < (low ? 3 : 5); i += 1) {
        const a = turn * 0.44 + i * 0.96;
        const p = spread(a, 5.5 + Math.sin(turn * 2 + i) * 1.7);
        drawCosmeticMark(ctx, 'leaf', p.x, p.y, i % 2 ? 4.8 : 6, a + 0.68, i % 2 ? '#86efac' : '#34d399');
      }
      break;
    case 'sunset':
      for (const [i, color] of ['#fb923c', '#f472b6'].entries()) {
        const a = turn * 0.72 + i * Math.PI;
        arc(color, 5, a, Math.PI * 0.82, 3.6);
        arc(i === 0 ? '#ffedd5' : '#fbcfe8', 5, a + 0.14, Math.PI * 0.52, 1.2);
        if (!low) arc(color, 9, a + 0.32, Math.PI * 0.45, 1.35);
      }
      break;
    case 'lightning': {
      const beat = Math.floor(now / 110);
      for (let side = 0; side < (low ? 2 : 3); side += 1) {
        const a = turn * 0.52 + side * Math.PI * 2 / (low ? 2 : 3);
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const jump = i % 2 ? 7 : 2 + Math.sin(beat + i * 3 + side) * 2;
          const p = spread(a + i * 0.17, jump);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.4;
        ctx.stroke();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.15;
        ctx.stroke();
        const fork = spread(a + 0.49, 7);
        drawCosmeticMark(ctx, 'bolt', fork.x, fork.y, 5.5, a + Math.PI / 2, '#bae6fd');
      }
      break;
    }
    case 'flame': {
      const count = low ? 4 : high ? 8 : 6;
      for (let i = 0; i < count; i += 1) {
        const a = turn * 0.72 + i * Math.PI * 2 / count;
        const heat = 0.5 + Math.sin(turn * 3.5 + i * 2) * 0.5;
        const p = spread(a, 5.8 + heat * 2.8);
        drawCosmeticMark(ctx, 'flame', p.x, p.y, 5.7 + heat * 3, a + Math.PI / 2, i % 2 ? '#f97316' : '#fb923c');
        if (i % 2 === 0) drawCosmeticMark(ctx, 'flame', p.x, p.y, 3.3 + heat, a + Math.PI / 2, '#fde68a');
      }
      break;
    }
    case 'ice': {
      const tips = low ? 4 : 6;
      ctx.beginPath();
      for (let i = 0; i < tips * 2; i += 1) {
        const a = i * Math.PI / tips + (vertical ? Math.PI / 2 : 0);
        const p = spread(a, i % 2 ? 2.2 : 8);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = '#38bdf821';
      ctx.fill();
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 1.55;
      ctx.stroke();
      for (let i = 0; i < (low ? 2 : 3); i += 1) {
        const a = i * Math.PI * 2 / (low ? 2 : 3) - turn * 0.37;
        const p = spread(a, 9);
        drawCosmeticMark(ctx, i % 2 ? 'ice' : 'snow', p.x, p.y, 5.5, a, '#e0faff');
      }
      break;
    }
    case 'sakura': {
      const count = low ? 3 : high ? 6 : 5;
      for (let i = 0; i < count; i += 1) {
        const a = turn * 0.55 + i * Math.PI * 2 / count;
        const p = spread(a, 7 + Math.sin(turn + i) * 2.4);
        if (i === 0) {
          // One blossom stays legible even when particle quality is reduced.
          for (let petal = 0; petal < 5; petal += 1) {
            const angle = turn * 0.8 + petal * Math.PI * 2 / 5;
            drawCosmeticMark(ctx, 'petal', p.x + Math.cos(angle) * 3.5, p.y + Math.sin(angle) * 3.5,
              3.1, angle + Math.PI / 2, petal % 2 ? '#f9a8d4' : '#fbcfe8');
          }
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawCosmeticMark(ctx, 'petal', p.x, p.y, 5.2, a + turn, i % 2 ? '#f472b6' : '#fbcfe8');
        }
      }
      break;
    }
    case 'gold':
      drawCosmeticMark(ctx, 'crown', 0, -ry - 10, 8.5, 0, '#fef3c7');
      for (const side of [-1, 1]) {
        arc('#fbbf24', 5, side > 0 ? -0.78 : Math.PI - 0.78, 1.56, 1.6);
        for (let i = 0; i < (low ? 2 : 4); i += 1) {
          const a = -0.66 + i * 0.43;
          const p = spread(a, 7.2);
          drawCosmeticMark(ctx, 'leaf', side * p.x, p.y, i % 2 ? 4.2 : 5.2,
            side * (a - 0.75), i % 2 ? '#fbbf24' : '#fde68a');
        }
      }
      break;
    case 'galaxy':
      arc('#a78bfa', 10, turn * 0.72, Math.PI * 1.7, 2.8, 0.24);
      arc('#67e8f9', 13, -turn * 0.52 + 0.6, Math.PI * 1.47, 1.7, -0.26);
      if (high) arc('#f0abfc', 16, turn * 0.45 + 0.9, Math.PI * 0.85, 1.2, 0.08);
      for (let i = 0; i < (low ? 2 : high ? 6 : 4); i += 1) {
        const a = turn * 0.9 + i * 2.4;
        const p = spread(a, 9 + Math.sin(turn + i) * 4.4);
        drawCosmeticMark(ctx, 'star', p.x, p.y, i % 3 ? 3.8 : 5.7, a, i % 2 ? '#f5d0fe' : '#e0f2fe');
      }
      break;
  }
}

export function drawShuttleAccent(
  ctx: CanvasRenderingContext2D, style: ShuttleStyle, now: number,
  quality: EffectQuality, smash: number,
) {
  const pulse = 0.5 + Math.sin(now / 125) * 0.5;
  ctx.save();
  ctx.lineWidth = 1.35;
  switch (style) {
    case 'classic':
      break;
    case 'sky':
      for (const side of [-1, 1]) drawCosmeticMark(ctx, 'gust', -11, side * (9 + pulse * 2), 4.5, 0, '#bae6fd');
      break;
    case 'rose':
      drawCosmeticMark(ctx, 'rose', -15, -10 - pulse * 2, 3.7, now / 380, '#fda4af');
      if (quality !== 'low') drawCosmeticMark(ctx, 'rose', -9, 10, 2.4, now / -410, '#fecdd3');
      break;
    case 'meteor':
      drawCosmeticMark(ctx, 'meteor', -19 - smash * 5, 0, 4 + pulse * 2 + smash * 2, 0, '#fde68a');
      if (quality !== 'low') drawCosmeticMark(ctx, 'flame', -17, -8, 3.2 + smash, 0, '#fb923c');
      break;
    case 'frost':
      drawCosmeticMark(ctx, 'snow', -15, -10, 3.8 + pulse + smash, now / 650, '#a5f3fc');
      if (quality !== 'low') drawCosmeticMark(ctx, 'ice', -14, 10, 3, now / -470, '#e0f2fe');
      break;
    case 'rainbow':
      for (const [i, color] of ['#f472b6', '#fde047', '#67e8f9'].entries()) {
        if (quality === 'low' && i > 0) break;
        drawCosmeticMark(ctx, 'spectrum', -8 - i * 5, (i % 2 ? 1 : -1) * (8 + pulse * 3), 2.5 + smash, now / 380 + i, color);
      }
      break;
    case 'neon':
      ctx.globalAlpha = 0.68 + pulse * 0.25;
      for (const side of [-1, 1]) {
        const color = (side > 0) === (pulse > 0.5) ? '#22d3ee' : '#c084fc';
        drawCosmeticMark(ctx, 'pulse', -11, side * (9 + smash * 5), 4.4 + smash * 2, 0, color);
      }
      break;
    case 'mechanical': {
      const spread = 1 + smash * 0.35;
      const count = quality === 'low' ? 3 : 6;
      ctx.globalAlpha = 0.63 + pulse * 0.26;
      for (let i = 0; i < count; i += 1) {
        const a = i * Math.PI * 2 / count + now / 880;
        const x = -5 + Math.cos(a) * 16 * spread;
        const y = Math.sin(a) * 10 * spread;
        drawCosmeticMark(ctx, 'hex', x, y, 2.4 + smash * 1.2, a, i % 2 ? '#e2e8f0' : '#67e8f9');
      }
      break;
    }
  }
  ctx.restore();
}

type CustomTrailStyle = Exclude<TrailStyle, 'classic'>;

const TRAIL_LOOK: Record<CustomTrailStyle, { duration: number; width: number; glow: string; core: string }> = {
  wind: { duration: 145, width: 6, glow: '#0284c7', core: '#bae6fd' },
  flame: { duration: 190, width: 9, glow: '#f43f5e', core: '#fff1aa' },
  lightning: { duration: 218, width: 10, glow: '#2563eb', core: '#ecfeff' },
  rainbow: { duration: 250, width: 15, glow: '#a855f7', core: '#fdf4ff' },
  galaxy: { duration: 290, width: 19, glow: '#8b5cf6', core: '#f5d0fe' },
};

const RAINBOW_TRAIL_COLORS = ['#fb7185', '#fb923c', '#fde047', '#4ade80', '#38bdf8', '#c084fc'];

function mixTimingColor(color: string, tint: string, amount: number) {
  const from = Number.parseInt(color.slice(1), 16);
  const to = Number.parseInt(tint.slice(1), 16);
  const channels = [16, 8, 0].map(shift => {
    const base = (from >> shift) & 255;
    const target = (to >> shift) & 255;
    return Math.round(base + (target - base) * amount);
  });
  return `rgb(${channels.join(',')})`;
}

function createTimingPalette(color: string, fill: string) {
  return {
    color,
    fill,
    highlight: mixTimingColor(color, '#ffffff', 0.56),
    midtone: mixTimingColor(color, '#ffffff', 0.25),
    rainbow: RAINBOW_TRAIL_COLORS.map(band => mixTimingColor(color, band, 0.4)),
  };
}

const TIMING_TARGET_PALETTES = {
  outside: createTimingPalette('#fb923c', 'rgba(251,146,60,0.12)'),
  normal: createTimingPalette('#fde047', 'rgba(253,224,71,0.16)'),
  perfect: createTimingPalette('#4ade80', 'rgba(74,222,128,0.22)'),
  attack: createTimingPalette('#fb7185', 'rgba(251,113,133,0.24)'),
  defense: createTimingPalette('#7dd3fc', 'rgba(186,230,253,0.2)'),
};

type TimingTargetState = keyof typeof TIMING_TARGET_PALETTES;

interface TimingTargetFrame {
  center: Point;
  radiusX: number;
  radiusY: number;
  focus: number;
  state: TimingTargetState;
  classicEmphasis: boolean;
  now: number;
  quality: EffectQuality;
}

export function drawTrailTimingTarget(
  ctx: CanvasRenderingContext2D, style: TrailStyle,
  { center, radiusX, radiusY, focus, state, classicEmphasis, now, quality }: TimingTargetFrame,
) {
  const { color, fill, highlight, midtone, rainbow } = TIMING_TARGET_PALETTES[state];
  if (style === 'classic') {
    const trace = (rx: number, ry: number) => {
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = fill;
    ctx.lineWidth = classicEmphasis ? 4 : 2.5;
    ctx.setLineDash([7, 5]);
    trace(radiusX, radiusY);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (classicEmphasis) {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      trace(radiusX + 7, radiusY + 5);
      ctx.stroke();
    }
    if (state === 'defense') {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      trace(Math.max(radiusX - 5, 5), Math.max(radiusY - 3, 4));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const ink = state === 'defense' ? '#f8fafc' : highlight;
  const low = quality === 'low';
  const tau = Math.PI * 2;
  const turn = now / 1350;
  const weight = 1.9 + focus * 0.8;
  const ellipse = (scale: number, start = 0, end = tau) => {
    ctx.ellipse(0, 0, radiusX * scale, radiusY * scale, 0, start, end);
  };
  const polygon = (sides: number, scale: number, rotation: number) => {
    for (let i = 0; i < sides; i += 1) {
      const a = rotation + i * tau / sides;
      const x = Math.cos(a) * radiusX * scale;
      const y = Math.sin(a) * radiusY * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  const detail = (path: () => void, tint = midtone, lineWidth = 1.15) => {
    ctx.beginPath();
    path();
    ctx.strokeStyle = tint;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };
  const silhouette = (path: () => void, paintFill = true) => {
    ctx.beginPath();
    path();
    if (paintFill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = '#071722b5';
    ctx.lineWidth = weight + 3;
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = low ? 0 : (quality === 'high' ? 6 : 3) + focus * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.85 + focus * 0.45;
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (style) {
    case 'wind':
      // The two crescents form the target silhouette and narrow toward their tips.
      for (const direction of [-1, 1]) {
        const x = radiusX * direction;
        const y = radiusY * direction;
        const bend = 1 + Math.sin(turn * 2) * 0.08;
        silhouette(() => {
          ctx.moveTo(-1.13 * x, -0.03 * y);
          ctx.bezierCurveTo(-0.75 * x, -1.38 * y * bend, 0.38 * x, -1.36 * y, 1.05 * x, -0.45 * y);
          ctx.bezierCurveTo(0.27 * x, -0.96 * y, -0.48 * x, -0.66 * y, -1.13 * x, -0.03 * y);
          ctx.closePath();
        });
        if (!low) detail(() => {
          ctx.moveTo(-0.57 * x, -1.01 * y);
          ctx.quadraticCurveTo(-0.04 * x, -1.44 * y, 0.54 * x, -1.01 * y);
        }, midtone);
      }
      break;
    case 'flame': {
      // A hexagonal seal with two interlocking triangles.
      const tilt = Math.sin(turn) * 0.12;
      silhouette(() => polygon(6, 1.04, tilt));
      detail(() => polygon(3, 0.86, tilt), ink, 1.3);
      detail(() => polygon(3, 0.86, tilt + Math.PI), ink, 1.3);
      if (!low) {
        for (let i = 0; i < 3; i += 1) {
          const angle = i * tau / 3 + tilt;
          const flicker = 0.5 + Math.sin(now / 115 + i * 2) * 0.5;
          drawCosmeticMark(ctx, 'flame', Math.cos(angle) * radiusX * 1.12,
            Math.sin(angle) * radiusY * 1.12, 2.8 + flicker * 1.4, angle + Math.PI / 2, highlight);
        }
      }
      break;
    }
    case 'lightning': {
      // An angular outline carries the current. Its tips lead to branching sparks.
      const jag = Math.sin(Math.floor(now / 120) * 2.4) * 0.09;
      const bolts = [
        [-1.12, 0.13], [-0.68, -0.54], [-0.58, -0.31], [-0.26, -0.93],
        [-0.09, -0.65], [0.46, -0.92], [0.88, -0.36], [0.62, -0.29],
        [1.12, -0.13], [0.68, 0.54], [0.58, 0.31], [0.26, 0.93],
        [0.09, 0.65], [-0.46, 0.92], [-0.88, 0.36], [-0.62, 0.29],
      ];
      silhouette(() => {
        bolts.forEach(([x, y], i) => {
          const px = x * radiusX;
          const py = (y + (i % 2 ? jag : 0)) * radiusY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      });
      for (const side of [-1, 1]) {
        detail(() => {
          ctx.moveTo(side * 0.67 * radiusX, side * -0.5 * radiusY);
          ctx.lineTo(side * 0.99 * radiusX, side * -0.86 * radiusY);
          if (!low) ctx.lineTo(side * 1.13 * radiusX, side * -0.74 * radiusY);
        }, ink, 1.3);
      }
      break;
    }
    case 'rainbow': {
      // Six ribbons meet at the tips of a prism instead of circling a separate rim.
      rainbow.forEach((band, i) => {
        const side = i < 3 ? -1 : 1;
        const lift = 0.55 + (i % 3) * 0.28;
        const sway = Math.sin(turn * 2.3) * 0.12;
        detail(() => {
          ctx.moveTo(-radiusX * 1.06, 0);
          ctx.bezierCurveTo(-radiusX * 0.5, radiusY * side * (lift + sway),
            radiusX * 0.42, radiusY * side * (lift - sway), radiusX * 1.06, 0);
        }, state === 'defense' && (i === 1 || i === 4) ? ink : band, low ? 1.2 : 1.6);
      });
      detail(() => {
        for (const side of [-1, 1]) {
          const x = side * radiusX * 1.06;
          ctx.moveTo(x, -2.6);
          ctx.lineTo(x + side * 2.6, 0);
          ctx.lineTo(x, 2.6);
        }
      }, ink, 1.3);
      break;
    }
    case 'galaxy': {
      // The sweep, radial grid and inner range rings are part of the radar target.
      silhouette(() => ellipse(1.04));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ellipse(1.01, turn, turn + 0.55);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      detail(() => ellipse(0.66), midtone, 1);
      if (!low) detail(() => ellipse(0.33), midtone, 0.9);
      detail(() => {
        const spokes = low ? 4 : 8;
        for (let i = 0; i < spokes; i += 1) {
          const a = i * tau / spokes;
          ctx.moveTo(Math.cos(a) * radiusX * 0.23, Math.sin(a) * radiusY * 0.23);
          ctx.lineTo(Math.cos(a) * radiusX * 1.04, Math.sin(a) * radiusY * 1.04);
        }
      }, midtone, 0.85);
      detail(() => {
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(turn + 0.55) * radiusX, Math.sin(turn + 0.55) * radiusY);
      }, ink, 1.7);
      break;
    }
  }

  // A small diamond marks the exact landing point on every silhouette.
  const centerSize = 2.15 + focus * 0.85;
  ctx.fillStyle = state === 'defense' ? ink : color;
  ctx.beginPath();
  ctx.moveTo(0, -centerSize);
  ctx.lineTo(centerSize, 0);
  ctx.lineTo(0, centerSize);
  ctx.lineTo(-centerSize, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function getFlightTrailWindow(style: CustomTrailStyle, speed: number, smash: number) {
  const boost = style === 'flame' || style === 'galaxy' ? 0.24 * smash : 0;
  return TRAIL_LOOK[style].duration * (0.48 + 0.52 * Math.min(1, speed / 1.35) + boost);
}

type TrailSample = Point & { normalX: number; normalY: number; progress: number };

// The points are ordered from tail to shuttle. Normals keep ribbons and bolts
// aligned to the actual flight direction, including the arc of the shuttle.
function drawRibbon(
  ctx: CanvasRenderingContext2D, samples: TrailSample[], width: number, color: string, opacity: number,
  offset: (sample: TrailSample, index: number) => number = () => 0,
) {
  const tail = samples[0];
  const head = samples[samples.length - 1];
  const colorFade = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  colorFade.addColorStop(0, color + '00');
  colorFade.addColorStop(0.4, color + 'a0');
  colorFade.addColorStop(1, color);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = colorFade;
  ctx.beginPath();
  const traceSide = (sample: TrailSample, index: number, direction: number) => {
    const edge = offset(sample, index) + width * Math.pow(sample.progress, 0.78) * direction / 2;
    ctx.lineTo(sample.x + sample.normalX * edge, sample.y + sample.normalY * edge);
  };
  samples.forEach((sample, index) => traceSide(sample, index, 1));
  for (let i = samples.length - 1; i >= 0; i -= 1) traceSide(samples[i], i, -1);
  ctx.closePath();
  ctx.fill();
}

export function drawFlightTrail(
  ctx: CanvasRenderingContext2D, style: CustomTrailStyle, points: Point[], now: number,
  fade: number, quality: EffectQuality, speed: number, smash: number, shotAt: number,
) {
  if (points.length < 2 || fade <= 0) return;
  const tail = points[0];
  const head = points[points.length - 1];
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 1) return;

  const samples: TrailSample[] = points.map((point, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    return { ...point, normalX: -dy / length, normalY: dx / length, progress: i / (points.length - 1) };
  });
  const { width: baseWidth, glow, core } = TRAIL_LOOK[style];
  const width = baseWidth * (1 + smash * 0.18);
  const low = quality === 'low';
  const detailStep = quality === 'high' ? 2 : quality === 'medium' ? 3 : 5;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (!low) drawRibbon(ctx, samples, width * 1.65, glow, fade * 0.44);
  switch (style) {
    case 'wind':
      drawRibbon(ctx, samples, width * 0.74, '#38bdf8', fade, sample => sample.progress * 1.1);
      drawRibbon(ctx, samples, 1.9, core, fade * 0.91, sample => -sample.progress * (5 + Math.sin(now / 170 + sample.progress * 4) * 2));
      break;
    case 'flame':
      drawRibbon(ctx, samples, width, '#f97316', fade, sample => Math.sin(now / 76 + sample.progress * 10) * sample.progress * 2.5);
      drawRibbon(ctx, samples, 4.5, core, fade);
      ctx.fillStyle = '#fbbf24';
      for (let i = 3; i < samples.length - 2; i += detailStep) {
        const sample = samples[i];
        const flicker = Math.sin(now / 76 + i * 3);
        const offset = flicker * (5 + sample.progress * 6);
        ctx.globalAlpha = fade * (0.45 + sample.progress * 0.5);
        const x = sample.x + sample.normalX * offset;
        const y = sample.y + sample.normalY * offset;
        if (smash > 0.1) {
          const tip = 3 + smash * 5;
          ctx.beginPath();
          ctx.moveTo(x - sample.normalY * tip, y + sample.normalX * tip);
          ctx.lineTo(x + sample.normalX * 1.8, y + sample.normalY * 1.8);
          ctx.lineTo(x - sample.normalX * 1.8, y - sample.normalY * 1.8);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 1 + sample.progress * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'lightning': {
      const seed = Math.floor(shotAt / 11) % 251;
      const charge = 1 - smash * 0.42;
      const offset = (sample: TrailSample, i: number) =>
        (i % 2 ? 1 : -1) * (3 + (Math.sin(seed * 1.7 + i * 11) + 1) * 2) * sample.progress * charge;
      drawRibbon(ctx, samples, 7, '#38bdf8', fade * 0.9, offset);
      drawRibbon(ctx, samples, 3, core, fade, offset);
      ctx.strokeStyle = '#67e8f9';
      ctx.globalAlpha = fade * (0.75 + Math.sin(now / 63) * 0.23);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const branchStep = detailStep + (speed < 0.9 ? 1 : 0);
      for (let i = 4; i < samples.length - 2; i += branchStep) {
        const sample = samples[i];
        if (!low && (i + Math.floor(now / 90)) % 5 === 0) continue;
        const branch = (Math.sin(seed + i * 13) > 0 ? 1 : -1) * (8 + sample.progress * 8) * charge;
        const forkX = sample.x + sample.normalX * branch * 0.62;
        const forkY = sample.y + sample.normalY * branch * 0.62;
        ctx.moveTo(sample.x + sample.normalX * offset(sample, i), sample.y + sample.normalY * offset(sample, i));
        ctx.lineTo(forkX - sample.normalY * 4, forkY + sample.normalX * 4);
        ctx.lineTo(sample.x + sample.normalX * branch, sample.y + sample.normalY * branch);
      }
      ctx.stroke();
      break;
    }
    case 'rainbow': {
      RAINBOW_TRAIL_COLORS.forEach((color, i) => {
        drawRibbon(ctx, samples, low ? 2.5 : 3.1, color, fade,
          sample => (i - 2.5) * (2.75 + Math.min(speed, 1.65) * 0.4) * Math.pow(sample.progress, 0.77));
      });
      ctx.strokeStyle = core;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = fade * 0.9;
      for (let i = 4; !low && i < samples.length - 2; i += detailStep + 2) {
        const sample = samples[i];
        drawSpark(ctx, sample.x + sample.normalX * 8, sample.y + sample.normalY * 8, 2.3 + Math.sin(now / 150 + i));
      }
      break;
    }
    case 'galaxy':
      drawRibbon(ctx, samples, width, '#6d28d9', fade * 0.78, sample => Math.sin(sample.progress * 8 + now / 210) * sample.progress * 2.7);
      drawRibbon(ctx, samples, 8, '#c084fc', fade * 0.95);
      const swirl = (sample: TrailSample) => Math.sin(sample.progress * (10 + smash * 5) - now / 180) * sample.progress * (9 + smash * 5);
      drawRibbon(ctx, samples, 2.6, core, fade);
      drawRibbon(ctx, samples, 2.1, '#67e8f9', fade * 0.86, swirl);
      if (!low) drawRibbon(ctx, samples, 2.1, '#f0abfc', fade * 0.9, sample => -swirl(sample));
      ctx.lineWidth = 1.6;
      for (let i = 3; i < samples.length - 1; i += detailStep) {
        const sample = samples[i];
        const offset = (i % 4 === 1 ? 1 : -1) * (5 + sample.progress * 10) + swirl(sample) * 0.6;
        ctx.globalAlpha = fade * (0.8 + Math.sin(now / 142 + i) * 0.19);
        ctx.strokeStyle = i % 4 === 1 ? '#f5d0fe' : '#fef3c7';
        drawSpark(ctx, sample.x + sample.normalX * offset, sample.y + sample.normalY * offset, 2 + sample.progress * 3);
      }
      break;
  }
  ctx.restore();
}
