import React, { useState, useEffect } from 'react';
import { BadmintonEvent, MatchDiscipline, MatchPointSlot, Profile } from '../../types';
import { generateUUID, useAppStore } from '../../store/useAppStore';
import { 
  X, 
  Trophy, 
  Sparkles, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Share2, 
  Send, 
  ShieldCheck, 
  Flame, 
  Eye, 
  HeartHandshake, 
  UserCheck, 
  Info,
  ChevronDown,
  History
} from 'lucide-react';
import { isEventPast } from '../../utils/dateUtils';

interface AdminMatchLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: BadmintonEvent;
}

const POINT_DEFS: { index: number; name: string; discipline: MatchDiscipline; count: number; desc: string }[] = [
  { index: 1, name: '第 1 點 男單 (MS)', discipline: '男單', count: 1, desc: '男子單打 (1人)' },
  { index: 2, name: '第 2 點 女單 (WS)', discipline: '女單', count: 1, desc: '女子單打 (1人)' },
  { index: 3, name: '第 3 點 男雙 (MD)', discipline: '男雙', count: 2, desc: '男子雙打 (2人)' },
  { index: 4, name: '第 4 點 女雙 (WD)', discipline: '女雙', count: 2, desc: '女子雙打 (2人)' },
  { index: 5, name: '第 5 點 混雙 (XD)', discipline: '混雙', count: 2, desc: '混合雙打 (2人 - 建議男女搭檔)' },
];

export const AdminMatchLineupModal: React.FC<AdminMatchLineupModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const { 
    profiles, 
    attendance, 
    matchSurveys, 
    matchLineupSlots, 
    matchLineupConfigs, 
    saveMatchLineup, 
    autoGenerateFairLineup,
    getMemberMatchStats
  } = useAppStore();

  const [slots, setSlots] = useState<MatchPointSlot[]>([]);
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'lineup' | 'surveys' | 'stats'>('lineup');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const isPast = isEventPast(event);

  // Initialize slots
  useEffect(() => {
    if (isOpen) {
      const existingSlots = matchLineupSlots.filter(s => s.event_id === event.id);
      const existingConfig = matchLineupConfigs[event.id];

      if (existingSlots.length > 0) {
        setSlots(existingSlots.sort((a, b) => a.point_index - b.point_index));
        setIsPublished(existingConfig?.is_published ?? true);
        setNotes(existingConfig?.notes || '');
      } else {
        // Generate default 5 slots
        const defaultSlots: MatchPointSlot[] = POINT_DEFS.map(pd => ({
          id: generateUUID(),
          event_id: event.id,
          point_index: pd.index,
          point_name: pd.name,
          discipline: pd.discipline,
          player_ids: [],
          opponent_info: '',
          score: ''
        }));
        setSlots(defaultSlots);
        setIsPublished(true);
        setNotes('請全體隊員提早 20 分鐘抵達熱身！');
      }
      setSaveSuccessMsg(null);
    }
  }, [isOpen, event.id]);

  if (!isOpen) return null;

  // Attending members
  const attendingUserIds = attendance
    .filter(a => a.event_id === event.id && a.status === 'attending')
    .map(a => a.user_id);

  const eligibleProfiles = profiles
    .filter(p => p.status === 'approved' || !p.status)
    .filter((p, idx, arr) => arr.findIndex(item => item.id === p.id) === idx);

  // Survey lookup
  const eventSurveys = matchSurveys
    .filter(s => s.event_id === event.id)
    .filter((s, idx, arr) => arr.findIndex(item => item.id === s.id) === idx);
  const surveyMap = new Map(eventSurveys.map(s => [s.user_id, s]));

  // Calculate current slot assignments count per player in this editor state
  const currentAssignedCounts: Record<string, number> = {};
  slots.forEach(slot => {
    slot.player_ids.forEach(pid => {
      currentAssignedCounts[pid] = (currentAssignedCounts[pid] || 0) + 1;
    });
  });

  // Helper to sort candidate profiles for a given discipline with 0-match (unplayed) prioritized at top
  const getSortedCandidateProfiles = (discipline: MatchDiscipline) => {
    return [...eligibleProfiles].sort((a, b) => {
      const statsA = getMemberMatchStats(a.id, event.id);
      const statsB = getMemberMatchStats(b.id, event.id);

      // 1. Primary: Unplayed first / lowest historical match count ascending (0, 1, 2...)
      if (statsA.historicalPlayedCount !== statsB.historicalPlayedCount) {
        return statsA.historicalPlayedCount - statsB.historicalPlayedCount;
      }

      // 2. Secondary: Assigned count in current match editor ascending (0 points > 1 point > 2 points)
      const assignedA = currentAssignedCounts[a.id] || 0;
      const assignedB = currentAssignedCounts[b.id] || 0;
      if (assignedA !== assignedB) {
        return assignedA - assignedB;
      }

      // 3. Tertiary: RSVP attendance status (attending first)
      const isAttendingA = attendingUserIds.includes(a.id) ? 1 : 0;
      const isAttendingB = attendingUserIds.includes(b.id) ? 1 : 0;
      if (isAttendingA !== isAttendingB) {
        return isAttendingB - isAttendingA;
      }

      // 4. Quaternary: Match discipline preference
      const surveyA = surveyMap.get(a.id);
      const surveyB = surveyMap.get(b.id);
      const wantsA = surveyA?.preferred_disciplines.includes(discipline) ? 1 : 0;
      const wantsB = surveyB?.preferred_disciplines.includes(discipline) ? 1 : 0;
      if (wantsA !== wantsB) {
        return wantsB - wantsA;
      }

      // 5. Name alphabetical
      return a.name.localeCompare(b.name, 'zh-Hant');
    });
  };

  const statsProfiles = [...eligibleProfiles].sort((a, b) => {
    const statsA = getMemberMatchStats(a.id, event.id);
    const statsB = getMemberMatchStats(b.id, event.id);
    if (statsA.historicalPlayedCount !== statsB.historicalPlayedCount) {
      return statsA.historicalPlayedCount - statsB.historicalPlayedCount;
    }
    const assignedA = currentAssignedCounts[a.id] || 0;
    const assignedB = currentAssignedCounts[b.id] || 0;
    if (assignedA !== assignedB) return assignedA - assignedB;
    const isAttA = attendingUserIds.includes(a.id) ? 1 : 0;
    const isAttB = attendingUserIds.includes(b.id) ? 1 : 0;
    if (isAttA !== isAttB) return isAttB - isAttA;
    return a.name.localeCompare(b.name, 'zh-Hant');
  });

  // Handler to update player inside a slot
  const handleSetPlayer = (slotIndex: number, playerIndex: number, newUserId: string) => {
    setSlots(prev => {
      const next = [...prev];
      const targetSlot = { ...next[slotIndex] };
      const newPlayerIds = [...targetSlot.player_ids];

      if (!newUserId) {
        // Remove player at playerIndex
        newPlayerIds.splice(playerIndex, 1);
      } else {
        // Replace or add
        if (playerIndex < newPlayerIds.length) {
          newPlayerIds[playerIndex] = newUserId;
        } else {
          newPlayerIds.push(newUserId);
        }
      }

      targetSlot.player_ids = newPlayerIds;
      next[slotIndex] = targetSlot;
      return next;
    });
  };

  const handleUpdateOpponent = (slotIndex: number, val: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], opponent_info: val };
      return next;
    });
  };

  const handleUpdateScore = (slotIndex: number, val: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], score: val };
      return next;
    });
  };

  // Trigger Smart Fair Rotation Engine
  const handleAutoGenerate = () => {
    const generated = autoGenerateFairLineup(event.id);
    if (generated && generated.length > 0) {
      setSlots(generated);
      setSaveSuccessMsg('已套用「一人一點不兼點・填寫意願優先」演算法智慧排定名單！');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
  };

  // Clear Lineup
  const handleClearSlots = () => {
    setSlots(prev => prev.map(s => ({ ...s, player_ids: [] })));
  };

  // Save Lineup
  const handleSave = async (publishState = isPublished) => {
    const result = await saveMatchLineup(event.id, slots, publishState, notes);
    if (!result.success) return;
    setSaveSuccessMsg(publishState ? '出賽排點已發布！隊員可即時在前台查看。' : '出賽排點草稿已儲存！');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl sm:rounded-[28px] max-w-4xl w-full p-4 sm:p-7 shadow-2xl relative my-auto max-h-[94vh] sm:max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          title="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="shrink-0 mb-3 sm:mb-4 pr-8 sm:pr-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 ">
              比賽排點管理
            </span>
            <span className="text-xs text-slate-500 font-medium">5 點團體賽制</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight line-clamp-1">
            {event.title}
          </h2>
          {isPast && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>此比賽已結束，管理員仍可查看、修改並重新發布排點名單。</span>
            </div>
          )}
        </div>

        {/* Tab Navigation & Auto Fair Engine Action Bar */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            <button
              onClick={() => setActiveTab('lineup')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'lineup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5 點出賽排單
            </button>
            <button
              onClick={() => setActiveTab('surveys')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'surveys'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>隊員意願</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[11px] font-bold">
                {eventSurveys.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              出賽統計
            </button>
          </div>

          {/* Quick Smart Actions */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleAutoGenerate}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="自動執行「一人一點不兼點」與「意願項目最優先」，未出賽者優先安排"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>智慧自動排單</span>
            </button>

            <button
              type="button"
              onClick={handleClearSlots}
              className="px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
              title="清空目前排定名單"
            >
              清空
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="shrink-0 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 flex items-center space-x-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

          {/* TAB 1: 5 Points Lineup Board */}
          {activeTab === 'lineup' && (
            <div className="space-y-4">
              
              {/* Guidance Tips */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start space-x-3 text-sm text-slate-600">
                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">排點防呆與提醒：</span>
                  系統會即時檢測隊員意願與重複出賽次數。若隊員已被排入多點或超過其自選上限，將以
                  <span className="text-slate-900 font-bold"> 提示標籤</span> 提醒，避免同一人連打過多點數。
                </div>
              </div>

              {/* 5 Slot Cards */}
              <div className="space-y-4">
                {slots.map((slot, sIdx) => {
                  const pointDef = POINT_DEFS.find(p => p.index === slot.point_index) || POINT_DEFS[sIdx];
                  const requiredCount = pointDef?.count || 1;

                  return (
                    <div
                      key={slot.id || `slot-${sIdx}`}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all"
                    >
                      {/* Slot Header */}
                      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <span className="text-base sm:text-lg font-bold text-slate-900">
                            {slot.point_name}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-500 font-normal">
                            {pointDef?.desc}
                          </span>
                        </div>
                      </div>

                      {/* Player Selectors for this slot */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {Array.from({ length: requiredCount }).map((_, pIdx) => {
                          const currentUserId = slot.player_ids[pIdx] || '';
                          const currentPlayer = eligibleProfiles.find(p => p.id === currentUserId);
                          const currentSurvey = currentUserId ? surveyMap.get(currentUserId) : undefined;
                          const stats = currentUserId ? getMemberMatchStats(currentUserId, event.id) : null;
                          const assignedCountInEditor = currentUserId ? (currentAssignedCounts[currentUserId] || 0) : 0;
                          const isWilling = currentSurvey?.preferred_disciplines.includes(slot.discipline);
                          const isOverload = currentSurvey?.max_matches_desired && assignedCountInEditor > currentSurvey.max_matches_desired;
                          const isDuplicate = assignedCountInEditor > 1;

                          return (
                            <div
                              key={`slot-${slot.id || sIdx}-player-${pIdx}`}
                              className={`p-4 rounded-xl border transition-all ${
                                currentUserId
                                  ? 'bg-slate-50/80 border-slate-200'
                                  : 'bg-slate-50/40 border-dashed border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-700">
                                  {requiredCount === 1 ? '出賽選手' : `選手 ${pIdx + 1}`}
                                </label>
                                {currentUserId && (
                                  <div className="flex items-center space-x-1.5">
                                    {isWilling && (
                                      <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                                        ✓ 符合意願
                                      </span>
                                    )}
                                    {isDuplicate && (
                                      <span className="text-xs font-semibold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                                        已排 {assignedCountInEditor} 點
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {(() => {
                                const sortedCandidates = getSortedCandidateProfiles(slot.discipline);
                                const unplayedCandidates = sortedCandidates.filter(p => getMemberMatchStats(p.id, event.id).historicalPlayedCount === 0);
                                const playedCandidates = sortedCandidates.filter(p => getMemberMatchStats(p.id, event.id).historicalPlayedCount > 0);

                                return (
                                  <select
                                    value={currentUserId}
                                    onChange={(e) => handleSetPlayer(sIdx, pIdx, e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                                  >
                                    <option value="">-- 請選擇選手 (或點擊清空) --</option>
                                    
                                    {unplayedCandidates.length > 0 && (
                                      <optgroup label="🌟 尚未出賽隊員 (歷史: 0場 - 優先排點輪替)">
                                        {unplayedCandidates.map((p) => {
                                          const pSurvey = surveyMap.get(p.id);
                                          const pAssignedCount = currentAssignedCounts[p.id] || 0;
                                          const isAttending = attendingUserIds.includes(p.id);
                                          const pWantsThis = pSurvey?.preferred_disciplines.includes(slot.discipline);

                                          let label = `${p.name} (${p.level || '中級'}${p.gender === 'female' ? '·女' : '·男'})`;
                                          label += ' [★未曾出賽]';
                                          if (isAttending) label += ' [已報名]';
                                          if (pWantsThis) label += ' [★想打此項]';
                                          if (pAssignedCount > 0) label += ` (本場已排${pAssignedCount}點)`;
                                          label += ' | 歷史出賽:0場';

                                          return (
                                            <option key={p.id} value={p.id}>
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}

                                    {playedCandidates.length > 0 && (
                                      <optgroup label="🏸 已有出賽紀錄隊員 (由少至多排序)">
                                        {playedCandidates.map((p) => {
                                          const pSurvey = surveyMap.get(p.id);
                                          const pStats = getMemberMatchStats(p.id, event.id);
                                          const pAssignedCount = currentAssignedCounts[p.id] || 0;
                                          const isAttending = attendingUserIds.includes(p.id);
                                          const pWantsThis = pSurvey?.preferred_disciplines.includes(slot.discipline);

                                          let label = `${p.name} (${p.level || '中級'}${p.gender === 'female' ? '·女' : '·男'})`;
                                          if (isAttending) label += ' [已報名]';
                                          if (pWantsThis) label += ' [★想打此項]';
                                          if (pAssignedCount > 0) label += ` (本場已排${pAssignedCount}點)`;
                                          label += ` | 歷史出賽:${pStats.historicalPlayedCount}場`;

                                          return (
                                            <option key={p.id} value={p.id}>
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                  </select>
                                );
                              })()}

                              {/* Member Quick Detail Chip */}
                              {currentPlayer && (
                                <div className="mt-2.5 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-800">
                                    {currentPlayer.name}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    意願：{currentSurvey ? currentSurvey.preferred_disciplines.join('/') : '未填寫'}
                                  </span>
                                  {currentSurvey?.partner_preference && (
                                    <>
                                      <span>·</span>
                                      <span className="text-slate-700 font-medium">
                                        搭檔：{currentSurvey.partner_preference}
                                      </span>
                                    </>
                                  )}
                                  {isOverload && (
                                    <span className="text-rose-600 font-bold">
                                      (超出自選上限 {currentSurvey?.max_matches_desired} 點)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Announcement Notes to Players */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  賽前提醒與集合備註說明 (將在隊員前台公開展示)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：請全員提早 20 分鐘抵達熱身，第 1 點與第 2 點同時開打..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

            </div>
          )}

          {/* TAB 2: Member Surveys Table */}
          {activeTab === 'surveys' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
                <span>共 {eventSurveys.length} 位隊員已填寫出賽項目意願 (未曾出賽隊員排在最前)</span>
              </div>

              {eventSurveys.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-slate-200">
                  尚無隊員填寫此場比賽的意願調查
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {[...eventSurveys]
                    .sort((a, b) => {
                      const statsA = getMemberMatchStats(a.user_id, event.id);
                      const statsB = getMemberMatchStats(b.user_id, event.id);
                      if (statsA.historicalPlayedCount !== statsB.historicalPlayedCount) {
                        return statsA.historicalPlayedCount - statsB.historicalPlayedCount;
                      }
                      const assignedA = currentAssignedCounts[a.user_id] || 0;
                      const assignedB = currentAssignedCounts[b.user_id] || 0;
                      if (assignedA !== assignedB) return assignedA - assignedB;
                      return 0;
                    })
                    .map((srv) => {
                      const profile = eligibleProfiles.find(p => p.id === srv.user_id);
                      const stats = getMemberMatchStats(srv.user_id, event.id);
                      const assigned = currentAssignedCounts[srv.user_id] || 0;
                      const isUnplayed = stats.historicalPlayedCount === 0;

                      return (
                        <div key={srv.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                              <span className="font-bold text-base text-slate-900">
                                {profile?.name || '隊員'}
                              </span>
                              {isUnplayed && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 ">
                                  ★ 未曾出賽 (優先)
                                </span>
                              )}
                              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                                {profile?.level || '中級'}
                              </span>
                              <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                                {profile?.gender === 'female' ? '女' : '男'}
                              </span>
                              {assigned > 0 && (
                                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                                  本場已排 {assigned} 點
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-600">
                              <span className="font-semibold text-slate-700">意願項目：</span>
                              {srv.preferred_disciplines.map(d => (
                                <span key={d} className="px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-md font-semibold text-xs">
                                  {d}
                                </span>
                              ))}
                              <span className="text-slate-300">|</span>
                              <span>上限：最多 {srv.max_matches_desired} 點</span>
                            </div>

                            {srv.partner_preference && (
                              <div className="text-xs sm:text-sm text-slate-700 font-medium">
                                搭檔偏好：{srv.partner_preference}
                              </div>
                            )}

                            {srv.notes && (
                              <div className="text-xs text-slate-500">
                                備註：{srv.notes}
                              </div>
                            )}
                          </div>

                          <div className="text-left sm:text-right text-xs sm:text-sm text-slate-500 shrink-0">
                            <div>
                              歷史已出賽：
                              <span className={`font-bold ${isUnplayed ? 'text-amber-700 font-extrabold' : 'text-slate-900'}`}>
                                {stats.historicalPlayedCount}
                              </span> 場
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              更新於 {new Date(srv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Fairness & Rotation Stats */}
          {activeTab === 'stats' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <div className="font-bold flex items-center space-x-2 text-slate-900 mb-1.5">
                  <ShieldCheck className="w-5 h-5 text-slate-600" />
                  <span>公平出賽與輪替原則：</span>
                </div>
                <p className="text-slate-600">
                  1. 每位報名隊員享有平等的上場機會，避免少數隊員過度出賽。<br />
                  2. 系統已將「從未出賽隊員 (0 場)」自動置頂排在最上方，方便優先調度安排。<br />
                  3. 優先滿足隊員勾選的項目意願與搭檔偏好。
                </p>
              </div>

              {/* Mobile: information cards keep every field readable without a squeezed table. */}
              <div className="sm:hidden space-y-2.5">
                {statsProfiles.map((p) => {
                  const isAtt = attendingUserIds.includes(p.id);
                  const srv = surveyMap.get(p.id);
                  const stats = getMemberMatchStats(p.id, event.id);
                  const isUnplayed = stats.historicalPlayedCount === 0;

                  return (
                    <article
                      key={p.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-slate-900 break-all">{p.name}</h3>
                          {isUnplayed && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              未出賽
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                            {p.gender === 'female' ? '女' : '男'} · {p.level || '中級'}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 ${
                            isAtt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isAtt ? '已報名出席' : '未報名'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-slate-200/80 pt-2.5">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold tracking-wide text-slate-400">意願項目</div>
                          {srv?.preferred_disciplines.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {srv.preferred_disciplines.map(discipline => (
                                <span
                                  key={discipline}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                                >
                                  {discipline}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs font-medium text-slate-400">未填意願</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold tracking-wide text-slate-400">歷史出賽</div>
                          <div className={`mt-1 text-sm font-black ${isUnplayed ? 'text-amber-700' : 'text-slate-800'}`}>
                            {stats.historicalPlayedCount} 場
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop: retain the dense comparison table. */}
              <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs">
                    <tr>
                      <th className="p-3.5">隊員姓名</th>
                      <th className="p-3.5">性別/等級</th>
                      <th className="p-3.5">本場報名狀態</th>
                      <th className="p-3.5">意願項目</th>
                      <th className="p-3.5 text-center">本場已排點數</th>
                      <th className="p-3.5 text-center">歷史累計出場</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statsProfiles.map((p) => {
                        const isAtt = attendingUserIds.includes(p.id);
                        const srv = surveyMap.get(p.id);
                        const stats = getMemberMatchStats(p.id, event.id);
                        const currentAssigned = currentAssignedCounts[p.id] || 0;
                        const isUnplayed = stats.historicalPlayedCount === 0;

                        return (
                          <tr key={p.id} className={`hover:bg-slate-50 ${isUnplayed ? 'bg-amber-50/20' : ''}`}>
                            <td className="p-3.5 font-bold text-slate-900 flex items-center space-x-2">
                              <span>{p.name}</span>
                              {isUnplayed && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  未出賽
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-600">
                              {p.gender === 'female' ? '女' : '男'} · {p.level || '中級'}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-0.5 rounded-full font-medium text-xs ${
                                isAtt ? 'bg-emerald-50 text-emerald-700 ' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {isAtt ? '已報名出席' : '未報名'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              {srv ? (
                                <span className="font-medium text-slate-800">
                                  {srv.preferred_disciplines.join('、')}
                                </span>
                              ) : (
                                <span className="text-slate-400">未填意願</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-bold text-sm px-2.5 py-0.5 rounded-lg ${
                                currentAssigned > 1
                                  ? 'bg-slate-200 text-slate-900'
                                  : currentAssigned === 1
                                  ? 'bg-emerald-50 text-emerald-700 '
                                  : 'text-slate-400'
                              }`}>
                                {currentAssigned}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-bold ${isUnplayed ? 'text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md' : 'text-slate-800'}`}>
                                {stats.historicalPlayedCount} 場
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 pt-3.5 sm:pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Publish Toggle */}
          <label className="flex items-center space-x-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4 text-slate-900 rounded-md focus:ring-slate-900 border-slate-300 shrink-0"
            />
            <span className="text-xs sm:text-sm font-medium text-slate-800">
              公開發布至隊員前台 (勾選後隊員即可查看排定名單)
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
            >
              關閉
            </button>
            <button
              type="button"
              onClick={() => handleSave(isPublished)}
              className="flex-2 sm:flex-initial px-5 sm:px-6 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>{isPublished ? '儲存並發布名單' : '儲存排點草稿'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
