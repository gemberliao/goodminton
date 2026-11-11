import { ArrowLeft, Gamepad2, Play } from 'lucide-react';
import { COSMETIC_RARITIES, hasVictoryEffect, type GameCosmeticItem } from './gameCosmetics';
import { TRIAL_STAGES, type TrialMode, type TrialStage } from './gameCosmeticEvents';

interface TryoutProps {
  item: GameCosmeticItem;
  mode: TrialMode;
  stage: TrialStage;
  onMode: (mode: TrialMode) => void;
  onBack: () => void;
}

const modeClass = (active: boolean) =>
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 '
  + (active ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800');

export function GameCosmeticTryout({ item, mode, stage, onMode, onBack }: TryoutProps) {
  const stages = TRIAL_STAGES.filter(entry => entry.id !== 'win' || hasVictoryEffect(item));
  return (
    <header aria-label="造型動態試用" className="shrink-0 border-b border-white/10 bg-slate-950 px-3 py-2">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="返回裝備商店"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-slate-900 text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-300">動態試用・{COSMETIC_RARITIES[item.rarity]}</p>
            <h2 className="truncate text-base font-black text-white">{item.name}</h2>
          </div>
        </div>
        <div role="group" aria-label="試用階段" className={'mt-2 grid gap-1 ' + (stages.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
          {stages.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => onMode(id)} aria-pressed={mode === id}
              className={modeClass(mode === id || (mode === 'auto' && stage === id))}>{label}</button>
          ))}
        </div>
        <div className={'mt-1.5 grid gap-1 ' + (item.category === 'trail' ? 'grid-cols-3' : 'grid-cols-2')}>
          {item.category === 'trail' && (
            <button type="button" onClick={() => onMode('timing')} aria-pressed={mode === 'timing'} className={modeClass(mode === 'timing')}>
              時機圖形
            </button>
          )}
          <button type="button" onClick={() => onMode('auto')} aria-pressed={mode === 'auto'} className={modeClass(mode === 'auto')}>
            <Play aria-hidden="true" className="size-3.5" />自動展示
          </button>
          <button type="button" onClick={() => onMode('free')} aria-pressed={mode === 'free'} className={modeClass(mode === 'free')}>
            <Gamepad2 aria-hidden="true" className="size-3.5" />自由試玩
          </button>
        </div>
      </div>
    </header>
  );
}
