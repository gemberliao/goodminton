import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { AttendanceStatus } from '../../types';
import { formatEventDateTimeCN, formatTimeRange, isEventPast } from '../../utils/dateUtils';
import { 
  UserCheck, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Search, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  FileText,
  LayoutGrid,
  ListFilter,
  Sparkles,
  MessageSquare
} from 'lucide-react';

export const AdminAttendance: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profiles, events, attendance, toggleAttendance } = useAppStore();
  
  // Sorted events by date ascending (deduplicated)
  const sortedEvents = useMemo(() => {
    const seen = new Set<string>();
    return [...events]
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .filter((e) => {
        if (!e?.id) return false;
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
  }, [events]);

  // Read eventId from query param or location state
  const queryEventId = searchParams.get('eventId') || (location.state as { eventId?: string })?.eventId;

  // Selected event state
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (queryEventId && sortedEvents.some(e => e.id === queryEventId)) {
      return queryEventId;
    }
    if (sortedEvents.length === 0) return '';
    const nowStr = new Date().toISOString().split('T')[0];
    const upcoming = sortedEvents.find(e => e.event_date >= nowStr);
    return upcoming ? upcoming.id : sortedEvents[sortedEvents.length - 1].id;
  });

  // Keep state synced if URL queryParam changes or external navigation happens
  useEffect(() => {
    if (queryEventId && sortedEvents.some(e => e.id === queryEventId)) {
      setSelectedEventId(queryEventId);
      setViewMode('single');
    }
  }, [queryEventId, sortedEvents]);

  // Keep selectedEvent valid if events change
  const currentEvent = useMemo(() => {
    return sortedEvents.find(e => e.id === selectedEventId) || sortedEvents[0] || null;
  }, [sortedEvents, selectedEventId]);

  // View mode: 'single' (clean event focused) or 'matrix' (full table overview)
  const [viewMode, setViewMode] = useState<'single' | 'matrix'>('single');
  
  // Filters for single-event view
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  
  // Remark editing modal state
  const [editingRemarkUser, setEditingRemarkUser] = useState<{ userId: string; name: string; remarks: string } | null>(null);

  // Statistics for current selected event
  const currentEventStats = useMemo(() => {
    if (!currentEvent) return { attending: 0, absent: 0, pending: 0, total: profiles.length, rate: 0 };
    const eventAtts = attendance.filter(a => a.event_id === currentEvent.id);
    let attending = 0;
    let absent = 0;

    profiles.forEach(p => {
      const rec = eventAtts.find(a => a.user_id === p.id);
      if (rec?.status === 'attending') attending++;
      else if (rec?.status === 'absent') absent++;
    });

    const pending = profiles.length - attending - absent;
    const rate = profiles.length > 0 ? Math.round((attending / profiles.length) * 100) : 0;
    return { attending, absent, pending, total: profiles.length, rate };
  }, [currentEvent, attendance, profiles]);

  // Filtered members for single-event view
  const filteredMembers = useMemo(() => {
    return profiles.filter(member => {
      // Search term filter
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.level.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter !== 'all' && currentEvent) {
        const record = attendance.find(a => a.user_id === member.id && a.event_id === currentEvent.id);
        const currentStatus = record?.status || 'pending';
        if (currentStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [profiles, searchTerm, statusFilter, currentEvent, attendance]);

  // Index of current event for prev/next buttons
  const currentEventIndex = useMemo(() => {
    if (!currentEvent) return -1;
    return sortedEvents.findIndex(e => e.id === currentEvent.id);
  }, [sortedEvents, currentEvent]);

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setSearchParams({ eventId: id });
  };

  const handlePrevEvent = () => {
    if (currentEventIndex > 0) {
      const nextId = sortedEvents[currentEventIndex - 1].id;
      setSelectedEventId(nextId);
      setSearchParams({ eventId: nextId });
    }
  };

  const handleNextEvent = () => {
    if (currentEventIndex < sortedEvents.length - 1) {
      const nextId = sortedEvents[currentEventIndex + 1].id;
      setSelectedEventId(nextId);
      setSearchParams({ eventId: nextId });
    }
  };

  // Batch action handlers
  const handleBatchMarkAll = (targetStatus: AttendanceStatus) => {
    if (!currentEvent) return;
    filteredMembers.forEach(m => {
      toggleAttendance(m.id, currentEvent.id, targetStatus);
    });
  };

  // Helper for status badge
  const renderStatusBadge = (status: AttendanceStatus | undefined, remarks?: string) => {
    switch (status) {
      case 'attending':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center justify-center space-x-1 whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>出席</span>
          </span>
        );
      case 'absent':
        return (
          <div className="flex flex-col items-center">
            <span 
              title={remarks ? `請假理由：${remarks}` : '請假'}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center justify-center space-x-1 whitespace-nowrap"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>請假</span>
            </span>
            {remarks && (
              <span className="text-[11px] text-rose-600 font-semibold truncate max-w-[90px] mt-0.5" title={`理由: ${remarks}`}>
                {remarks}
              </span>
            )}
          </div>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center justify-center space-x-1 whitespace-nowrap">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>未填寫</span>
          </span>
        );
    }
  };

  const cycleStatus = (current: AttendanceStatus | undefined): AttendanceStatus => {
    if (!current || current === 'pending') return 'attending';
    if (current === 'attending') return 'absent';
    return 'pending';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 inline-block">
              管理員專區
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">活動出缺席點名與管理</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            快速選擇特定活動進行專注點名，或切換至全期出勤矩陣大表
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('single')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'single'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListFilter className="w-4 h-4 text-emerald-600" />
            <span>單場活動點名</span>
          </button>
          <button
            onClick={() => setViewMode('matrix')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'matrix'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
            <span>全期總覽矩陣</span>
          </button>
        </div>
      </div>

      {/* NO EVENTS STATE */}
      {sortedEvents.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center space-y-3 shadow-2xs">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">目前尚無建立任何活動</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            請先在「活動排程」中建立練球、暢打或隊聚活動，即可在此進行出缺席點名。
          </p>
          <button
            onClick={() => navigate('/admin/events')}
            className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            前往建立活動
          </button>
        </div>
      ) : viewMode === 'single' ? (
        /* SINGLE EVENT FOCUSED CLEAN VIEW */
        <div className="space-y-5">
          
          {/* Activity Selector Bar */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Event Selector Dropdown */}
              <div className="w-full md:w-auto md:min-w-[340px]">
                <div className="relative">
                  <select
                    value={currentEvent?.id || ''}
                    onChange={(e) => handleSelectEvent(e.target.value)}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer truncate"
                  >
                    {sortedEvents.map((evt) => {
                      const isPast = isEventPast(evt);
                      return (
                        <option key={evt.id} value={evt.id}>
                          {evt.event_date} 【{evt.event_type}】{evt.title} {isPast ? '（已結束）' : '（進行中/待辦）'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Event Metadata Tag Summary */}
              {currentEvent && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 font-medium">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    {currentEvent.event_type}
                  </span>
                  <div className="flex items-center gap-1 text-slate-700 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatEventDateTimeCN(currentEvent.event_date, currentEvent.start_time)}</span>
                  </div>
                  {currentEvent.location && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{currentEvent.location} {currentEvent.court_number && `(${currentEvent.court_number})`}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Metrics & Attendance Snapshot as Filter Buttons */}
            {currentEvent && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
                {/* All Members */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer border-2 ${
                    statusFilter === 'all'
                      ? 'bg-slate-100/90 border-slate-900 text-slate-900'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-500">
                    全部應到隊員
                  </div>
                  <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                    {currentEventStats.total} <span className="text-xs font-normal text-slate-500">人</span>
                  </div>
                </button>

                {/* Attending Filter */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('attending')}
                  className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer border-2 ${
                    statusFilter === 'attending'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                      : 'bg-white hover:bg-emerald-50/30 border-slate-200/80 text-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已報名出席</span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 tracking-tight mt-0.5">
                    {currentEventStats.attending} 
                    <span className="text-xs font-normal text-emerald-600/80">
                      {currentEvent.max_participants ? ` / ${currentEvent.max_participants}` : ''} 人
                    </span>
                  </div>
                </button>

                {/* Absent Filter */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('absent')}
                  className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer border-2 ${
                    statusFilter === 'absent'
                      ? 'bg-rose-50 border-rose-600 text-rose-900'
                      : 'bg-white hover:bg-rose-50/30 border-slate-200/80 text-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-bold text-rose-700 flex items-center justify-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>已請假</span>
                  </div>
                  <div className="text-xl font-black text-rose-700 tracking-tight mt-0.5">
                    {currentEventStats.absent} <span className="text-xs font-normal text-rose-600/80">人</span>
                  </div>
                </button>

                {/* Pending Filter */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer border-2 ${
                    statusFilter === 'pending'
                      ? 'bg-slate-100 border-slate-700 text-slate-900'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-600 flex items-center justify-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>未回覆 / 未點名</span>
                  </div>
                  <div className="text-xl font-black text-slate-700 tracking-tight mt-0.5">
                    {currentEventStats.pending} <span className="text-xs font-normal text-slate-500">人</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Search & Batch Controls */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              {/* Active Filter Label */}
              <div className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <span>名單清單</span>
                <span className="text-slate-300">·</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/70">
                  {statusFilter === 'all' && `全部隊員 (${filteredMembers.length})`}
                  {statusFilter === 'attending' && `已出席 (${filteredMembers.length})`}
                  {statusFilter === 'absent' && `已請假 (${filteredMembers.length})`}
                  {statusFilter === 'pending' && `未回覆 (${filteredMembers.length})`}
                </span>
              </div>

              {/* Right Controls: Search */}
              <div className="w-full sm:w-auto">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="search"
                    inputMode="search"
                    placeholder="搜尋隊員姓名/帳號..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Member Attendance List */}
            <div className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs space-y-1">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="font-semibold text-slate-600">無符合條件之隊員</div>
                  <p className="text-slate-400">請嘗試更改搜尋字詞或狀態篩選條件。</p>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  if (!currentEvent) return null;
                  const record = attendance.find(
                    (a) => a.user_id === member.id && a.event_id === currentEvent.id
                  );
                  const currentStatus = record?.status || 'pending';

                  return (
                    <div
                      key={member.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-2xl transition-colors"
                    >
                      {/* Member Info */}
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {member.name.substring(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">{member.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                              {member.level}
                            </span>
                            {member.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                管理員
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            @{member.username}
                          </div>
                        </div>
                      </div>

                      {/* Status Action Buttons & Leave Remark */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        
                        {/* If absent, show remarks or button to add remark */}
                        {currentStatus === 'absent' ? (
                          <button
                            onClick={() => setEditingRemarkUser({
                              userId: member.id,
                              name: member.name,
                              remarks: record?.remarks || ''
                            })}
                            className="flex items-center space-x-1 px-2.5 py-1 min-h-[36px] rounded-xl text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 transition-colors"
                            title="查看或修改請假事由"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-[100px]">
                              {record?.remarks ? record.remarks : '填寫事由'}
                            </span>
                          </button>
                        ) : <div className="hidden sm:block" />}

                        {/* 3-State Toggle Segment */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 ml-auto sm:ml-0">
                          <button
                            onClick={() => toggleAttendance(member.id, currentEvent.id, 'attending')}
                            className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'attending'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            出席
                          </button>
                          <button
                            onClick={() => toggleAttendance(member.id, currentEvent.id, 'absent')}
                            className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            請假
                          </button>
                          <button
                            onClick={() => toggleAttendance(member.id, currentEvent.id, 'pending')}
                            className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'pending'
                                ? 'bg-slate-700 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            未填
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MATRIX TABLE VIEW (全期出勤矩陣總覽) */
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden space-y-0">
          
          {/* Matrix Search Filter */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-bold text-slate-700">
              全期各場次出席交叉矩陣 (點擊表格儲存格即可切換狀態)
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="search"
                inputMode="search"
                placeholder="搜尋隊員..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3 sticky left-0 z-20 bg-slate-100 border-r border-slate-200/80 w-32 sm:w-44 min-w-[120px] max-w-[160px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                    隊員 (Member)
                  </th>
                  <th className="p-3 border-r border-slate-200/60 text-center w-24">
                    分級
                  </th>
                  <th className="p-3 border-r border-slate-200/60 text-center w-24">
                    出席率
                  </th>
                  {sortedEvents.map((evt) => (
                    <th key={evt.id} className="p-3 border-r border-slate-200/60 text-center min-w-[110px]">
                      <div className="text-emerald-700 text-xs font-mono font-bold">{evt.event_date}</div>
                      <div className="text-slate-900 text-xs font-bold truncate max-w-[110px] mx-auto mt-0.5">{evt.title}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">({evt.event_type})</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredMembers.map((member) => {
                  const memberAtts = attendance.filter((a) => a.user_id === member.id);
                  const attendingCount = memberAtts.filter((a) => a.status === 'attending').length;
                  const totalEventsCount = sortedEvents.length;
                  const ratePercent = totalEventsCount > 0 ? Math.round((attendingCount / totalEventsCount) * 100) : 0;

                  return (
                    <tr key={member.id} className="group odd:bg-slate-50/50 even:bg-white hover:bg-emerald-50/30 transition-colors">
                      
                      {/* Member Name */}
                      <td className="p-3 sticky left-0 z-10 bg-slate-50 group-even:bg-white group-hover:bg-emerald-50/90 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] transition-colors">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {member.name.substring(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-[90px]" title={member.name}>{member.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[90px]" title={member.username}>{member.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="p-3 border-r border-slate-100 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 whitespace-nowrap shadow-2xs">
                          {member.level}
                        </span>
                      </td>

                      {/* Attendance Rate */}
                      <td className="p-3 border-r border-slate-100 text-center font-mono">
                        <div className="font-extrabold text-emerald-700 text-xs">{ratePercent}%</div>
                        <div className="text-[10px] text-slate-400 font-sans">({attendingCount}/{totalEventsCount})</div>
                      </td>

                      {/* Matrix Cells */}
                      {sortedEvents.map((evt) => {
                        const record = attendance.find((a) => a.user_id === member.id && a.event_id === evt.id);
                        const currentStatus = record?.status;

                        return (
                          <td
                            key={`${member.id}-${evt.id}`}
                            className="p-3 border-r border-slate-100 text-center select-none cursor-pointer hover:bg-emerald-100/40 transition-colors"
                            onClick={() => {
                              const next = cycleStatus(currentStatus);
                              toggleAttendance(member.id, evt.id, next);
                            }}
                          >
                            {renderStatusBadge(currentStatus, record?.remarks)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matrix Legend Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-slate-800">圖例：</span>
              <span className="flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>出席</span>
              </span>
              <span className="flex items-center space-x-1">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>請假</span>
              </span>
              <span className="flex items-center space-x-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>未填寫</span>
              </span>
            </div>
            <p className="text-slate-500 font-medium">
              💡 提示：點擊任一儲存格可循環切換出席、請假、未填寫
            </p>
          </div>
        </div>
      )}

      {/* EDIT LEAVE REMARK MODAL */}
      {editingRemarkUser && currentEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                編輯請假事由 — {editingRemarkUser.name}
              </h3>
              <button
                onClick={() => setEditingRemarkUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              活動：{currentEvent.event_date} 【{currentEvent.event_type}】{currentEvent.title}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                請假原因 / 備註
              </label>
              <textarea
                rows={3}
                value={editingRemarkUser.remarks}
                onChange={(e) => setEditingRemarkUser({
                  ...editingRemarkUser,
                  remarks: e.target.value
                })}
                placeholder="例如：公司加班無法到場、肌肉拉傷休養中..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRemarkUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleAttendance(
                    editingRemarkUser.userId,
                    currentEvent.id,
                    'absent',
                    editingRemarkUser.remarks
                  );
                  setEditingRemarkUser(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-xs"
              >
                確認儲存事由
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
