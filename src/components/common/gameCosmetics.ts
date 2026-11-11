import type { CourtStyle, GameLoadout, RacketStyle, ShuttleStyle, TrailStyle } from '../../types';

export const COSMETIC_CATEGORIES = [
  { id: 'racket', label: '球拍', field: 'racket_style' },
  { id: 'shuttle', label: '羽球', field: 'shuttle_style' },
  { id: 'court', label: '球場', field: 'court_style' },
  { id: 'trail', label: '軌跡', field: 'trail_style' },
] as const;

export type CosmeticCategory = typeof COSMETIC_CATEGORIES[number]['id'];

type CategoryStyle = {
  racket: RacketStyle;
  shuttle: ShuttleStyle;
  court: CourtStyle;
  trail: TrailStyle;
};

export interface GameCosmeticItem {
  id: string;
  category: CosmeticCategory;
  style: CategoryStyle[CosmeticCategory];
  name: string;
  price: number;
  rarity: CosmeticRarity;
  accent: string;
  artwork?: string;
}

export type CosmeticRarity = 0 | 1 | 2 | 3 | 4;

export const COSMETIC_RARITIES = ['經典', '精良', '稀有', '史詩', '傳說'] as const;

function getRarity(price: number): CosmeticRarity {
  if (price >= 12) return 4;
  if (price >= 9) return 3;
  if (price >= 6) return 2;
  return price > 0 ? 1 : 0;
}

function item<C extends CosmeticCategory>(
  category: C, style: CategoryStyle[C], name: string, price: number, accent: string, hasArtwork = true,
): GameCosmeticItem {
  const folders = { racket: 'rackets', shuttle: 'shuttles', court: 'courts', trail: 'trails' };
  return {
    id: `${category}_${style === 'classic' ? 'default' : style}`,
    category, style, name, price, accent, rarity: getRarity(price),
    artwork: hasArtwork ? `${folders[category]}/${style}.webp` : undefined,
  };
}

export const GAME_COSMETIC_ITEMS: readonly GameCosmeticItem[] = [
  item('racket', 'classic', '經典球拍', 0, '#7dd3fc', false),
  item('racket', 'emerald', '翡翠球拍', 2, '#34d399', false),
  item('racket', 'sunset', '日落球拍', 5, '#fb7185', false),
  item('racket', 'gold', '冠軍金拍', 10, '#fbbf24', false),
  item('racket', 'lightning', '雷電球拍', 6, '#60a5fa'),
  item('racket', 'flame', '火焰球拍', 8, '#fb923c'),
  item('racket', 'ice', '冰晶球拍', 8, '#a5f3fc'),
  item('racket', 'sakura', '櫻花球拍', 8, '#f9a8d4'),
  item('racket', 'galaxy', '星空球拍', 12, '#c4b5fd'),
  item('shuttle', 'classic', '經典羽球', 0, '#f8fafc'),
  item('shuttle', 'sky', '晴空羽球', 2, '#bae6fd', false),
  item('shuttle', 'rose', '玫瑰羽球', 5, '#fecdd3', false),
  item('shuttle', 'neon', '霓虹羽球', 10, '#d9f99d', false),
  item('shuttle', 'rainbow', '彩虹羽球', 8, '#f0abfc'),
  item('shuttle', 'meteor', '流星羽球', 7, '#fbbf24'),
  item('shuttle', 'frost', '冰霜羽球', 7, '#bae6fd'),
  item('shuttle', 'mechanical', '機械羽球', 10, '#67e8f9'),
  item('court', 'classic', '經典綠茵', 0, '#34d399'),
  item('court', 'neon', '霓虹科技', 10, '#a78bfa'),
  item('court', 'ice', '冰雪球場', 10, '#7dd3fc'),
  item('court', 'space', '宇宙星空', 14, '#c4b5fd'),
  item('trail', 'classic', '經典白光', 0, '#f8fafc', false),
  item('trail', 'wind', '疾風藍光', 4, '#38bdf8'),
  item('trail', 'flame', '烈焰軌跡', 6, '#fb923c'),
  item('trail', 'lightning', '電流軌跡', 7, '#67e8f9'),
  item('trail', 'rainbow', '彩虹軌跡', 8, '#f0abfc'),
  item('trail', 'galaxy', '星空軌跡', 9, '#c4b5fd'),
];

export function getEquippedStyle(category: CosmeticCategory, loadout?: GameLoadout) {
  const { field } = COSMETIC_CATEGORIES.find(({ id }) => id === category)!;
  return loadout?.[field] ?? 'classic';
}

interface RacketVisual {
  frame: string;
  handle: string;
  fill: string;
  glow: string;
}

export const RACKET_VISUALS: Record<RacketStyle, RacketVisual> = {
  classic: { frame: '#7dd3fc', handle: '#7dd3fc', fill: 'rgba(125,211,252,0.08)', glow: 'rgba(125,211,252,0.5)' },
  emerald: { frame: '#34d399', handle: '#064e3b', fill: 'rgba(52,211,153,0.18)', glow: 'rgba(52,211,153,0.7)' },
  sunset: { frame: '#fb7185', handle: '#c2410c', fill: 'rgba(251,113,133,0.18)', glow: 'rgba(249,115,22,0.75)' },
  gold: { frame: '#fbbf24', handle: '#92400e', fill: 'rgba(251,191,36,0.22)', glow: 'rgba(253,224,71,0.9)' },
  lightning: { frame: '#60a5fa', handle: '#2563eb', fill: '#60a5fa26', glow: '#60a5fab3' },
  flame: { frame: '#fb923c', handle: '#ea580c', fill: '#fb923c26', glow: '#f97316b3' },
  ice: { frame: '#a5f3fc', handle: '#0891b2', fill: '#a5f3fc26', glow: '#a5f3fc99' },
  sakura: { frame: '#f9a8d4', handle: '#db2777', fill: '#f9a8d426', glow: '#f9a8d499' },
  galaxy: { frame: '#c4b5fd', handle: '#7c3aed', fill: '#c4b5fd26', glow: '#a78bfab3' },
};

interface ShuttleVisual {
  feather: string;
  band: string;
  cork: string;
  stroke: string;
  glow: string;
  effectLevel: 0 | 1 | 2 | 3 | 4;
  featherGradient?: readonly string[];
  core?: string;
}

export const SHUTTLE_VISUALS: Record<ShuttleStyle, ShuttleVisual> = {
  classic: { feather: '#f8fafc', band: '#2dd4bf', cork: '#f1f5f9', stroke: '#94a3b8', glow: '#ffffff99', effectLevel: 0 },
  sky: { feather: '#bae6fd', band: '#0284c7', cork: '#e0f2fe', stroke: '#38bdf8', glow: '#38bdf8e6', effectLevel: 1 },
  rose: { feather: '#fecdd3', band: '#e11d48', cork: '#fff1f2', stroke: '#fb7185', glow: '#f43f5ee6', effectLevel: 2 },
  neon: { feather: '#d9f99d', band: '#a21caf', cork: '#f7fee7', stroke: '#bef264', glow: '#bef264', effectLevel: 4 },
  rainbow: { feather: '#f8fafc', band: '#8b5cf6', cork: '#f8fafc', stroke: '#e0e7ff', glow: '#f0abfc99', effectLevel: 3, featherGradient: ['#fb7185', '#fde047', '#86efac', '#7dd3fc', '#c4b5fd'] },
  meteor: { feather: '#fbbf24', band: '#ea580c', cork: '#fff7d6', stroke: '#fde68a', glow: '#fb923caa', effectLevel: 2, featherGradient: ['#fff7d6', '#fbbf24', '#f97316'] },
  frost: { feather: '#bae6fd', band: '#2563eb', cork: '#ecfeff', stroke: '#67e8f9', glow: '#67e8f999', effectLevel: 2, featherGradient: ['#eff6ff', '#7dd3fc'] },
  mechanical: { feather: '#94a3b8', band: '#155e75', cork: '#e2e8f0', stroke: '#cbd5e1', glow: '#22d3eeaa', effectLevel: 4, featherGradient: ['#f1f5f9', '#64748b', '#cbd5e1'], core: '#67e8f9' },
};

export const COURT_VISUALS = {
  classic: { surround: '#07131f', colors: ['#10b981', '#059669', '#0f766e'], line: 'rgba(255,255,255,0.58)', net: 'rgba(15,23,42,0.72)' },
  neon: { surround: '#080d23', colors: ['#222264', '#141a49', '#36215e'], line: '#a5e7ffcc', net: '#a78bfacc' },
  ice: { surround: '#0a2037', colors: ['#266d99', '#174a76', '#235f83'], line: '#effaffdc', net: '#bceeffbb' },
  space: { surround: '#090b20', colors: ['#292452', '#151634', '#321c57'], line: '#e5ddffbf', net: '#a5b4fcc2' },
} satisfies Record<CourtStyle, { surround: string; colors: string[]; line: string; net: string }>;
