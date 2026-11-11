import type { CourtStyle, RacketStyle, ShuttleStyle, TrailStyle } from '../../types';
import { GAME_COSMETIC_ITEMS, type CosmeticRarity } from './gameCosmetics';

export type EffectQuality = 'high' | 'medium' | 'low';
export type EffectEvent = 'hit' | 'smash' | 'score' | 'win';
export type TrialStage = 'move' | EffectEvent;
export type TrialMode = TrialStage | 'auto' | 'free' | 'timing';
export type CosmeticPoint = { x: number; y: number };
export type CosmeticCourt = CosmeticPoint & { width: number; height: number };

export const TRIAL_STAGES: readonly { id: TrialStage; label: string }[] = [
  { id: 'move', label: '移動' }, { id: 'hit', label: '擊球' },
  { id: 'smash', label: '殺球' }, { id: 'score', label: '得分' }, { id: 'win', label: '勝利' },
];
export const TRIAL_STAGE_LENGTH = 1750;
export const TRIAL_EVENT_AT = 470;

const QUALITY_FACTOR: Record<EffectQuality, number> = { high: 1, medium: 0.68, low: 0.38 };
const EVENT_DURATION: Record<EffectEvent, number> = { hit: 165, smash: 315, score: 590, win: 1150 };
const RACKET_EVENT_DURATION: Record<EffectEvent, number> = { hit: 240, smash: 390, score: 650, win: 1150 };
const TAU = Math.PI * 2;
const SPECTRUM = ['#fb7185', '#fb923c', '#fde047', '#4ade80', '#38bdf8', '#c084fc'];

type Mark = 'leaf' | 'sunset' | 'bolt' | 'flame' | 'ice' | 'petal' | 'crown' | 'star'
  | 'gust' | 'rose' | 'meteor' | 'snow' | 'spectrum' | 'pulse' | 'hex';

type Motif = { mark: Mark; colors: readonly string[]; rarity: CosmeticRarity };

function motif(id: string, mark: Mark, ...colors: string[]): Motif {
  const item = GAME_COSMETIC_ITEMS.find(item => item.id === id);
  return { mark, colors, rarity: item?.rarity ?? 0 };
}

const RACKET_MOTIFS: Record<Exclude<RacketStyle, 'classic'>, Motif> = {
  emerald: motif('racket_emerald', 'leaf', '#34d399', '#bbf7d0'),
  sunset: motif('racket_sunset', 'sunset', '#fb923c', '#f9a8d4'),
  lightning: motif('racket_lightning', 'bolt', '#38bdf8', '#e0f2fe'),
  flame: motif('racket_flame', 'flame', '#fb923c', '#fde68a'),
  ice: motif('racket_ice', 'ice', '#67e8f9', '#ecfeff'),
  sakura: motif('racket_sakura', 'petal', '#f472b6', '#fbcfe8'),
  gold: motif('racket_gold', 'crown', '#fbbf24', '#fef3c7'),
  galaxy: motif('racket_galaxy', 'star', '#a78bfa', '#67e8f9', '#f5d0fe'),
};
const SHUTTLE_MOTIFS: Record<Exclude<ShuttleStyle, 'classic'>, Motif> = {
  sky: motif('shuttle_sky', 'gust', '#7dd3fc', '#e0f2fe'),
  rose: motif('shuttle_rose', 'rose', '#fb7185', '#ffe4e6'),
  meteor: motif('shuttle_meteor', 'meteor', '#f59e0b', '#fff7ce'),
  frost: motif('shuttle_frost', 'snow', '#7dd3fc', '#ecfeff'),
  rainbow: motif('shuttle_rainbow', 'spectrum', ...SPECTRUM),
  neon: motif('shuttle_neon', 'pulse', '#c084fc', '#22d3ee'),
  mechanical: motif('shuttle_mechanical', 'hex', '#67e8f9', '#e2e8f0'),
};
const TRAIL_STAR = motif('trail_galaxy', 'star', '#c084fc', '#f5d0fe', '#fef3c7');

export function drawCosmeticMark(ctx: CanvasRenderingContext2D, mark: Mark, x: number, y: number, size: number, rotation: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size, size);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1 / size;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (mark) {
    case 'leaf':
      ctx.moveTo(-0.85, 0.45);
      ctx.quadraticCurveTo(-0.7, -0.85, 0.85, -0.65);
      ctx.quadraticCurveTo(0.65, 0.65, -0.85, 0.45);
      ctx.fill();
      break;
    case 'sunset':
      ctx.ellipse(0, 0, 1.35, 0.72, 0, Math.PI * 0.98, TAU);
      ctx.stroke();
      break;
    case 'bolt':
      ctx.moveTo(-1, -0.35);
      ctx.lineTo(-0.15, -0.7);
      ctx.lineTo(-0.4, 0.1);
      ctx.lineTo(0.3, -0.05);
      ctx.lineTo(1, 0.7);
      ctx.moveTo(0.3, -0.05);
      ctx.lineTo(0.75, -0.48);
      ctx.lineTo(1.05, -0.36);
      ctx.stroke();
      break;
    case 'flame':
      ctx.moveTo(-1.5, 0.1);
      ctx.bezierCurveTo(-0.4, 0.65, 0.45, 1, 0.8, 0.2);
      ctx.quadraticCurveTo(1.1, -0.52, 0.25, -0.96);
      ctx.quadraticCurveTo(0.5, -0.1, -0.24, -0.35);
      ctx.quadraticCurveTo(-0.78, -0.58, -1.5, 0.1);
      ctx.fill();
      break;
    case 'ice':
      ctx.moveTo(0, -1.05);
      ctx.lineTo(0.82, -0.4);
      ctx.lineTo(0.58, 0.63);
      ctx.lineTo(-0.25, 0.95);
      ctx.lineTo(-0.82, 0.29);
      ctx.lineTo(-0.62, -0.65);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -1.05);
      ctx.lineTo(0.13, 0.05);
      ctx.lineTo(0.58, 0.63);
      ctx.moveTo(0.13, 0.05);
      ctx.lineTo(-0.82, 0.29);
      ctx.stroke();
      break;
    case 'petal':
    case 'rose':
      ctx.moveTo(0, 0.92);
      ctx.bezierCurveTo(-1.15, 0.16, -0.86, -1.08, -0.22, -0.83);
      ctx.lineTo(0, -0.54);
      ctx.quadraticCurveTo(0.27, -1.1, 0.7, -0.65);
      ctx.bezierCurveTo(1.02, -0.32, 0.61, 0.62, 0, 0.92);
      ctx.fill();
      if (mark === 'rose') {
        ctx.globalAlpha *= 0.62;
        ctx.strokeStyle = '#9f1239';
        ctx.beginPath();
        ctx.moveTo(0.08, 0.5);
        ctx.quadraticCurveTo(-0.3, 0.2, 0.19, -0.36);
        ctx.stroke();
      }
      break;
    case 'crown':
      ctx.moveTo(-1, -0.55);
      ctx.lineTo(-0.48, -0.12);
      ctx.lineTo(0, -0.86);
      ctx.lineTo(0.48, -0.12);
      ctx.lineTo(1, -0.55);
      ctx.lineTo(0.72, 0.6);
      ctx.lineTo(-0.72, 0.6);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'star':
    case 'meteor':
      ctx.moveTo(0, -1);
      ctx.lineTo(0.27, -0.27);
      ctx.lineTo(1, 0);
      ctx.lineTo(0.27, 0.27);
      ctx.lineTo(0, 1);
      ctx.lineTo(-0.27, 0.27);
      ctx.lineTo(mark === 'meteor' ? -1.65 : -1, 0);
      ctx.lineTo(-0.27, -0.27);
      ctx.closePath();
      ctx.fill();
      break;
    case 'gust':
      ctx.moveTo(-1.12, -0.42);
      ctx.quadraticCurveTo(0, -1, 0.95, -0.2);
      ctx.moveTo(-0.88, 0.4);
      ctx.quadraticCurveTo(0.08, 0, 0.8, 0.32);
      ctx.stroke();
      break;
    case 'snow':
      for (let i = 0; i < 6; i += 1) {
        const a = i * TAU / 6;
        const dx = Math.cos(a), dy = Math.sin(a);
        ctx.moveTo(0, 0);
        ctx.lineTo(dx, dy);
        ctx.moveTo(dx * 0.68, dy * 0.68);
        ctx.lineTo(dx * 0.51 - dy * 0.27, dy * 0.51 + dx * 0.27);
      }
      ctx.stroke();
      break;
    case 'pulse':
      ctx.moveTo(-0.9, 0.58);
      ctx.lineTo(-0.05, -0.66);
      ctx.moveTo(-0.05, 0.58);
      ctx.lineTo(0.8, -0.66);
      ctx.stroke();
      break;
    case 'hex':
      for (let i = 0; i < 6; i += 1) ctx.lineTo(Math.cos(i * TAU / 6), Math.sin(i * TAU / 6));
      ctx.closePath();
      ctx.stroke();
      break;
    case 'spectrum':
      ctx.moveTo(-0.65, 0.6);
      ctx.lineTo(-0.15, -0.72);
      ctx.lineTo(0.65, -0.42);
      ctx.lineTo(0.18, 0.72);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawRacketMotion(
  ctx: CanvasRenderingContext2D, style: Exclude<RacketStyle, 'classic'>, position: CosmeticPoint,
  dx: number, dy: number, now: number, quality: EffectQuality,
) {
  const speed = Math.hypot(dx, dy);
  if (speed < 16) return;
  const angle = Math.atan2(dy, dx);
  const strength = Math.min(speed / 430, 1);
  ctx.save();
  const theme = RACKET_MOTIFS[style];
  const count = quality === 'low' ? 2 : theme.rarity >= 3 ? 4 : 3;
  for (let i = 0; i < count; i += 1) {
    const distance = 8 + (i + 1) * (5 + strength * 9);
    const drift = Math.sin(now / 100 + i) * (4 + i * 2);
    const x = position.x - Math.cos(angle) * distance - Math.sin(angle) * drift;
    const y = position.y - Math.sin(angle) * distance + Math.cos(angle) * drift;
    ctx.globalAlpha = (0.44 + strength * 0.48) * (1 - i * 0.16);
    const mark = style === 'gold' && i > 0 ? 'leaf' : theme.mark;
    const spin = style === 'sakura' || style === 'emerald' ? now / 320 + i : 0;
    drawCosmeticMark(ctx, mark, x, y, 4.2 + strength * 4.1, angle + spin, theme.colors[i % theme.colors.length]);
  }
  ctx.restore();
}

interface ActiveEffect extends CosmeticPoint {
  kind: EffectEvent;
  at: number;
  player: boolean;
  velocityX: number;
  velocityY: number;
}

interface EffectLoadout {
  racket: RacketStyle;
  shuttle: ShuttleStyle;
  court: CourtStyle;
  trail: TrailStyle;
}

// A fixed ring of recent events replaces per-particle allocations.
export class CosmeticEvents {
  private readonly events: ActiveEffect[] = Array.from({ length: 7 }, () => (
    { kind: 'hit', x: 0, y: 0, at: -Infinity, player: false, velocityX: 0, velocityY: 0 }
  ));
  private next = 0;

  reset() {
    for (const effect of this.events) effect.at = -Infinity;
    this.next = 0;
  }

  emit(kind: EffectEvent, at: number, x: number, y: number, player: boolean, velocityX = 0, velocityY = 0) {
    const effect = this.events[this.next];
    effect.kind = kind;
    effect.at = at;
    effect.x = x;
    effect.y = y;
    effect.player = player;
    effect.velocityX = velocityX;
    effect.velocityY = velocityY;
    this.next = (this.next + 1) % this.events.length;
  }

  drawCourt(ctx: CanvasRenderingContext2D, court: CosmeticCourt, style: CourtStyle, now: number, quality: EffectQuality) {
    if (style === 'classic') return;
    for (const effect of this.events) {
      const t = (now - effect.at) / EVENT_DURATION[effect.kind];
      if (t < 0 || t >= 1 || (effect.kind === 'win' && style !== 'space')) continue;
      drawCourtResponse(ctx, court, style, effect.kind, effect.y, t, quality);
    }
  }

  drawObjects(
    ctx: CanvasRenderingContext2D, loadout: EffectLoadout, toScreen: (x: number, y: number) => CosmeticPoint,
    now: number, quality: EffectQuality,
  ) {
    const { racket, shuttle, trail } = loadout;
    for (const effect of this.events) {
      const t = (now - effect.at) / EVENT_DURATION[effect.kind];
      const racketT = (now - effect.at) / RACKET_EVENT_DURATION[effect.kind];
      const sharedActive = t >= 0 && t < 1;
      const racketActive = racket !== 'classic' && effect.player && racketT >= 0 && racketT < 1;
      if (!sharedActive && !racketActive) continue;
      const contact = toScreen(effect.x, effect.y);
      const heading = toScreen(effect.x + effect.velocityX, effect.y + effect.velocityY);
      const angle = Math.atan2(heading.y - contact.y, heading.x - contact.x);
      if (racketActive) {
        const origin = effect.kind === 'win' || effect.kind === 'score' ? toScreen(0.15, 0.5) : contact;
        drawRacketResponse(ctx, racket, origin, effect.kind, racketT, quality, angle);
      }
      if (!sharedActive) continue;
      if (shuttle !== 'classic') {
        const density = effect.player && racket !== 'classic' ? 0.58 : 0.83;
        drawResponse(ctx, SHUTTLE_MOTIFS[shuttle], contact, effect.kind, t, quality, density, angle);
      }
      if (trail === 'galaxy' && (effect.kind === 'smash' || effect.kind === 'score')) {
        drawResponse(ctx, TRAIL_STAR, contact, effect.kind, t, quality, 0.48, angle);
      }
    }
  }
}

function drawRacketResponse(
  ctx: CanvasRenderingContext2D, style: Exclude<RacketStyle, 'classic'>, center: CosmeticPoint, kind: EffectEvent,
  t: number, quality: EffectQuality, heading: number,
) {
  const { rarity } = RACKET_MOTIFS[style];
  if ((kind === 'score' && rarity < 3) || (kind === 'win' && rarity < 4)) return;
  const smash = kind === 'smash';
  const celebration = kind === 'score' || kind === 'win';
  const low = quality === 'low';
  const progress = 1 - (1 - t) ** 2;
  const fade = (1 - t) ** 0.82;
  const spread = 12 + progress * (celebration ? 44 : smash ? 41 : 25);
  const { x, y } = center;
  const trace = (path: () => void, color: string, width: number, alpha = 1) => {
    ctx.globalAlpha = fade * alpha;
    ctx.beginPath();
    path();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const arc = (rx: number, ry: number, tilt: number, start: number, end: number, color: string, width: number, alpha = 1) =>
    trace(() => ctx.ellipse(x, y, rx, ry, tilt, start, end), color, width, alpha);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = fade;
  switch (style) {
    case 'emerald': {
      const count = low ? 4 : smash ? 8 : 6;
      for (let i = 0; i < count; i += 1) {
        const angle = heading + (i / (count - 1) - 0.5) * Math.PI * 1.18;
        const reach = spread * (0.72 + (i % 3) * 0.15);
        const px = x + Math.cos(angle) * reach;
        const py = y + Math.sin(angle) * reach;
        trace(() => {
          ctx.moveTo(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7);
          ctx.quadraticCurveTo(px - Math.sin(angle) * 7, py + Math.cos(angle) * 7, px, py);
        }, '#4ade80', 1.3, 0.75);
        ctx.globalAlpha = fade;
        drawCosmeticMark(ctx, 'leaf', px, py, 5.5 + (i % 2) * 1.8, angle + 0.6 + t, i % 2 ? '#34d399' : '#bbf7d0');
      }
      break;
    }
    case 'sunset': {
      const sweep = smash ? 1.27 : 1.03;
      arc(spread * 1.16, spread * 0.77, heading, -sweep, sweep, '#fb923c', smash ? 5 : 4);
      arc(spread * 1.16, spread * 0.77, heading, -sweep * 0.88, sweep * 0.88, '#ffedd5', 1.25);
      arc(spread * 0.8, spread * 0.56, heading, -sweep * 1.09, sweep * 0.92, '#f472b6', smash ? 3.6 : 3);
      break;
    }
    case 'lightning': {
      const charge = smash && t < 0.17 ? 0.52 + t * 2 : 1;
      const branches = low ? 3 : smash ? 6 : 4;
      for (let i = 0; i < branches; i += 1) {
        const a = heading + i * TAU / branches;
        const reach = spread * charge * (i % 2 ? 0.79 : 1.1);
        const rootX = x + Math.cos(a) * 3;
        const rootY = y + Math.sin(a) * 3;
        const kneeX = x + Math.cos(a) * reach * 0.48 - Math.sin(a) * 5;
        const kneeY = y + Math.sin(a) * reach * 0.48 + Math.cos(a) * 5;
        const bolt = () => {
          ctx.moveTo(rootX, rootY);
          ctx.lineTo(kneeX, kneeY);
          ctx.lineTo(kneeX + Math.sin(a) * 9, kneeY - Math.cos(a) * 9);
          ctx.lineTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
          ctx.moveTo(kneeX, kneeY);
          ctx.lineTo(kneeX + Math.cos(a) * reach * 0.21 - Math.sin(a) * 7, kneeY + Math.sin(a) * reach * 0.21 + Math.cos(a) * 7);
        };
        trace(bolt, '#0ea5e9', smash ? 4 : 3.2);
        trace(bolt, '#e0f2fe', 1.35);
      }
      break;
    }
    case 'flame': {
      const count = low ? 5 : smash ? 9 : 7;
      for (let i = 0; i < count; i += 1) {
        const a = heading + i * TAU / count + t * 0.72;
        const reach = spread * (smash ? 0.74 + i % 2 * 0.15 : 0.51 + i % 3 * 0.15);
        const px = x + Math.cos(a) * reach;
        const py = y + Math.sin(a) * reach * 0.82;
        const size = (smash ? 10 : 7.3) * (1 - t * 0.45);
        drawCosmeticMark(ctx, 'flame', px, py, size, a, '#f97316');
        drawCosmeticMark(ctx, 'flame', px, py, size * 0.56, a, '#fde68a');
      }
      break;
    }
    case 'ice': {
      trace(() => {
        for (let i = 0; i < 6; i += 1) {
          const a = i * TAU / 6 + t * 0.32;
          const rx = x + Math.cos(a) * spread * 0.7;
          const ry = y + Math.sin(a) * spread * 0.7;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
      }, '#a5f3fc', smash ? 2.6 : 1.7);
      const count = low ? 4 : 6;
      for (let i = 0; i < count; i += 1) {
        const a = i * TAU / count + t * 0.32;
        const reach = spread * (0.72 + i % 2 * 0.26);
        drawCosmeticMark(ctx, 'ice', x + Math.cos(a) * reach, y + Math.sin(a) * reach, smash ? 8 : 6, a,
          i % 2 ? '#67e8f9' : '#ecfeff');
      }
      break;
    }
    case 'sakura': {
      const count = low ? 5 : smash ? 12 : 9;
      for (let i = 0; i < count; i += 1) {
        const angle = i * 2.4 + t * (smash ? 5.1 : 3.7);
        const reach = (5 + (i / count) * spread) * (0.7 + progress * 0.42);
        ctx.globalAlpha = fade * (0.72 + i % 2 * 0.28);
        drawCosmeticMark(ctx, 'petal', x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.86,
          (smash ? 7.5 : 6.2) - i % 3 * 0.8, angle + t * 2.8, i % 2 ? '#f472b6' : '#fbcfe8');
      }
      break;
    }
    case 'gold': {
      drawCosmeticMark(ctx, 'crown', x, y - 10 - spread * 0.22, (celebration ? 16 : smash ? 13 : 10) * (1 - t * 0.3), 0, '#fef3c7');
      const count = low ? 6 : smash || celebration ? 12 : 8;
      for (let i = 0; i < count; i += 1) {
        const a = i * TAU / count;
        const reach = spread * (i % 2 ? 1 : 0.8);
        if (!celebration) trace(() => {
          ctx.moveTo(x + Math.cos(a) * reach * 0.53, y + Math.sin(a) * reach * 0.51);
          ctx.lineTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach * 0.8);
        }, i % 2 ? '#fbbf24' : '#fef3c7', smash ? 2.3 : 1.5);
        drawCosmeticMark(ctx, celebration ? 'leaf' : 'star', x + Math.cos(a) * reach, y + Math.sin(a) * reach * 0.8,
          celebration ? 5.8 : smash ? 4.8 : 3, a + 0.5, i % 2 ? '#fbbf24' : '#fef3c7');
      }
      break;
    }
    case 'galaxy': {
      const expansion = t < 0.18 ? 1 - t / 0.18 : 1 - (1 - (t - 0.18) / 0.82) ** 3;
      const orbit = 8 + spread * expansion * (kind === 'win' ? 1.28 : 1);
      ctx.fillStyle = '#a855f738';
      ctx.beginPath();
      ctx.ellipse(x, y, orbit, orbit * 0.48, t * 0.66 - 0.32, 0, TAU);
      ctx.fill();
      arc(orbit, orbit * 0.48, t * 0.9 - 0.35, t * 3, t * 3 + TAU * 0.86, '#c084fc', 2.7);
      arc(orbit * 1.08, orbit * 0.45, 0.35 - t * 0.42, -t * 2.7, -t * 2.7 + TAU * 0.79, '#67e8f9', 2.1);
      if (!low && (smash || celebration)) arc(orbit * 1.17, orbit * 0.52, t * 0.35 - 0.1, -t * 3.2, -t * 3.2 + TAU * 0.73, '#f0abfc', 1.65);
      for (let i = 0; i < (low ? 5 : celebration ? 13 : smash ? 10 : 7); i += 1) {
        const angle = i * 2.4 + t * 5;
        const reach = orbit * (0.48 + i % 4 * 0.2);
        ctx.globalAlpha = fade * (0.72 + i % 2 * 0.28);
        drawCosmeticMark(ctx, 'star', x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.68,
          i % 3 ? 4 : 6.4, angle, i % 2 ? '#f5d0fe' : '#e0f2fe');
      }
      break;
    }
  }
  ctx.restore();
}

function drawResponse(
  ctx: CanvasRenderingContext2D, theme: Motif, center: CosmeticPoint, kind: EffectEvent,
  t: number, quality: EffectQuality, density: number, heading: number,
) {
  const { mark, rarity, colors } = theme;
  if ((kind === 'win' && rarity < 4) || (kind === 'score' && rarity < 3)) return;
  const smash = kind === 'smash';
  const strong = smash && rarity >= 2;
  const celebration = kind === 'score' || kind === 'win';
  const expand = 1 - (1 - t) ** 2;
  const opacity = (1 - t) ** 0.85;
  const scale = celebration ? 1.65 : strong ? 1.25 : 1;
  const count = Math.max(2, Math.round((3 + rarity * 2 + (strong || celebration ? 3 : 0)) * QUALITY_FACTOR[quality] * density));
  const radius = (10 + expand * (10 + rarity * 3)) * scale;
  ctx.save();

  if (mark === 'star') {
    // Brief convergence before the outward spiral.
    const spiral = t < 0.18 ? 1 - t / 0.18 : (t - 0.18) / 0.82;
    ctx.globalAlpha = opacity * 0.72;
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 1.6;
    for (let i = 0; i < (quality === 'low' ? 1 : 2); i += 1) {
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 6 + radius * spiral, 3 + radius * spiral * 0.35, i * 0.95 + t, t * 3, t * 3 + TAU * 0.8);
      ctx.stroke();
    }
    if (strong || celebration) {
      ctx.fillStyle = '#a855f726';
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 10 + radius * spiral, 4 + radius * spiral * 0.55, t * 1.5, 0, TAU);
      ctx.fill();
    }
  } else if (mark === 'hex') {
    ctx.globalAlpha = opacity * 0.86;
    drawCosmeticMark(ctx, 'hex', center.x, center.y, 7 + radius * 0.56, t * 0.6, colors[0]);
  } else if (mark === 'pulse') {
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = strong ? 2.7 : 1.7;
    ctx.globalAlpha = opacity * 0.8;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius, radius * 0.58, t * 0.45, Math.PI * 0.94, strong ? TAU * 1.44 : TAU * 0.99);
    ctx.stroke();
  }

  for (let i = 0; i < count; i += 1) {
    const angle = mark === 'rose' && smash
      ? heading + Math.PI + (i / Math.max(1, count - 1) - 0.5) * Math.PI * 0.9
      : (i / count) * TAU + (mark === 'star' ? t * (strong ? 4.5 : 1.8) : 0);
    const variation = 0.75 + (i % 3) * 0.13;
    const travel = mark === 'star' && t < 0.18 ? radius * (1 - t / 0.18) : radius * variation;
    const x = center.x + Math.cos(angle) * travel;
    const y = center.y + Math.sin(angle) * travel * 0.72;
    ctx.globalAlpha = opacity * (0.67 + (i % 2) * 0.24);
    drawCosmeticMark(ctx, mark, x, y, (3.5 + (i % 3) + scale) * (1 - t * 0.45), angle, colors[i % colors.length]);
  }
  ctx.restore();
}

function drawCourtResponse(
  ctx: CanvasRenderingContext2D, court: CosmeticCourt, style: Exclude<CourtStyle, 'classic'>,
  kind: EffectEvent, crossCourt: number, t: number, quality: EffectQuality,
) {
  const big = kind === 'score' || kind === 'win';
  const { x, y, width, height } = court;
  ctx.save();
  ctx.globalAlpha = (1 - t) * (big ? 0.88 : 0.38);
  ctx.lineWidth = big ? 2.2 : 1.4;
  if (style === 'neon') {
    ctx.strokeStyle = '#67e8f9';
    const scanY = y + height * t;
    ctx.beginPath();
    for (const side of [x - 4, x + width + 4]) {
      ctx.moveTo(side, scanY - 13);
      ctx.lineTo(side, scanY + 13);
      ctx.lineTo(side + (side < x ? 10 : -10), scanY + 19);
    }
    ctx.stroke();
    if (big) {
      ctx.globalAlpha *= 0.45;
      ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
    }
  } else if (style === 'ice') {
    const count = big ? Math.round(18 * QUALITY_FACTOR[quality]) : 4;
    for (let i = 0; i < count; i += 1) {
      const base = big ? i / count : (crossCourt + i * 0.13) % 1;
      const sideX = i % 2 ? x - 4 : x + width + 4;
      drawCosmeticMark(ctx, big ? 'ice' : 'snow', sideX, y + height * base, 3 + t * (big ? 7 : 3), i * 0.8, '#a5f3fc');
    }
  } else {
    const count = big ? Math.round(20 * QUALITY_FACTOR[quality]) : 4;
    ctx.strokeStyle = '#c4b5fd';
    for (let i = 0; i < count; i += 1) {
      const sweep = (i / count + t * 0.27) % 1;
      const side = i % 2 ? -1 : 1;
      const px = x + width * 0.5 + side * (width * 0.5 + 4 + t * 10);
      const py = y + height * sweep;
      drawCosmeticMark(ctx, 'star', px, py, 2.5 + (i % 3) * 1.6, t * 1.1, i % 2 ? '#c4b5fd' : '#f5d0fe');
    }
    if (big) {
      const reach = 7 + t * 22;
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2 + reach, height / 2 + reach * 0.7, 0, 0, TAU);
      ctx.stroke();
    }
    if (kind === 'win') {
      // Let the nebula unfurl along the rim, behind the result overlay.
      ctx.globalAlpha *= 0.42;
      ctx.lineWidth = 6 + t * 16;
      for (let i = 0; i < (quality === 'low' ? 1 : 3); i += 1) {
        ctx.strokeStyle = ['#7c3aed', '#a855f7', '#38bdf8'][i];
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width * (0.46 + t * 0.19 + i * 0.022), height * (0.46 + t * 0.13), i * 0.11 - 0.1, t * 2 + i, t * 2 + i + TAU * 0.72);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
