import type { RacketStyle, ShuttleStyle } from '../../types';

export interface GameCosmeticItem {
  id: string;
  category: 'racket' | 'shuttle';
  name: string;
  description: string;
  price: number;
  style: RacketStyle | ShuttleStyle;
  colors: readonly [string, string, string];
}

export const RACKET_ITEMS: readonly GameCosmeticItem[] = [
  {
    id: 'racket_default',
    category: 'racket',
    name: '經典球拍',
    description: '遊戲最初的水藍球拍',
    price: 0,
    style: 'classic',
    colors: ['#7dd3fc', '#7dd3fc', '#bae6fd']
  },
  {
    id: 'racket_emerald',
    category: 'racket',
    name: '翡翠球拍',
    description: '綠色柔光拍框',
    price: 2,
    style: 'emerald',
    colors: ['#34d399', '#064e3b', '#a7f3d0']
  },
  {
    id: 'racket_sunset',
    category: 'racket',
    name: '日落球拍',
    description: '日落粒子環繞',
    price: 5,
    style: 'sunset',
    colors: ['#fb7185', '#c2410c', '#fed7aa']
  },
  {
    id: 'racket_gold',
    category: 'racket',
    name: '冠軍金拍',
    description: '金色星芒與光環',
    price: 10,
    style: 'gold',
    colors: ['#fbbf24', '#92400e', '#fef3c7']
  }
] as const;

export const SHUTTLE_ITEMS: readonly GameCosmeticItem[] = [
  {
    id: 'shuttle_default',
    category: 'shuttle',
    name: '經典羽球',
    description: '遊戲最初的白色羽球',
    price: 0,
    style: 'classic',
    colors: ['#f8fafc', '#2dd4bf', '#f1f5f9']
  },
  {
    id: 'shuttle_sky',
    category: 'shuttle',
    name: '晴空羽球',
    description: '冰藍飛行殘影',
    price: 2,
    style: 'sky',
    colors: ['#bae6fd', '#0284c7', '#e0f2fe']
  },
  {
    id: 'shuttle_rose',
    category: 'shuttle',
    name: '玫瑰羽球',
    description: '粉紅花瓣光跡',
    price: 5,
    style: 'rose',
    colors: ['#fecdd3', '#e11d48', '#fff1f2']
  },
  {
    id: 'shuttle_neon',
    category: 'shuttle',
    name: '霓虹羽球',
    description: '霓虹電流光跡',
    price: 10,
    style: 'neon',
    colors: ['#d9f99d', '#a21caf', '#f7fee7']
  }
] as const;

export const RACKET_VISUALS: Record<RacketStyle, { frame: string; handle: string; fill: string; glow: string; effectLevel: 0 | 1 | 2 | 3 }> = {
  classic: { frame: '#7dd3fc', handle: '#7dd3fc', fill: 'rgba(125,211,252,0.08)', glow: 'rgba(125,211,252,0.5)', effectLevel: 0 },
  emerald: { frame: '#34d399', handle: '#064e3b', fill: 'rgba(52,211,153,0.18)', glow: 'rgba(52,211,153,0.7)', effectLevel: 1 },
  sunset: { frame: '#fb7185', handle: '#c2410c', fill: 'rgba(251,113,133,0.18)', glow: 'rgba(249,115,22,0.75)', effectLevel: 2 },
  gold: { frame: '#fbbf24', handle: '#92400e', fill: 'rgba(251,191,36,0.22)', glow: 'rgba(253,224,71,0.9)', effectLevel: 3 }
};

export const SHUTTLE_VISUALS: Record<ShuttleStyle, { feather: string; band: string; cork: string; stroke: string; glow: string; trailRgb: string; effectLevel: 0 | 1 | 2 | 3 }> = {
  classic: { feather: '#f8fafc', band: '#2dd4bf', cork: '#f1f5f9', stroke: '#94a3b8', glow: 'rgba(255,255,255,0.6)', trailRgb: '255,255,255', effectLevel: 0 },
  sky: { feather: '#bae6fd', band: '#0284c7', cork: '#e0f2fe', stroke: '#38bdf8', glow: 'rgba(56,189,248,0.9)', trailRgb: '56,189,248', effectLevel: 1 },
  rose: { feather: '#fecdd3', band: '#e11d48', cork: '#fff1f2', stroke: '#fb7185', glow: 'rgba(244,63,94,0.9)', trailRgb: '244,63,94', effectLevel: 2 },
  neon: { feather: '#d9f99d', band: '#a21caf', cork: '#f7fee7', stroke: '#bef264', glow: 'rgba(190,242,100,1)', trailRgb: '190,242,100', effectLevel: 3 }
};
