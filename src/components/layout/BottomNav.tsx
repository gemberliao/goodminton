import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Receipt, 
  User,
  Calendar,
  UserCheck,
  Wallet,
  Users
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { 
    currentUser, 
    profiles, 
    feeRecords, 
    events, 
    viewedEventIdsByUser, 
    viewedFeeRecordIdsByUser 
  } = useAppStore();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const pendingMembersCount = profiles.filter((p) => p.status === 'pending').length;
  const pendingFinancesCount = feeRecords.filter((r) => !r.is_paid && r.payment_status === 'pending').length;

  // Unviewed Events for Member
  const userViewedEventIds = viewedEventIdsByUser?.[currentUser.id] || [];
  const unviewedEventsCount = events.filter((e) => !userViewedEventIds.includes(e.id)).length;

  // Unviewed Finances for Member (New bills created by admin)
  const userViewedFeeIds = viewedFeeRecordIdsByUser?.[currentUser.id] || [];
  const unviewedFinancesCount = feeRecords.filter(
    (r) => r.user_id === currentUser.id && !userViewedFeeIds.includes(r.id)
  ).length;

  const memberNavItems = [
    {
      to: '/member/dashboard',
      label: '儀表板',
      icon: LayoutDashboard,
      badgeCount: 0
    },
    {
      to: '/member/calendar',
      label: '球隊月曆',
      icon: CalendarDays,
      badgeCount: unviewedEventsCount,
    },
    {
      to: '/member/finances',
      label: '個人帳單',
      icon: Receipt,
      badgeCount: unviewedFinancesCount,
    },
    {
      to: '/member/profile',
      label: '個人資料',
      icon: User,
      badgeCount: 0
    },
  ];

  const adminNavItems = [
    {
      to: '/admin/dashboard',
      label: '總覽',
      icon: LayoutDashboard,
      badgeCount: 0
    },
    {
      to: '/admin/events',
      label: '活動排程',
      icon: Calendar,
      badgeCount: 0
    },
    {
      to: '/admin/attendance',
      label: '出缺席',
      icon: UserCheck,
      badgeCount: 0
    },
    {
      to: '/admin/finances',
      label: '財務分攤',
      icon: Wallet,
      badgeCount: pendingFinancesCount,
    },
    {
      to: '/admin/members',
      label: '隊員名冊',
      icon: Users,
      badgeCount: pendingMembersCount,
    },
  ];

  const navItems = isAdminRoute ? adminNavItems : memberNavItems;
  const gridColsClass = isAdminRoute ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.35)] px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] transition-all">
      <div className={`w-full max-w-lg mx-auto grid ${gridColsClass} gap-1 items-center`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-1 rounded-xl transition-colors duration-150 select-none min-w-0 w-full min-h-[44px] ${
                  isActive
                    ? 'text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 font-medium hover:bg-slate-800/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex items-center justify-center">
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    {item.badgeCount && item.badgeCount > 0 ? (
                      <span className="absolute -top-1 -right-2 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-900"></span>
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] sm:text-[11px] leading-tight mt-0.5 sm:mt-1 truncate max-w-full text-center tracking-tight">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

