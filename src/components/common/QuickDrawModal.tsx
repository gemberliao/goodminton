import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Dices, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Profile, UserLevel } from '../../types';

type DrawStage = 'idle' | 'shuffling' | 'revealed';

interface DrawResult {
  teamA: [Profile, Profile];
  teamB: [Profile, Profile];
}

interface QuickDrawModalProps {
  profiles: Profile[];
  onClose: () => void;
}

const LEVEL_SCORE: Record<UserLevel, number> = {
  新手: 1,
  初級: 2,
  中級: 3,
  高階: 4,
  '校隊/教練': 5,
};

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createBalancedMatch(players: Profile[]): DrawResult {
  const picked = shuffled(players).slice(0, 4) as [Profile, Profile, Profile, Profile];
  const options: DrawResult[] = [
    { teamA: [picked[0], picked[1]], teamB: [picked[2], picked[3]] },
    { teamA: [picked[0], picked[2]], teamB: [picked[1], picked[3]] },
    { teamA: [picked[0], picked[3]], teamB: [picked[1], picked[2]] },
  ];

  const score = (team: [Profile, Profile]) => team.reduce((sum, player) => sum + LEVEL_SCORE[player.level], 0);
  const smallestGap = Math.min(...options.map((option) => Math.abs(score(option.teamA) - score(option.teamB))));
  return shuffled(options.filter((option) => Math.abs(score(option.teamA) - score(option.teamB)) === smallestGap))[0];
}

export const QuickDrawModal: React.FC<QuickDrawModalProps> = ({ profiles, onClose }) => {
  const eligibleProfiles = useMemo(
    () => profiles.filter((profile) => profile.status === 'approved' || !profile.status),
    [profiles]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => eligibleProfiles.map((profile) => profile.id));
  const [stage, setStage] = useState<DrawStage>('idle');
  const [previewPlayers, setPreviewPlayers] = useState<Profile[]>([]);
  const [result, setResult] = useState<DrawResult | null>(null);
  const runIdRef = useRef(0);

  const selectedProfiles = useMemo(
    () => eligibleProfiles.filter((profile) => selectedIds.includes(profile.id)),
    [eligibleProfiles, selectedIds]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      runIdRef.current += 1;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const togglePlayer = (profileId: string) => {
    if (stage === 'shuffling') return;
    setSelectedIds((current) => current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId]);
    setResult(null);
    setStage('idle');
  };

  const runDraw = async () => {
    if (selectedProfiles.length < 4 || stage === 'shuffling') return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setResult(null);
    setStage('shuffling');

    for (let frame = 0; frame < 12; frame += 1) {
      if (runIdRef.current !== runId) return;
      setPreviewPlayers(shuffled(selectedProfiles).slice(0, 4));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 75 + frame * 5));
    }

    if (runIdRef.current !== runId) return;
    const nextResult = createBalancedMatch(selectedProfiles);
    setPreviewPlayers([...nextResult.teamA, ...nextResult.teamB]);
    setResult(nextResult);
    setStage('revealed');
  };

  const displayedPlayers = result
    ? [...result.teamA, ...result.teamB]
    : previewPlayers;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="quick-draw-title">
      <div className="quick-draw-modal max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-black tracking-[0.22em]">SMASH DRAW</span>
            </div>
            <h2 id="quick-draw-title" className="mt-1 text-xl font-black sm:text-2xl">即時雙打抽籤球場</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-white/5 p-2.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="關閉雙打抽籤">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-6 p-4 sm:p-7 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white">選擇本場候選隊員</h3>
                <span className={`text-xs font-bold ${selectedProfiles.length >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  已選 {selectedProfiles.length} 人
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">每次抽出 4 人，並依程度自動尋找差距最小的分隊組合。</p>
            </div>

            <div className="flex gap-2">
              <button type="button" disabled={stage === 'shuffling'} onClick={() => { setSelectedIds(eligibleProfiles.map((profile) => profile.id)); setResult(null); setStage('idle'); }} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40">全選</button>
              <button type="button" disabled={stage === 'shuffling'} onClick={() => { setSelectedIds([]); setResult(null); setStage('idle'); }} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40">清除</button>
            </div>

            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2">
              {eligibleProfiles.map((profile) => {
                const selected = selectedIds.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={stage === 'shuffling'}
                    onClick={() => togglePlayer(profile.id)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-all disabled:cursor-wait ${selected ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selected ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
                      {selected ? <Check className="h-4 w-4" /> : profile.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-white">{profile.name}</span>
                      <span className="block truncate text-[10px] text-slate-400">{profile.level}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={selectedProfiles.length < 4 || stage === 'shuffling'}
              onClick={() => void runDraw()}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.2)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {stage === 'shuffling' ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Dices className="h-5 w-5 transition-transform group-hover:rotate-12" />}
              <span>{stage === 'shuffling' ? '高速洗牌中…' : result ? '再抽一場' : '開始抽籤'}</span>
            </button>
            {selectedProfiles.length < 4 && <p className="text-center text-xs font-semibold text-amber-400">至少選擇 4 位隊員才能開始。</p>}
          </section>

          <section className="space-y-3">
            <div className="relative aspect-[1.28/1] min-h-[330px] overflow-hidden rounded-[1.75rem] border-4 border-emerald-200/80 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 shadow-[inset_0_0_55px_rgba(0,0,0,0.22),0_0_45px_rgba(16,185,129,0.15)]">
              <div aria-hidden="true" className="absolute inset-[5%] border-2 border-white/65" />
              <div aria-hidden="true" className="absolute inset-y-[5%] left-1/2 w-1 -translate-x-1/2 bg-slate-900/65 shadow-[0_0_8px_rgba(15,23,42,0.7)]" />
              <div aria-hidden="true" className="absolute inset-y-[5%] left-1/4 w-px bg-white/55" />
              <div aria-hidden="true" className="absolute inset-y-[5%] right-1/4 w-px bg-white/55" />
              <div aria-hidden="true" className="absolute inset-x-[5%] top-1/2 h-px bg-white/55" />

              <div className="absolute left-[4%] top-3 rounded-lg bg-sky-500/90 px-2.5 py-1 text-[10px] font-black tracking-wider shadow-lg">藍隊</div>
              <div className="absolute right-[4%] top-3 rounded-lg bg-rose-500/90 px-2.5 py-1 text-[10px] font-black tracking-wider shadow-lg">紅隊</div>

              {[0, 1, 2, 3].map((position) => {
                const player = displayedPlayers[position];
                const isLeft = position < 2;
                const isTop = position % 2 === 0;
                return (
                  <div
                    key={position}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 text-center ${isLeft ? 'left-[25%]' : 'left-[75%]'} ${isTop ? 'top-[33%]' : 'top-[69%]'} ${stage === 'shuffling' ? 'quick-draw-shuffling' : result ? 'quick-draw-reveal' : ''}`}
                    style={{ animationDelay: `${position * 80}ms` }}
                  >
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white text-base font-black text-white shadow-xl sm:h-14 sm:w-14 ${isLeft ? 'bg-sky-500' : 'bg-rose-500'} ${!player ? 'opacity-40' : ''}`}>
                      {player ? player.name.slice(0, 1) : '?'}
                    </div>
                    <div className="mt-1.5 max-w-24 truncate rounded-lg bg-slate-950/75 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      {player?.name || '等待抽籤'}
                    </div>
                    {player && <div className="mt-1 text-[10px] font-semibold text-emerald-50/90">{player.level}</div>}
                  </div>
                );
              })}

              <div className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-[11px] font-black text-white shadow-2xl">VS</div>
              {stage === 'idle' && !result && (
                <div className="absolute inset-x-0 bottom-5 text-center text-xs font-bold text-emerald-50/80">選好隊員，讓球場決定下一場對戰</div>
              )}
            </div>
            <p className="text-center text-[11px] text-slate-500">本次結果僅顯示於目前畫面，關閉後即清除。</p>
          </section>
        </div>
      </div>
    </div>
  );
};
