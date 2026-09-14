import React from 'react';
import { Gamepad2, ShieldCheck, Target, Trophy, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface AdminGameStatsModalProps {
  onClose: () => void;
}

export const AdminGameStatsModal: React.FC<AdminGameStatsModalProps> = ({ onClose }) => {
  const { gameResults, profiles } = useAppStore();

  const playerStats = profiles
    .map((profile) => {
      const results = gameResults.filter((result) => result.user_id === profile.id);
      const wins = results.filter((result) => result.result === 'win').length;
      const losses = results.filter((result) => result.result === 'loss').length;
      return {
        profile,
        games: results.length,
        wins,
        losses,
        winRate: results.length > 0 ? Math.round((wins / results.length) * 100) : 0,
        lastPlayedAt: results[0]?.played_at
      };
    })
    .filter((stats) => stats.games > 0)
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.profile.name.localeCompare(b.profile.name, 'zh-Hant'));

  const totalGames = gameResults.length;
  const totalWins = gameResults.filter((result) => result.result === 'win').length;
  const totalLosses = totalGames - totalWins;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-2.5 backdrop-blur-xs sm:p-5" role="dialog" aria-modal="true" aria-label="羽球遊戲戰績">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <Gamepad2 className="h-4 w-4" />
              <span>羽球電腦對戰</span>
            </div>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">遊戲戰績</h2>
            <p className="mt-1 text-xs text-slate-500">只統計打到 3 分並完成的對戰，中途退出不計。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="關閉遊戲戰績">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label="完成場次" value={totalGames} suffix="場" icon={<Target className="h-4 w-4" />} />
            <StatCard label="遊玩人數" value={playerStats.length} suffix="人" icon={<Gamepad2 className="h-4 w-4" />} />
            <StatCard label="玩家獲勝" value={totalWins} suffix="場" icon={<Trophy className="h-4 w-4" />} tone="win" />
            <StatCard label="電腦獲勝" value={totalLosses} suffix="場" icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          {playerStats.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <Gamepad2 className="mx-auto h-8 w-8 text-slate-300" />
              <div className="mt-3 text-sm font-bold text-slate-700">還沒有完成的對戰</div>
              <p className="mt-1 text-xs text-slate-400">隊員打完一場後，這裡會自動顯示勝負統計。</p>
            </div>
          ) : (
            <>
              <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">隊員</th>
                      <th className="px-4 py-3 text-center">遊玩</th>
                      <th className="px-4 py-3 text-center">勝</th>
                      <th className="px-4 py-3 text-center">敗</th>
                      <th className="px-4 py-3 text-center">勝率</th>
                      <th className="px-4 py-3 text-right">最後遊玩</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {playerStats.map((stats) => (
                      <tr key={stats.profile.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{stats.profile.name}</td>
                        <td className="px-4 py-3 text-center font-black text-slate-900">{stats.games}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">{stats.wins}</td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600">{stats.losses}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{stats.winRate}%</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{formatPlayedAt(stats.lastPlayedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2.5 sm:hidden">
                {playerStats.map((stats) => (
                  <article key={stats.profile.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">{stats.profile.name}</h3>
                        <p className="mt-1 text-[11px] text-slate-400">最後遊玩 {formatPlayedAt(stats.lastPlayedAt)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-3 py-2 text-center text-white">
                        <div className="text-lg font-black leading-none">{stats.games}</div>
                        <div className="mt-1 text-[9px] font-bold">遊玩次數</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                      <ResultMetric label="勝" value={stats.wins} className="text-emerald-700" />
                      <ResultMetric label="敗" value={stats.losses} className="text-rose-600" />
                      <ResultMetric label="勝率" value={`${stats.winRate}%`} className="text-slate-800" />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  tone?: 'win';
}> = ({ label, value, suffix, icon, tone }) => (
  <div className={`rounded-2xl border p-3.5 ${tone === 'win' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${tone === 'win' ? 'text-emerald-700' : 'text-slate-500'}`}>
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-2 flex items-baseline gap-1 text-slate-900">
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold">{suffix}</span>
    </div>
  </div>
);

const ResultMetric: React.FC<{ label: string; value: number | string; className: string }> = ({ label, value, className }) => (
  <div>
    <div className={`text-lg font-black ${className}`}>{value}</div>
    <div className="mt-0.5 text-[10px] font-bold text-slate-400">{label}</div>
  </div>
);

const formatPlayedAt = (playedAt?: string) => {
  if (!playedAt) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(playedAt));
};
