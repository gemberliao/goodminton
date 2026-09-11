import React from 'react';
import { BadmintonEvent } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { 
  X, 
  Trophy, 
  Calendar, 
  MapPin, 
  Clock, 
  FileText
} from 'lucide-react';
import { formatDateWeekdayCN, formatTimePeriodCN } from '../../utils/dateUtils';

interface MatchLineupViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: BadmintonEvent;
  onAdminEdit?: () => void;
}

export const MatchLineupViewModal: React.FC<MatchLineupViewModalProps> = ({
  isOpen,
  onClose,
  event,
  onAdminEdit
}) => {
  const { matchLineupSlots, matchLineupConfigs, profiles, currentUser } = useAppStore();

  if (!isOpen) return null;

  const slots = matchLineupSlots
    .filter(s => s.event_id === event.id)
    .sort((a, b) => a.point_index - b.point_index);

  const config = matchLineupConfigs[event.id];
  const isPublished = config?.is_published;
  const lineupNotes = config?.notes;

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Check if current user is playing in any of the slots
  const myAssignedSlots = slots.filter(s => s.player_ids.includes(currentUser.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl sm:rounded-[28px] max-w-3xl w-full shadow-2xl relative my-auto max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          title="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-4 sm:p-7 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 pr-10 sm:pr-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 ">
              5 點團體賽
            </span>
            {isPublished ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ">
                出賽名單已發布
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 ">
                排單草稿中
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight line-clamp-1">
            {event.title}
          </h2>

          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500 mt-1.5 flex-wrap">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDateWeekdayCN(event.event_date)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatTimePeriodCN(event.start_time)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{event.location}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-7 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1">
          {/* Highlight for Current User */}
          {myAssignedSlots.length > 0 && (
            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs font-bold text-emerald-800 tracking-wider">
                    您的出賽通知
                  </div>
                  <div className="text-xs sm:text-base font-bold text-emerald-950 mt-0.5">
                    代表出賽：{myAssignedSlots.map(s => s.point_name).join('、')}
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shrink-0">
                共 {myAssignedSlots.length} 點
              </span>
            </div>
          )}

          {/* 5 Points Lineup Board */}
          {slots.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200 p-6">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">管理員尚未排定此場比賽的名單</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                請先於活動卡片填寫您的「比賽項目意願調查」，教練團排定並發布後將在此處完整公開。
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {slots.map((slot, sIdx) => {
                const assignedPlayers = slot.player_ids.map(id => profileMap.get(id)).filter(Boolean);

                return (
                  <div
                    key={slot.id || `slot-${sIdx}`}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all"
                  >
                    {/* Point Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-base sm:text-lg font-bold text-slate-900">
                          {slot.point_name}
                        </span>
                        {slot.opponent_info && (
                          <span className="text-sm text-slate-500 font-medium">
                            對手：{slot.opponent_info}
                          </span>
                        )}
                      </div>
                      {slot.score && (
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg self-start sm:self-auto">
                          比分：{slot.score}
                        </span>
                      )}
                    </div>

                    {/* Players list */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {assignedPlayers.length === 0 ? (
                        <span className="text-sm text-slate-400 py-1 font-medium">待指派隊員</span>
                      ) : (
                        assignedPlayers.map((player, pIdx) => {
                          const isMe = player?.id === currentUser.id;
                          return (
                            <div
                              key={`${slot.id}-${player?.id || pIdx}-${pIdx}`}
                              className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                                isMe
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isMe ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {player?.name ? player.name[0] : 'P'}
                              </div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-sm sm:text-base font-bold text-slate-900">
                                  {player?.name}
                                </span>
                                <span className="text-xs text-slate-500 font-normal">
                                  ({player?.level || '中級'})
                                </span>
                              </div>
                              {isMe && (
                                <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                                  我
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lineup Notes */}
          {lineupNotes && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed space-y-1.5">
              <div className="font-bold flex items-center space-x-2 text-slate-900">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>賽前提醒與備註：</span>
              </div>
              <p className="whitespace-pre-line text-slate-600">{lineupNotes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="text-xs sm:text-sm text-slate-500 font-medium text-center sm:text-left">
            共 5 點賽制 · {slots.reduce((sum, s) => sum + s.player_ids.length, 0)} 位人次出賽
          </div>

          <div className="flex items-center space-x-2.5 justify-end">
            {currentUser.role === 'admin' && onAdminEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAdminEdit();
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                調整排點名單
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-6 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

