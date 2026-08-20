import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAppStore } from '../../store/useAppStore';
import { BadmintonEvent, EventType } from '../../types';
import { formatTimeRange } from '../../utils/dateUtils';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  MapPin, 
  Clock, 
  DollarSign, 
  Users, 
  Edit3, 
  Trash2, 
  List,
  CheckCircle2,
  FileText,
  Trophy,
  Sparkles,
  History
} from 'lucide-react';
import { AdminMatchLineupModal } from '../../components/match/AdminMatchLineupModal';

const EVENT_DEFAULTS_KEY = 'goodminton_last_event_defaults';

interface EventDefaults {
  title?: string;
  startTime: string;
  endTime: string;
  eventType: EventType;
  location: string;
  courtNumber: string;
  fee: string;
  maxParticipants: string;
  notes: string;
}

const getInitialDefaults = (): EventDefaults => {
  try {
    const saved = localStorage.getItem(EVENT_DEFAULTS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to read last event defaults from localStorage', e);
  }
  return {
    title: '',
    startTime: '19:00',
    endTime: '22:00',
    eventType: '練球',
    location: '陽光羽球館',
    courtNumber: 'Court 1-2',
    fee: '250',
    maxParticipants: '16',
    notes: ''
  };
};

export const AdminEvents: React.FC = () => {
  const { events, addEvent, updateEvent, deleteEvent, matchSurveys, matchLineupSlots } = useAppStore();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Match Lineup Modal State
  const [selectedMatchEvent, setSelectedMatchEvent] = useState<BadmintonEvent | null>(null);

  // Form Fields
  const initialDefaults = getInitialDefaults();
  const [title, setTitle] = useState(initialDefaults.title || '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(initialDefaults.startTime);
  const [endTime, setEndTime] = useState(initialDefaults.endTime);
  const [eventType, setEventType] = useState<EventType>(initialDefaults.eventType);
  const [location, setLocation] = useState(initialDefaults.location);
  const [courtNumber, setCourtNumber] = useState(initialDefaults.courtNumber);
  const [fee, setFee] = useState<string>(initialDefaults.fee);
  const [maxParticipants, setMaxParticipants] = useState<string>(initialDefaults.maxParticipants);
  const [notes, setNotes] = useState(initialDefaults.notes);

  const handleOpenAddModal = (selectedDate?: string) => {
    const currentDefaults = getInitialDefaults();
    setEditingEventId(null);
    setTitle(currentDefaults.title || '');
    setEventDate(selectedDate || new Date().toISOString().split('T')[0]);
    setStartTime(currentDefaults.startTime || '19:00');
    setEndTime(currentDefaults.endTime || '22:00');
    setEventType(currentDefaults.eventType || '練球');
    setLocation(currentDefaults.location || '陽光羽球館');
    setCourtNumber(currentDefaults.courtNumber || 'Court 1-2');
    setFee(currentDefaults.fee ?? '250');
    setMaxParticipants(currentDefaults.maxParticipants ?? '16');
    setNotes(currentDefaults.notes || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: BadmintonEvent) => {
    setEditingEventId(evt.id);
    setTitle(evt.title);
    setEventDate(evt.event_date);
    setStartTime(evt.start_time || '19:00');
    setEndTime(evt.end_time || '22:00');
    setEventType(evt.event_type);
    setLocation(evt.location);
    setCourtNumber(evt.court_number || '');
    setFee(evt.fee !== undefined && evt.fee !== null ? String(evt.fee) : '');
    setMaxParticipants(evt.max_participants !== undefined && evt.max_participants !== null ? String(evt.max_participants) : '');
    setNotes(evt.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate || isSaving) return;

    const parsedFee = fee.trim() !== '' ? Number(fee) : undefined;
    const parsedMax = maxParticipants.trim() !== '' ? Number(maxParticipants) : undefined;

    // Save defaults to localStorage for future new events
    try {
      const defaultsToSave: EventDefaults = {
        title: title.trim(),
        startTime,
        endTime,
        eventType,
        location: location.trim(),
        courtNumber: courtNumber.trim(),
        fee: fee.trim(),
        maxParticipants: maxParticipants.trim(),
        notes: notes.trim()
      };
      localStorage.setItem(EVENT_DEFAULTS_KEY, JSON.stringify(defaultsToSave));
    } catch (err) {
      console.error('Failed to save event defaults', err);
    }

    setIsSaving(true);
    const result = editingEventId
      ? await updateEvent(editingEventId, {
        title,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        event_type: eventType,
        location,
        court_number: courtNumber,
        fee: parsedFee,
        max_participants: parsedMax,
        notes
      })
      : await addEvent({
        title,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        event_type: eventType,
        location,
        court_number: courtNumber,
        fee: parsedFee,
        max_participants: parsedMax,
        notes
      });
    setIsSaving(false);

    if (result.success) setIsModalOpen(false);
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (deletingEventId) return false;
    const confirmed = window.confirm(
      `確定要永久刪除活動「${eventTitle}」嗎？\n\n相關的報名、出賽意願與排點資料也會一併刪除。`
    );
    if (!confirmed) return false;

    setDeletingEventId(eventId);
    const result = await deleteEvent(eventId);
    setDeletingEventId(null);
    return result.success;
  };

  // Deduplicated unique events
  const uniqueEvents = useMemo(() => {
    const seen = new Set<string>();
    return events.filter(e => {
      if (!e?.id) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [events]);

  // Convert store events to FullCalendar format
  const calendarEvents = uniqueEvents.map((e) => ({
    id: e.id,
    title: `${e.event_type} - ${e.title}`,
    date: e.event_date,
    backgroundColor:
      e.event_type === '練球'
        ? '#10b981'
        : e.event_type === '比賽'
        ? '#f59e0b'
        : '#6366f1',
    borderColor: 'transparent',
    extendedProps: e
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 inline-block">
              管理員專區
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">活動與行事曆管理</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">
            點擊日曆日期或按下「新增活動」發起練球、賽事或體訓
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-sm">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
                viewMode === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>日曆視圖</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
                viewMode === 'list'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span>清單模式</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm flex items-center space-x-2 shadow-2xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>新增活動</span>
          </button>
        </div>
      </div>

      {/* Main View Container */}
      {viewMode === 'calendar' ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-7 shadow-2xs text-slate-800">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            dateClick={(info) => handleOpenAddModal(info.dateStr)}
            eventClick={(info) => handleOpenEditModal(info.event.extendedProps as BadmintonEvent)}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uniqueEvents.map((evt) => (
            <div
              key={evt.id}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-3 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {evt.event_type}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5 tracking-tight">{evt.title}</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenEditModal(evt)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <Edit3 className="w-4.5 h-4.5" />
                  </button>
                  <button
                    type="button"
                    disabled={deletingEventId === evt.id}
                    onClick={() => void handleDeleteEvent(evt.id, evt.title)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition-colors"
                    title="刪除活動"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-700 pt-3 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{evt.event_date}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formatTimeRange(evt.start_time, evt.end_time)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{evt.location} ({evt.court_number})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {evt.fee !== undefined && evt.fee !== null ? `$${evt.fee}` : '免費/無額外費用'} / {evt.max_participants ? `限 ${evt.max_participants}人` : '不限人數'}
                  </span>
                </div>
              </div>

              {evt.notes && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-sm text-amber-900 flex items-start space-x-2 mt-2">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">備註與注意事項：</span>
                    <span className="whitespace-pre-line">{evt.notes}</span>
                  </div>
                </div>
              )}

              {/* Tournament Specific Lineup Button */}
              {evt.event_type === '比賽' && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-amber-900 font-bold flex items-center space-x-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                    <span>5 點團體賽名單排點</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMatchEvent(evt)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>排點管理系統</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
                    <span>{editingEventId ? '編輯羽球活動' : '發起新羽球活動'}</span>
                  </h2>
                  {!editingEventId && (
                    <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 mt-0.5">
                      <History className="w-3 h-3 text-emerald-600" />
                      <span>已自動帶入上次建立的活動偏好設定</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Scrollable Body */}
              <div className="space-y-4 p-4 sm:p-6 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    活動名稱 *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="例如：【週三例會】隊內對抗與體能訓練"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      活動日期 *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      活動類型
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as EventType)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="練球">練球</option>
                      <option value="暢打">暢打</option>
                      <option value="隊聚">隊聚</option>
                      <option value="團聚">團聚</option>
                      <option value="比賽">比賽</option>
                      <option value="體訓">體訓</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      開始時間
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      結束時間
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      場地地點
                    </label>
                    <input
                      type="text"
                      placeholder="例如：陽光羽球館"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      場地號 / 備註
                    </label>
                    <input
                      type="text"
                      placeholder="例如：Court 3-4"
                      value={courtNumber}
                      onChange={(e) => setCourtNumber(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      每人費用 ($) <span className="text-slate-400 font-normal">(選填)</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="選填 (例如: 250)"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      人數上限 <span className="text-slate-400 font-normal">(選填)</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      placeholder="選填 (不填代表不限)"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    備註與注意事項
                  </label>
                  <textarea
                    rows={2}
                    placeholder="例如：請著平底羽球鞋，大會提供比賽用球"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-3.5 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                {editingEventId ? (
                  <button
                    type="button"
                    disabled={deletingEventId === editingEventId}
                    onClick={async () => {
                      const deleted = await handleDeleteEvent(editingEventId, title);
                      if (deleted) setIsModalOpen(false);
                    }}
                    className="px-3 sm:px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-1.5 border border-rose-200 transition-colors shrink-0 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>刪除活動</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 sm:px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer active:scale-95"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-colors cursor-pointer active:scale-95"
                  >
                    {editingEventId ? '儲存變更' : '建立活動'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Match Lineup Modal */}
      {selectedMatchEvent && (
        <AdminMatchLineupModal
          isOpen={!!selectedMatchEvent}
          onClose={() => setSelectedMatchEvent(null)}
          event={selectedMatchEvent}
        />
      )}

    </div>
  );
};
