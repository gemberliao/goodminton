import React, { useState } from 'react';
import { BadmintonEvent } from '../../types';
import { formatDateWeekdayCN, formatTimePeriodCN, isEventPast } from '../../utils/dateUtils';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  Trophy, 
  Sparkles, 
  ClipboardList,
  Eye
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MatchSurveyModal } from '../match/MatchSurveyModal';
import { MatchLineupViewModal } from '../match/MatchLineupViewModal';
import { AdminMatchLineupModal } from '../match/AdminMatchLineupModal';

interface EventSessionCardProps {
  event: BadmintonEvent;
  attendingCount: number;
  maxParticipants?: number;
  isNext?: boolean;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  // Member specific props
  userStatus?: 'attending' | 'absent' | 'pending';
  onAttendClick?: () => void;
  onLeaveClick?: () => void;
}

export const EventSessionCard: React.FC<EventSessionCardProps> = ({
  event,
  attendingCount,
  maxParticipants,
  isNext = false,
  isAdmin = false,
  onAdminClick,
  userStatus = 'pending',
  onAttendClick,
  onLeaveClick
}) => {
  const { currentUser, matchSurveys, matchLineupSlots, matchLineupConfigs } = useAppStore();
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isLineupViewModalOpen, setIsLineupViewModalOpen] = useState(false);
  const [isAdminLineupModalOpen, setIsAdminLineupModalOpen] = useState(false);

  const isFull = maxParticipants ? attendingCount >= maxParticipants : false;
  const isPast = isEventPast(event);
  const isFullAndNotAttending = isFull && userStatus !== 'attending';
  const isAttendDisabled = isPast || isFullAndNotAttending;

  const formattedDate = formatDateWeekdayCN(event.event_date);
  const formattedTime = formatTimePeriodCN(event.start_time);

  const feeDisplay = event.fee !== undefined && event.fee !== null ? `${event.fee}` : '免費';
  const eventTypeDisplay = event.event_type || '暢打';

  const isMatchEvent = event.event_type === '比賽';

  // Match info calculations
  const mySurvey = isMatchEvent
    ? matchSurveys.find(s => s.event_id === event.id && s.user_id === currentUser.id)
    : undefined;

  const eventSurveyCount = isMatchEvent
    ? matchSurveys.filter(s => s.event_id === event.id).length
    : 0;

  const eventLineupSlots = isMatchEvent
    ? matchLineupSlots.filter(s => s.event_id === event.id)
    : [];

  const lineupConfig = isMatchEvent ? matchLineupConfigs[event.id] : undefined;
  const isLineupPublished = lineupConfig?.is_published;
  const assignedPlayersCount = eventLineupSlots.reduce((acc, slot) => acc + slot.player_ids.length, 0);

  return (
    <>
      <div className="bg-white border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:border-slate-300/90 transition-all">
        {/* 1. Header: UPCOMING SESSION & 報名中 Status Badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">
            UPCOMING SESSION
          </span>
          <div className="flex items-center space-x-2 shrink-0">
            {isMatchEvent && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap shrink-0">
                5 點團體賽
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${
                isPast
                  ? 'bg-slate-100 text-slate-500 border border-slate-200'
                  : isFull
                  ? 'bg-slate-200 text-slate-700 border border-slate-300'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isPast ? '已結束' : isFull ? '已額滿' : '報名中'}
            </span>
          </div>
        </div>

        {/* 2. Main Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-3 mb-4">
          {event.title || event.event_type || '練球'}
        </h2>

        {/* 3. Date & Time Row */}
        <div className="flex items-center space-x-3 mb-3">
          <Calendar className="w-5 h-5 text-slate-700 shrink-0" />
          <div className="flex items-baseline space-x-3 sm:space-x-4 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {formattedDate}
            </span>
            <span className="text-base sm:text-lg font-medium text-slate-600 tracking-tight whitespace-nowrap">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* 4. Location Row */}
        <div className="flex items-center space-x-3 text-slate-600 mb-5">
          <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
          <span className="text-base font-medium text-slate-700">
            {event.location} {event.court_number ? `· ${event.court_number}` : ''}
          </span>
        </div>

        {/* Match Specific Feature Banner (意願調查 & 排點名單) */}
        {isMatchEvent && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 my-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center space-x-2 min-w-0">
                <Trophy className="w-4 h-4 text-slate-700 shrink-0" />
                <span className="text-sm font-bold text-slate-900 tracking-tight">
                  比賽排點 & 項目意願調查
                </span>
              </div>
              {isLineupPublished && (
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 whitespace-nowrap shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>5 點名單已發布</span>
                </span>
              )}
            </div>

            {/* Member View inside match banner */}
            {!isAdmin ? (
              <div className="space-y-3 pt-0.5">
                {userStatus === 'absent' ? (
                  // User is absent (請假)
                  <div className="space-y-2.5">
                    <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200/80 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>您目前狀態為<strong>【請假】</strong>，無法填寫出賽意願。</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      依球隊規則，僅有「已報名出席」的隊員才可填寫項目意願並參與 5 點排單。如欲出賽，請先在下方點擊「已報名出席」。
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {isLineupPublished && (
                        <button
                          type="button"
                          onClick={() => setIsLineupViewModalOpen(true)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>查看出賽名單</span>
                        </button>
                      )}
                      {!isPast && (
                        <button
                          type="button"
                          onClick={onAttendClick}
                          disabled={isFullAndNotAttending}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>改為報名出席 (即可填意願)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : userStatus === 'pending' ? (
                  // User has not RSVP'd yet
                  <div className="space-y-2.5">
                    <div className="flex items-center space-x-2 text-amber-800 bg-amber-50 border border-amber-200/80 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium">
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>尚未報名出席活動 (僅限出席者填寫出賽意願)</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      請先在下方點擊「已報名出席」，完成報名後即可立即選擇欲出賽的項目（男單/女單/男雙/女雙/混雙）。
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {isLineupPublished && (
                        <button
                          type="button"
                          onClick={() => setIsLineupViewModalOpen(true)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>查看出賽名單</span>
                        </button>
                      )}
                      {!isPast && (
                        <button
                          type="button"
                          onClick={onAttendClick}
                          disabled={isFullAndNotAttending}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>立即報名出席以填寫意願</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // User is attending (已報名出席)
                  <>
                    <div className="text-sm text-slate-600">
                      {mySurvey ? (
                        <div className="flex items-baseline space-x-1.5 flex-wrap">
                          <span className="font-medium text-slate-500 shrink-0">我的意願：</span>
                          <span className="font-bold text-slate-900">
                            {mySurvey.preferred_disciplines.length > 0 ? mySurvey.preferred_disciplines.join('、') : '配合安排'}
                          </span>
                          {(isLineupPublished || isPast) && (
                            <span className="text-xs text-slate-400 ml-1 font-normal">
                              ({isPast ? '活動已結束，意願已鎖定' : '名單已發布，意願已鎖定'})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-slate-500">
                          {isPast
                            ? '活動已結束，無法再填寫出賽意願'
                            : isLineupPublished 
                            ? '名單已正式發布，意願調查已截止' 
                            : '已報名出席！尚未填寫項目意願（男單/女單/男雙/女雙/混雙）'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {!isLineupPublished && !isPast ? (
                        <button
                          type="button"
                          onClick={() => setIsSurveyModalOpen(true)}
                          className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <ClipboardList className="w-4 h-4 shrink-0" />
                          <span>{mySurvey ? '修改出賽意願' : '填寫出賽意願'}</span>
                        </button>
                      ) : (
                        <>
                          {isLineupPublished && (
                            <button
                              type="button"
                              onClick={() => setIsLineupViewModalOpen(true)}
                              className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                            >
                              <Eye className="w-4 h-4 shrink-0" />
                              <span>查看出賽名單</span>
                            </button>
                          )}

                          {mySurvey && (
                            <button
                              type="button"
                              onClick={() => setIsSurveyModalOpen(true)}
                              className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>檢視我的填寫</span>
                            </button>
                          )}
                          {isPast && !mySurvey && !isLineupPublished && (
                            <span className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200">活動已結束</span>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Admin View inside match banner */
              <div className="space-y-3 pt-0.5">
                <div className="flex items-center space-x-2 text-sm text-slate-600 flex-wrap">
                  <span className="font-medium text-slate-700">
                    隊員填寫意願：<span className="font-bold text-slate-900">{eventSurveyCount}</span> 人
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    已排點名額：<span className="font-bold text-slate-900">{assignedPlayersCount}</span> / 8 人次
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdminLineupModalOpen(true)}
                    className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>排點管理系統 (5點)</span>
                  </button>

                  {eventLineupSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsLineupViewModalOpen(true)}
                      className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      title="隊員前台預覽視角"
                    >
                      <Eye className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>名單預覽</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-100 my-4" />

        {/* 5. Middle Stats Row (目前報名 & 費用) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 py-1">
          
          {/* Left: 目前報名 */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 font-medium truncate">
                目前報名
              </div>
              <div className="text-slate-900 tracking-tight truncate leading-tight mt-0.5">
                <span className="text-lg sm:text-2xl font-black">{attendingCount}</span>
                <span className="text-sm sm:text-lg font-bold text-slate-700">
                  {maxParticipants ? ` / ${maxParticipants} 人` : ' 人'}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Vertical Divider */}
          <div className="w-[1px] h-8 sm:h-10 bg-slate-200 shrink-0" />

          {/* Right: 費用 */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 pl-1 sm:pl-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 font-medium truncate">
                費用
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate leading-tight mt-0.5">
                {feeDisplay}
              </div>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 my-3.5 sm:my-4" />

        {/* 6. Bottom Footer Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 sm:pt-1">
          <div className="text-sm sm:text-base font-semibold text-slate-600 truncate flex items-center space-x-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{eventTypeDisplay}</span>
          </div>

          {isAdmin ? (
            <button
              onClick={onAdminClick}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center space-x-1.5 shadow-xs transition-all active:scale-95 shrink-0"
            >
              <span>管理活動</span>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          ) : (
            <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
              {onAttendClick && (
                <button
                  disabled={isAttendDisabled}
                  onClick={onAttendClick}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-bold flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap ${
                    isPast
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                      : userStatus === 'attending'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : isFullAndNotAttending
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95'
                  }`}
                  title={
                    isPast
                      ? '活動已結束'
                      : userStatus === 'attending'
                      ? '您已報名出席'
                      : isFullAndNotAttending
                      ? '本活動報名人數已額滿，無法再報名'
                      : '點擊報名出席'
                  }
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {userStatus === 'attending'
                      ? '已報名出席'
                      : isFullAndNotAttending
                      ? '已額滿'
                      : '我要出席'}
                  </span>
                </button>
              )}
              {onLeaveClick && (
                <button
                  disabled={isPast}
                  onClick={onLeaveClick}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-bold flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap ${
                    isPast
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                      : userStatus === 'absent'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95'
                  }`}
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{userStatus === 'absent' ? '請假中' : '請假'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Match Modals */}
      {isMatchEvent && (
        <>
          <MatchSurveyModal
            isOpen={isSurveyModalOpen}
            onClose={() => setIsSurveyModalOpen(false)}
            event={event}
          />
          <MatchLineupViewModal
            isOpen={isLineupViewModalOpen}
            onClose={() => setIsLineupViewModalOpen(false)}
            event={event}
            onAdminEdit={isAdmin ? () => setIsAdminLineupModalOpen(true) : undefined}
          />
          {isAdmin && (
            <AdminMatchLineupModal
              isOpen={isAdminLineupModalOpen}
              onClose={() => setIsAdminLineupModalOpen(false)}
              event={event}
            />
          )}
        </>
      )}
    </>
  );
};
