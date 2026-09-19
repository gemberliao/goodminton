import React, { useState } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { isAnnouncementUnread, useAnnouncementStore } from '../../store/useAnnouncementStore';
import { ShuttleSmashGameModal } from '../common/ShuttleSmashGameModal';
import { PushNotificationControl } from '../common/PushNotificationControl';
import { supabase } from '../../lib/supabase';
import { disablePushNotifications } from '../../lib/pushNotifications';
import { 
  Shield, 
  User as UserIcon, 
  Menu, 
  ChevronDown,
  LogIn,
  LayoutDashboard,
  CalendarDays,
  Receipt,
  User,
  Crown,
  Gamepad2
} from 'lucide-react';

interface Props {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Navbar: React.FC<Props> = ({ onToggleSidebar, showSidebarToggle = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentUser,
    profiles,
    events,
    feeRecords,
    viewedEventIdsByUser,
    viewedFeeRecordIdsByUser,
    viewedAnnouncementUpdatedAtByUser,
    recordGameResult
  } = useAppStore();
  const announcement = useAnnouncementStore(state => state.announcement);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);

  const isMemberRoute = location.pathname.startsWith('/member');
  const pendingMembersCount = profiles.filter((profile) => profile.status === 'pending').length;
  const pendingPaymentsCount = feeRecords.filter(
    (record) => !record.is_paid && record.payment_status === 'pending'
  ).length;
  const adminPendingCount = currentUser.role === 'admin'
    ? pendingMembersCount + pendingPaymentsCount
    : 0;

  // Unviewed Events & Finances for Member
  const userViewedEventIds = viewedEventIdsByUser?.[currentUser.id] || [];
  const hasUnviewedEvents = events.some((e) => !userViewedEventIds.includes(e.id));

  const userViewedFeeIds = viewedFeeRecordIdsByUser?.[currentUser.id] || [];
  const hasUnviewedFinances = feeRecords.some(
    (r) => r.user_id === currentUser.id && !userViewedFeeIds.includes(r.id)
  );
  const hasUnviewedAnnouncement = isAnnouncementUnread(
    announcement,
    currentUser.id,
    viewedAnnouncementUpdatedAtByUser
  );

  const memberNavItems = [
    {
      to: '/member/dashboard',
      label: '個人儀表板',
      icon: LayoutDashboard,
      hasDot: hasUnviewedAnnouncement
    },
    {
      to: '/member/calendar',
      label: '球隊月曆',
      icon: CalendarDays,
      hasDot: hasUnviewedEvents
    },
    {
      to: '/member/finances',
      label: '個人帳單',
      icon: Receipt,
      hasDot: hasUnviewedFinances
    },
    {
      to: '/member/profile',
      label: '個人資料',
      icon: User,
      hasDot: false
    },
  ];
  
  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await disablePushNotifications(currentUser.id).catch(() => undefined);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">
            
            {/* Brand Logo & Mobile Toggle */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {showSidebarToggle && onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
                  <span className="text-sm sm:text-base font-black">G</span>
                </div>
                <span className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 hidden min-[380px]:inline whitespace-nowrap">
                  GOODMINTON
                </span>
              </div>
            </div>

            {/* Desktop Member Navigation Bar */}
            {isMemberRoute && (
              <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 mx-2 sm:mx-4">
                {memberNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="relative flex items-center">
                            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {item.hasDot && (
                              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                              </span>
                            )}
                          </div>
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            )}

            {/* Right Controls */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              <PushNotificationControl userId={currentUser.id} />
              <button
                type="button"
                onClick={() => setIsGameOpen(true)}
                className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 active:scale-95"
                title="玩羽球反應挑戰"
                aria-label="開啟羽球反應挑戰"
              >
                <Gamepad2 className="h-5 w-5 transition-transform group-hover:-rotate-6 group-hover:scale-110" />
              </button>
              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="relative flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                  title={adminPendingCount > 0 ? `有 ${adminPendingCount} 筆待處理通知` : undefined}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                    {currentUser.name.substring(0, 1)}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</div>
                    <div className="text-xs text-slate-500">{currentUser.level} ‧ {currentUser.role === 'admin' ? '管理者' : '隊員'}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                  {adminPendingCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex min-w-5 h-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                      {adminPendingCount > 9 ? '9+' : adminPendingCount}
                    </span>
                  )}
                </button>

                {/* User Info & Account Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 text-slate-800 space-y-3">
                    <div className="flex items-center space-x-3 pb-2.5 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-base flex items-center justify-center shrink-0">
                        {currentUser.name.substring(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                        <div className="text-xs text-slate-500 truncate">@{currentUser.username}</div>
                        <div className="flex items-center flex-wrap gap-1.5 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 whitespace-nowrap shrink-0">
                            {currentUser.level}
                          </span>
                          {currentUser.role === 'admin' ? (
                            <span title="管理員" aria-label="管理員" className="inline-flex shrink-0 items-center">
                              <Crown className="h-4 w-4 fill-amber-100 text-amber-500" />
                            </span>
                          ) : (
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              隊員
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate(isMemberRoute ? '/admin/dashboard' : '/member/dashboard');
                          }}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                        >
                          {isMemberRoute ? (
                            <>
                              <Shield className="w-4 h-4 text-amber-600" />
                              <span>切換至管理後台</span>
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-4 h-4 text-emerald-600" />
                              <span>切換至隊員前台</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => void handleLogout()}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 flex items-center space-x-2 font-medium transition-colors"
                      >
                        <LogIn className="w-4 h-4 text-slate-500" />
                        <span>安全登出</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </header>
      {isGameOpen && (
        <ShuttleSmashGameModal
          onClose={() => setIsGameOpen(false)}
          onGameComplete={({ winner, playerScore, cpuScore }) => (
            recordGameResult(winner === 'player' ? 'win' : 'loss', playerScore, cpuScore)
          )}
        />
      )}
    </>
  );
};
