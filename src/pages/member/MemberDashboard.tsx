import React from 'react';
import { AnnouncementBoard } from '../../components/common/AnnouncementBoard';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { AttendanceStatus, BadmintonEvent } from '../../types';
import { isEventPast, formatTimeRange, formatEventDateTimeCN } from '../../utils/dateUtils';
import { EventSessionCard } from '../../components/common/EventSessionCard';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Wallet, 
  ArrowRight, 
  ChevronRight,
  Sparkles, 
  Clock, 
  MapPin, 
  DollarSign,
  FileText,
  X,
  Edit3,
  Lock
} from 'lucide-react';

export const MemberDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    events, 
    attendance, 
    feeRecords, 
    feeCollections, 
    toggleAttendance, 
    markEventsAsViewed,
    profiles
  } = useAppStore();

  const [selectedLeaveEvent, setSelectedLeaveEvent] = React.useState<BadmintonEvent | null>(null);
  const [leaveReason, setLeaveReason] = React.useState('');

  // Mark events as viewed when viewing dashboard
  React.useEffect(() => {
    if (currentUser?.id) {
      markEventsAsViewed(currentUser.id);
    }
  }, [currentUser?.id, events.length, markEventsAsViewed]);

  const openLeaveModal = (evt: BadmintonEvent) => {
    const existingAtt = attendance.find((a) => a.user_id === currentUser.id && a.event_id === evt.id);
    setSelectedLeaveEvent(evt);
    setLeaveReason(existingAtt?.remarks || '');
  };

  const handleConfirmLeave = async () => {
    if (!selectedLeaveEvent) return;
    const finalReason = leaveReason.trim() || '個人事假';
    const result = await toggleAttendance(currentUser.id, selectedLeaveEvent.id, 'absent', finalReason);
    if (!result.success) return;
    setSelectedLeaveEvent(null);
    setLeaveReason('');
  };

  const [eventFilter, setEventFilter] = React.useState<'upcoming' | 'past' | 'all'>('upcoming');

  // Filter events by time
  const rawUpcoming = events
    .filter((e) => !isEventPast(e))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const rawPast = events
    .filter((e) => isEventPast(e))
    .sort((a, b) => b.event_date.localeCompare(a.event_date)); // Most recent past first

  const dedupeEvents = (evts: BadmintonEvent[]) => {
    const seen = new Set<string>();
    return evts.filter((e) => {
      if (!e?.id) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  };

  const upcomingEvents = dedupeEvents(rawUpcoming);
  const pastEvents = dedupeEvents(rawPast);
  const nextEvent = upcomingEvents[0];

  const displayedEvents = dedupeEvents(
    eventFilter === 'upcoming' 
      ? upcomingEvents 
      : eventFilter === 'past' 
      ? pastEvents 
      : [...events].sort((a, b) => a.event_date.localeCompare(b.event_date))
  );

  // Current attendance status for next event
  const nextAttendanceRecord = nextEvent
    ? attendance.find((a) => a.user_id === currentUser.id && a.event_id === nextEvent.id)
    : undefined;

  const nextStatus: AttendanceStatus = nextAttendanceRecord?.status || 'pending';

  // Calculate user total unpaid balance
  const myFeeRecords = feeRecords.filter((r) => r.user_id === currentUser.id && !r.is_paid);
  const myUnpaidTotal = myFeeRecords.reduce((sum, r) => {
    const collection = feeCollections.find((c) => c.id === r.collection_id);
    return sum + (collection?.amount_per_person || 0);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      <AnnouncementBoard />

      {/* Welcome Banner */}
      <div className="relative bg-white border border-slate-200/90 rounded-[28px] sm:rounded-[32px] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Top-right Decorative Diagonal Speed Lines */}
        <div className="absolute top-0 right-0 pointer-events-none select-none h-full w-48 sm:w-64 overflow-hidden">
          <svg
            viewBox="0 0 240 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -top-3 -right-3 w-56 sm:w-68 h-auto opacity-75"
          >
            <rect x="130" y="-20" width="14" height="85" rx="7" transform="rotate(40 130 -20)" fill="#A7F3D0" fillOpacity="0.45" />
            <rect x="170" y="-15" width="18" height="130" rx="9" transform="rotate(40 170 -15)" fill="#6EE7B7" fillOpacity="0.5" />
            <rect x="210" y="5" width="16" height="110" rx="8" transform="rotate(40 210 5)" fill="#A7F3D0" fillOpacity="0.4" />
            <rect x="195" y="75" width="14" height="80" rx="7" transform="rotate(40 195 75)" fill="#D1FAE5" fillOpacity="0.65" />
            <rect x="115" y="35" width="12" height="55" rx="6" transform="rotate(40 115 35)" fill="#A7F3D0" fillOpacity="0.35" />
            <rect x="155" y="85" width="12" height="50" rx="6" transform="rotate(40 155 85)" fill="#6EE7B7" fillOpacity="0.35" />
          </svg>
        </div>

        {/* Header Tag & Greeting */}
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-1.5">
            <span className="text-xs sm:text-sm md:text-base text-slate-600 font-medium tracking-tight">
              歡迎回到 GOODMINTON！
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2 mb-1.5">
            哈囉，{currentUser.name}！
          </h1>

          <div className="text-sm sm:text-base font-bold text-slate-700 tracking-tight">
            羽球戰力等級：<span className="text-emerald-700 font-bold">{currentUser.level || '中級'}</span>
          </div>

          {/* Unpaid Balance Inner Card */}
          <div 
            onClick={() => navigate('/member/finances')}
            className="mt-5 sm:mt-6 bg-white hover:bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all hover:border-slate-300 group shadow-xs"
          >
            <div className="flex items-center space-x-3.5 sm:space-x-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">目前待繳總額</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight mt-0.5">
                  ${myUnpaidTotal.toLocaleString()}
                </div>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </div>
      </div>

      {/* Main Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
        
        {/* Card 1: 近期活動 */}
        <div 
          onClick={() => navigate('/member/calendar')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
              近期活動
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          <div className="my-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{upcomingEvents.length}</span>
              <span className="text-lg font-bold text-slate-800">場</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-normal">
            最近：{nextEvent ? formatEventDateTimeCN(nextEvent.event_date, nextEvent.start_time) : '尚無排定活動'}
          </div>
        </div>

        {/* Card 2: 待確認繳費 */}
        <div 
          onClick={() => navigate('/member/finances')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
              待確認繳費
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="my-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{myFeeRecords.length}</span>
              <span className="text-lg font-bold text-slate-800">筆</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-normal">
            合計 ${myUnpaidTotal.toLocaleString()}
          </div>
        </div>

      </div>

      {/* TOP FEATURE CARD: 下次活動報名狀態 (Next Event Registration Card) */}
      {nextEvent ? (() => {
        const eventAtts = attendance.filter((a) => a.event_id === nextEvent.id);
        const attendingAtts = eventAtts.filter((a) => a.status === 'attending');
        const attendingCount = attendingAtts.length;

        return (
          <EventSessionCard
            event={nextEvent}
            attendingCount={attendingCount}
            maxParticipants={nextEvent.max_participants || profiles.length}
            isNext={true}
            isAdmin={false}
            userStatus={nextStatus}
            onAttendClick={() => toggleAttendance(currentUser.id, nextEvent.id, 'attending', '')}
            onLeaveClick={() => openLeaveModal(nextEvent)}
          />
        );
      })() : (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-500 uppercase tracking-wider block">即將到來之隊務活動</span>
              <h2 className="text-base font-bold text-slate-800">目前尚無排定中之即將活動</h2>
              <p className="text-xs text-slate-400 mt-0.5">管理員建立新日程後將自動在此更新，您亦可隨時至月曆查看過往紀錄</p>
            </div>
          </div>
        </div>
      )}

      {/* All Upcoming / Past Events Schedule */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <span>活動排程與點名一覽</span>
            </h2>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs sm:text-sm font-semibold">
              <button
                onClick={() => setEventFilter('upcoming')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  eventFilter === 'upcoming'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                即將進行 ({upcomingEvents.length})
              </button>
              <button
                onClick={() => setEventFilter('past')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  eventFilter === 'past'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                已結束 ({pastEvents.length})
              </button>
              <button
                onClick={() => setEventFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  eventFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                全部 ({events.length})
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/member/calendar')}
            className="text-sm font-semibold text-emerald-700 hover:underline flex items-center space-x-1 self-start sm:self-auto"
          >
            <span>月曆檢視</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {displayedEvents.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-500 text-sm shadow-2xs space-y-2">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-bold text-slate-700 text-base">
              {eventFilter === 'upcoming' ? '目前沒有即將進行的活動' : '無此篩選條件之活動紀錄'}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">可切換篩選標籤查看歷史活動紀錄。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedEvents.map((evt) => {
              const myAtt = attendance.find((a) => a.user_id === currentUser.id && a.event_id === evt.id);
              const status = myAtt?.status || 'pending';
              const eventAtts = attendance.filter((a) => a.event_id === evt.id);
              const attendingCount = eventAtts.filter((a) => a.status === 'attending').length;

              return (
                <EventSessionCard
                  key={evt.id}
                  event={evt}
                  attendingCount={attendingCount}
                  maxParticipants={evt.max_participants || profiles.length}
                  isNext={false}
                  isAdmin={false}
                  userStatus={status}
                  onAttendClick={() => toggleAttendance(currentUser.id, evt.id, 'attending', '')}
                  onLeaveClick={() => openLeaveModal(evt)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Reason Modal */}
      {selectedLeaveEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-3xl w-full max-w-md p-6 shadow-xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200/80">
                  <XCircle className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-lg">隊員請假登記</h3>
              </div>
              <button
                onClick={() => setSelectedLeaveEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-sm space-y-1.5">
              <div className="font-bold text-slate-900 text-base">{selectedLeaveEvent.title}</div>
              <div className="text-slate-600">📅 活動日期：{selectedLeaveEvent.event_date} ({formatTimeRange(selectedLeaveEvent.start_time, selectedLeaveEvent.end_time)})</div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                請假理由 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="請輸入請假原因（例如：工作加班、身體不適、出國旅遊...）"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition-all"
              />

              {/* Quick Reason Chips */}
              <div className="pt-1">
                <div className="text-xs font-semibold text-slate-500 mb-1.5">快速選擇常見理由：</div>
                <div className="flex flex-wrap gap-1.5">
                  {['工作加班', '身體不適', '家庭聚餐', '出國旅遊', '受傷休養'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setLeaveReason(reason)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedLeaveEvent(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl shadow-2xs transition-colors"
              >
                確認送出請假
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
