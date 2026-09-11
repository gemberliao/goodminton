import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { isAnnouncementUnread, useAnnouncementStore } from '../../store/useAnnouncementStore';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Wallet, 
  UserCheck, 
  User, 
  ShieldAlert,
  CalendarDays,
  Receipt,
  Megaphone
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<Props> = ({ isOpen, onCloseMobile }) => {
  const { 
    currentUser, 
    profiles, 
    feeRecords, 
    events, 
    viewedEventIdsByUser, 
    viewedFeeRecordIdsByUser,
    viewedAnnouncementUpdatedAtByUser
  } = useAppStore();
  const announcement = useAnnouncementStore(state => state.announcement);
  const isAdmin = currentUser.role === 'admin';

  const pendingMembersCount = profiles.filter((p) => p.status === 'pending').length;
  const pendingFinancesCount = feeRecords.filter((r) => !r.is_paid && r.payment_status === 'pending').length;

  // Unviewed Events for Member
  const userViewedEventIds = viewedEventIdsByUser?.[currentUser.id] || [];
  const hasUnviewedEvents = events.some((e) => !userViewedEventIds.includes(e.id));

  // Unviewed Finances for Member (New bills created by admin)
  const userViewedFeeIds = viewedFeeRecordIdsByUser?.[currentUser.id] || [];
  const hasUnviewedFinances = feeRecords.some(
    (r) => r.user_id === currentUser.id && !userViewedFeeIds.includes(r.id)
  );
  const hasUnviewedAnnouncement = isAnnouncementUnread(
    announcement,
    currentUser.id,
    viewedAnnouncementUpdatedAtByUser
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 pt-16 lg:pt-0 flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        
        {/* Role Identity Tag */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              當前身分
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isAdmin ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="text-sm font-semibold text-slate-200">
                {isAdmin ? '球隊管理員' : '正式隊員'}
              </span>
            </div>
          </div>
        </div>

        {/* Admin Navigation Section */}
        {isAdmin && (
          <div className="space-y-1.5">
            <div className="px-3 text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>球隊行政管理員</span>
            </div>

            <NavLink
              to="/admin/dashboard"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5 opacity-90" />
              <span>總覽控制台</span>
            </NavLink>

            <NavLink
              to="/admin/events"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <Calendar className="w-5 h-5 opacity-90" />
              <span>球隊行事曆</span>
            </NavLink>

            <NavLink to="/admin/announcements" onClick={onCloseMobile}
              className={({ isActive }) => `flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
              <div className="flex items-center space-x-3">
                <Megaphone className="w-5 h-5 opacity-90" /><span>球隊公告</span>
              </div>
              {hasUnviewedAnnouncement && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </NavLink>

            <NavLink
              to="/admin/attendance"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <UserCheck className="w-5 h-5 opacity-90" />
              <span>出缺席統計</span>
            </NavLink>

            <NavLink
              to="/admin/members"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 opacity-90" />
                <span>隊員管理</span>
              </div>
              {pendingMembersCount > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </NavLink>

            <NavLink
              to="/admin/finances"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <Wallet className="w-5 h-5 opacity-90" />
                <span>財務自動化</span>
              </div>
              {pendingFinancesCount > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </NavLink>
          </div>
        )}

        {/* Member Navigation Section */}
        <div className="space-y-1.5 pt-2">
          <div className="px-3 text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
            <User className="w-4 h-4" />
            <span>隊員專區</span>
          </div>

          <NavLink
            to="/member/dashboard"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
            >
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-5 h-5 opacity-90" />
                <span>個人儀表板</span>
              </div>
              {hasUnviewedAnnouncement && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </NavLink>

          <NavLink
            to="/member/calendar"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <div className="flex items-center space-x-3">
              <CalendarDays className="w-5 h-5 opacity-90" />
              <span>球隊月曆與一鍵報名</span>
            </div>
            {hasUnviewedEvents && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </NavLink>

          <NavLink
            to="/member/finances"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <div className="flex items-center space-x-3">
              <Receipt className="w-5 h-5 opacity-90" />
              <span>個人帳單與繳費紀錄</span>
            </div>
            {hasUnviewedFinances && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </NavLink>

          <NavLink
            to="/member/profile"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <User className="w-5 h-5 opacity-90" />
            <span>個人資料與戰力層級</span>
          </NavLink>
        </div>

      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-center">
        <div className="text-xs font-bold text-slate-400">GOODMINTON</div>
      </div>
    </aside>
  );
};
