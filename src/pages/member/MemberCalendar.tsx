import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAppStore } from '../../store/useAppStore';
import { BadmintonEvent } from '../../types';
import { isEventPast, formatTimeRange } from '../../utils/dateUtils';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, MapPin, DollarSign, X, Lock, FileText } from 'lucide-react';

export const MemberCalendar: React.FC = () => {
  const { events, attendance, currentUser, toggleAttendance, markEventsAsViewed } = useAppStore();
  const [selectedEvent, setSelectedEvent] = useState<BadmintonEvent | null>(null);
  const [isLeavingMode, setIsLeavingMode] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');

  // Mark all events as viewed when member opens the calendar
  React.useEffect(() => {
    if (currentUser?.id) {
      markEventsAsViewed(currentUser.id);
    }
  }, [currentUser?.id, events.length, markEventsAsViewed]);

  const currentAtt = selectedEvent
    ? attendance.find((a) => a.user_id === currentUser.id && a.event_id === selectedEvent.id)
    : undefined;

  const selectedEventAttendingCount = selectedEvent
    ? attendance.filter((a) => a.event_id === selectedEvent.id && a.status === 'attending').length
    : 0;

  const isSelectedEventFull = selectedEvent?.max_participants
    ? selectedEventAttendingCount >= selectedEvent.max_participants
    : false;

  const isFullAndNotAttending = isSelectedEventFull && currentAtt?.status !== 'attending';

  const handleOpenEventModal = (evt: BadmintonEvent) => {
    setSelectedEvent(evt);
    const myAtt = attendance.find((a) => a.user_id === currentUser.id && a.event_id === evt.id);
    setIsLeavingMode(myAtt?.status === 'absent');
    setLeaveReason(myAtt?.remarks || '');
  };

  // Convert events to calendar items. Color indicates attendance status,
  // while the visible label shows the complete event name.
  const calendarEvents = events.map((e) => {
    const myAtt = attendance.find((a) => a.user_id === currentUser.id && a.event_id === e.id);
    const status = myAtt?.status || 'pending';

    let color = '#475569'; // pending slate
    if (status === 'attending') {
      color = '#059669'; // emerald
    }
    if (status === 'absent') {
      color = '#e11d48'; // rose
    }

    return {
      id: e.id,
      title: e.title,
      date: e.event_date,
      backgroundColor: color,
      borderColor: 'transparent',
      extendedProps: { event: e, status }
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-slate-900">球隊月曆與一鍵出席請假點名</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          點擊月曆上的活動卡片即可一鍵登記「參加 (Attending)」或「請假 (Absent)」
        </p>
      </div>

      {/* FullCalendar Component */}
      <div className="event-calendar member-calendar bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-6 shadow-2xs text-slate-800">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={calendarEvents}
          eventClick={(info) => {
            const extended = info.event.extendedProps;
            handleOpenEventModal(extended.event as BadmintonEvent);
          }}
          headerToolbar={{
            left: 'prev,today,next title',
            center: '',
            right: ''
          }}
          buttonText={{
            today: '今天'
          }}
          height="auto"
        />
      </div>

      {/* Event Details & RSVP Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-md p-6 shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-700 ">
                {selectedEvent.event_type}
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedEvent.title}</h3>
              <div className="space-y-2.5 text-sm text-slate-700 mt-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{selectedEvent.event_date} ({formatTimeRange(selectedEvent.start_time, selectedEvent.end_time)})</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{selectedEvent.location} ({selectedEvent.court_number})</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {selectedEvent.fee !== undefined && selectedEvent.fee !== null ? `分攤費用 $${selectedEvent.fee} / 人` : '免費 / 無額外費用'}
                    {selectedEvent.max_participants ? ` (上限 ${selectedEvent.max_participants} 人)` : ' (不限人數)'}
                  </span>
                </div>
              </div>

              {selectedEvent.notes && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 mt-3.5 text-sm text-amber-900 flex items-start space-x-2.5">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">備註與注意事項：</span>
                    <span className="whitespace-pre-line">{selectedEvent.notes}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Buttons & Leave Reason Input */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {isEventPast(selectedEvent) ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1.5">
                  <div className="flex items-center justify-center space-x-2 text-sm font-bold text-slate-500">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>本活動時間已過，出席/請假登記已截止</span>
                  </div>
                  <div className="text-sm text-slate-600 font-medium">
                    您的登記記錄：
                    <span className="font-bold ml-2 inline-flex items-center">
                      {currentAtt?.status === 'attending' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 ">
                          出席
                        </span>
                      )}
                      {currentAtt?.status === 'absent' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 ">
                          請假 {currentAtt.remarks ? `(${currentAtt.remarks})` : ''}
                        </span>
                      )}
                      {(!currentAtt || currentAtt.status === 'pending') && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 ">
                          未報名
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {isFullAndNotAttending && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs font-bold text-amber-800">
                      ⚠️ 本活動報名人數已額滿（{selectedEventAttendingCount} / {selectedEvent.max_participants} 人），目前已停止接受新報名。
                    </div>
                  )}

                  <div className="text-sm font-bold text-slate-600 text-center">一鍵登記個人點名狀態：</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={isFullAndNotAttending}
                      onClick={async () => {
                        const result = await toggleAttendance(currentUser.id, selectedEvent.id, 'attending', '');
                        if (result.success) setSelectedEvent(null);
                      }}
                      className={`py-3 font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all ${
                        currentAtt?.status === 'attending'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isFullAndNotAttending
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                      title={isFullAndNotAttending ? '活動人數已額滿' : '確定參加'}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{currentAtt?.status === 'attending' ? '已報名參加' : isFullAndNotAttending ? '名額已滿' : '確定參加'}</span>
                    </button>

                    <button
                      onClick={() => setIsLeavingMode(true)}
                      className={`py-3 font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all ${
                        currentAtt?.status === 'absent' || isLeavingMode
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{currentAtt?.status === 'absent' ? '修改請假' : '登記請假'}</span>
                    </button>
                  </div>

                  {/* Leave Reason Input Form */}
                  {isLeavingMode && (
                    <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-sm text-rose-800 font-bold">
                        <span>請輸入請假理由：</span>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        placeholder="請輸入原因（如：工作加班、身體不適...）"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-rose-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['工作加班', '身體不適', '家庭聚餐', '出國旅遊', '受傷休養'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setLeaveReason(chip)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-end space-x-2.5 pt-1">
                        <button
                          onClick={() => setIsLeavingMode(false)}
                          className="px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                        >
                          取消
                        </button>
                        <button
                          onClick={async () => {
                            const finalReason = leaveReason.trim() || '個人事假';
                            const result = await toggleAttendance(currentUser.id, selectedEvent.id, 'absent', finalReason);
                            if (result.success) setSelectedEvent(null);
                          }}
                          className="px-4 py-2 text-sm font-bold bg-rose-600 text-white hover:bg-rose-500 rounded-xl shadow-2xs"
                        >
                          送出請假理由
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
