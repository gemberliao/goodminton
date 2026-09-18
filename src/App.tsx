import React, { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useAnnouncementStore } from './store/useAnnouncementStore';
import { getSupabaseConfig, supabase } from './lib/supabase';
import { Layout } from './components/layout/Layout';
import { AuthSessionProvider, useAuthSession } from './auth/AuthSessionProvider';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';

const Login = lazy(() => import('./pages/auth/Login').then((module) => ({ default: module.Login })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents').then((module) => ({ default: module.AdminEvents })));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements').then((module) => ({ default: module.AdminAnnouncements })));
const AdminAttendance = lazy(() => import('./pages/admin/AdminAttendance').then((module) => ({ default: module.AdminAttendance })));
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers').then((module) => ({ default: module.AdminMembers })));
const AdminFinances = lazy(() => import('./pages/admin/AdminFinances').then((module) => ({ default: module.AdminFinances })));
const MemberDashboard = lazy(() => import('./pages/member/MemberDashboard').then((module) => ({ default: module.MemberDashboard })));
const MemberCalendar = lazy(() => import('./pages/member/MemberCalendar').then((module) => ({ default: module.MemberCalendar })));
const MemberFinances = lazy(() => import('./pages/member/MemberFinances').then((module) => ({ default: module.MemberFinances })));
const MemberProfile = lazy(() => import('./pages/member/MemberProfile').then((module) => ({ default: module.MemberProfile })));

const REALTIME_TABLES = new Set([
  'profiles',
  'events',
  'announcements',
  'attendance',
  'match_surveys',
  'match_lineup_configs',
  'match_lineup_slots',
  'game_results',
  'coin_wallets',
  'shop_purchases',
  'game_loadouts',
  'finances',
  'fee_collections',
  'fee_records'
]);

// Protected Route Component for Admin Role Check
const AdminRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAppStore();
  if (currentUser.role !== 'admin') {
    return <Navigate to="/member/dashboard" replace />;
  }
  return <>{children}</>;
};

const AuthenticatedRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuthSession();
  if (status === 'loading') return <PageLoading />;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const LoginRoute: React.FC = () => {
  const { status } = useAuthSession();
  const currentUser = useAppStore((state) => state.currentUser);
  if (status === 'loading') return <PageLoading />;
  if (status === 'authenticated') {
    const transitionStartedAt = Number(window.sessionStorage.getItem('goodminton-login-transition') || 0);
    const isCompletingLogin = transitionStartedAt > 0 && Date.now() - transitionStartedAt < 5000;
    if (isCompletingLogin) return <Login />;
    return <Navigate to={currentUser.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />;
  }
  return <Login />;
};

const PageLoading: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-emerald-700">
    載入中…
  </div>
);

const RealtimeDataSync: React.FC = () => {
  const fetchFromSupabase = useAppStore((state) => state.fetchFromSupabase);
  const userId = useAppStore(state => state.currentUser.id);
  const fetchAnnouncements = useAnnouncementStore(state => state.fetchAnnouncements);
  const resetAnnouncements = useAnnouncementStore(state => state.reset);
  const { status } = useAuthSession();

  useEffect(() => {
    resetAnnouncements();
    if (!getSupabaseConfig().isConfigured || status !== 'authenticated') return;

    let disposed = false;
    let refreshTimer: number | undefined;
    let refreshInFlight = false;
    let refreshQueued = false;

    const refresh = async () => {
      if (disposed) return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }

      refreshInFlight = true;
      const [result] = await Promise.all([fetchFromSupabase(), fetchAnnouncements()]);
      refreshInFlight = false;

      if (!result.success) {
        console.warn('Global refresh failed:', result.message);
      }

      if (refreshQueued && !disposed) {
        refreshQueued = false;
        scheduleRefresh();
      }
    };

    const scheduleRefresh = () => {
      if (disposed) return;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refresh(), 180);
    };

    // Load the authoritative database state before rendering stale local data.
    void refresh();

    // One schema-level channel covers application tables. The local
    // allow-list avoids unnecessary refreshes if more public tables are added.
    const channel = supabase
      .channel('goodminton-global-database-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (REALTIME_TABLES.has(payload.table)) scheduleRefresh();
      })
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime service ${status}:`, error);
        }
      });

    // Reconcile after a laptop wakes, a tab regains focus, or a Realtime event
    // was missed. Realtime remains the primary path; polling is only fallback.
    const fallbackInterval = window.setInterval(scheduleRefresh, 60_000);
    const handleFocus = () => scheduleRefresh();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
      resetAnnouncements();
    };
  }, [fetchFromSupabase, fetchAnnouncements, resetAnnouncements, userId, status]);

  return null;
};

export default function App() {

  return (
    <AuthSessionProvider>
      <RealtimeDataSync />
      <PwaInstallPrompt />
      <HashRouter>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Auth Entry */}
            <Route path="/login" element={<LoginRoute />} />

            {/* Protected App Layout */}
            <Route element={<AuthenticatedRouteGuard><Layout /></AuthenticatedRouteGuard>}>
          
          {/* Default Redirect */}
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />

          {/* Admin Routes */}
          <Route path="/admin/announcements" element={<AdminRouteGuard><AdminAnnouncements /></AdminRouteGuard>} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRouteGuard>
                <AdminDashboard />
              </AdminRouteGuard>
            }
          />
          <Route
            path="/admin/events"
            element={
              <AdminRouteGuard>
                <AdminEvents />
              </AdminRouteGuard>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <AdminRouteGuard>
                <AdminAttendance />
              </AdminRouteGuard>
            }
          />
          <Route
            path="/admin/members"
            element={
              <AdminRouteGuard>
                <AdminMembers />
              </AdminRouteGuard>
            }
          />
          <Route
            path="/admin/finances"
            element={
              <AdminRouteGuard>
                <AdminFinances />
              </AdminRouteGuard>
            }
          />

          {/* Member Routes */}
          <Route path="/member/dashboard" element={<MemberDashboard />} />
          <Route path="/member/calendar" element={<MemberCalendar />} />
          <Route path="/member/finances" element={<MemberFinances />} />
          <Route path="/member/profile" element={<MemberProfile />} />

            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthSessionProvider>
  );
}
