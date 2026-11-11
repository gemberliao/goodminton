import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Dices, RotateCcw, Search, Sparkles, X } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [stage, setStage] = useState<DrawStage>('idle');
  const [previewPlayers, setPreviewPlayers] = useState<Profile[]>([]);
  const [result, setResult] = useState<DrawResult | null>(null);
  const runIdRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const courtRef = useRef<HTMLDivElement>(null);
  const query = searchTerm.trim().toLowerCase();
  const visibleProfiles = eligibleProfiles.filter((profile) => profile.name.toLowerCase().includes(query));

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

    const content = contentRef.current;
    const court = courtRef.current;
    if (content && court) {
      const contentBounds = content.getBoundingClientRect();
      const courtBounds = court.getBoundingClientRect();
      if (courtBounds.bottom > contentBounds.bottom || courtBounds.top < contentBounds.top) {
        content.scrollBy({ top: courtBounds.top - contentBounds.top - 12 });
      }
    }

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
    : stage === 'shuffling' ? previewPlayers : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="quick-draw-title">
      <div className="quick-draw-modal flex max-h-full w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl sm:rounded-[2rem]">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-7 sm:py-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-black tracking-[0.22em]">SMASH DRAW</span>
            </div>
            <h2 id="quick-draw-title" className="mt-1 text-xl font-black sm:text-2xl">即時雙打抽籤球場</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="關閉雙打抽籤">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={contentRef} className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-1 gap-5 p-3 sm:p-7 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
            <section className="min-w-0 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">選擇本場候選隊員</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">每次抽出 4 人，並依程度自動尋找差距最小的分隊組合。</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="relative min-w-32 flex-1">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    aria-label="搜尋隊員姓名"
                    placeholder="搜尋隊員姓名"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-2 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:text-sm"
                  />
                </label>
                <button type="button" disabled={stage === 'shuffling'} onClick={() => { setSelectedIds(eligibleProfiles.map((profile) => profile.id)); setResult(null); setStage('idle'); }} className="min-h-11 rounded-xl bg-white/5 px-3 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40">全選</button>
                <button type="button" disabled={stage === 'shuffling'} onClick={() => { setSelectedIds([]); setResult(null); setStage('idle'); }} className="min-h-11 rounded-xl bg-white/5 px-3 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40">清除</button>
              </div>

              {visibleProfiles.length === 0 && (
                <p className="rounded-xl border border-white/10 p-3 text-sm text-slate-400" role="status">
                  {eligibleProfiles.length === 0 ? '目前沒有可抽籤的隊員。' : '找不到符合姓名的隊員。'}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:max-h-72 lg:grid-cols-2 lg:overflow-y-auto lg:pr-1">
                {visibleProfiles.map((profile) => {
                  const selected = selectedIds.includes(profile.id);
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={stage === 'shuffling'}
                      onClick={() => togglePlayer(profile.id)}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-all disabled:cursor-wait ${selected ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selected ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
                        {selected ? <Check className="h-4 w-4" /> : profile.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-xs font-bold text-white">{profile.name}</span>
                        <span className="block text-[10px] text-slate-400">{profile.level}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0 space-y-3">
              <div ref={courtRef} className="relative aspect-[1.28/1] min-h-60 w-full overflow-hidden rounded-[1.75rem] border-4 border-emerald-200/80 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 shadow-[inset_0_0_55px_rgba(0,0,0,0.22),0_0_45px_rgba(16,185,129,0.15)] sm:min-h-[330px]">
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
                      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border-4 border-white text-sm font-black text-white shadow-xl sm:h-14 sm:w-14 sm:text-base ${isLeft ? 'bg-sky-500' : 'bg-rose-500'} ${!player ? 'opacity-40' : ''}`}>
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
                  <div className="absolute inset-x-2 bottom-3 text-center text-xs font-bold text-emerald-50/80 sm:bottom-5">選好隊員，讓球場決定下一場對戰</div>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-500">本次結果僅顯示於目前畫面，關閉後即清除。</p>
              {result && (
                <button
                  type="button"
                  onClick={() => contentRef.current?.scrollTo({ top: 0 })}
                  className="min-h-11 w-full rounded-xl border border-white/10 px-3 text-sm font-bold text-slate-200 lg:hidden"
                >
                  回到隊員名單
                </button>
              )}
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/10 px-3 py-2.5 sm:px-7 sm:py-3">
          <div role="status" className={`text-xs font-bold ${selectedProfiles.length >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
            已選 {selectedProfiles.length} 人
            {selectedProfiles.length < 4 && <span className="block text-[11px]">至少選 4 位</span>}
          </div>
          <button
            type="button"
            disabled={selectedProfiles.length < 4 || stage === 'shuffling'}
            onClick={() => void runDraw()}
            className="group flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 px-3 py-2.5 text-sm font-black text-slate-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-8"
          >
            {stage === 'shuffling' ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Dices className="h-5 w-5 transition-transform group-hover:rotate-12" />}
            <span>{stage === 'shuffling' ? '高速洗牌中…' : result ? '再抽一場' : '開始抽籤'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
