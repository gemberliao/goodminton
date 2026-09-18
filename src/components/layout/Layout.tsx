import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useAppStore } from '../../store/useAppStore';
import { SUPABASE_SYNC_ERROR_EVENT } from '../../lib/supabaseErrors';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncError, setSyncError] = useState('');
  const { currentUser } = useAppStore();

  useEffect(() => {
    const handleSyncError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (message) setSyncError(message);
    };

    window.addEventListener(SUPABASE_SYNC_ERROR_EVENT, handleSyncError);
    return () => window.removeEventListener(SUPABASE_SYNC_ERROR_EVENT, handleSyncError);
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const showSidebar = isAdmin;

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Navbar 
        onToggleSidebar={showSidebar ? () => setSidebarOpen(!sidebarOpen) : undefined} 
        showSidebarToggle={showSidebar}
      />

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto relative">
        {showSidebar && (
          <>
            <Sidebar 
              isOpen={sidebarOpen} 
              onCloseMobile={() => setSidebarOpen(false)} 
            />

            {/* Overlay backdrop for mobile menu */}
            {sidebarOpen && (
              <div 
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-20 bg-black/60 backdrop-blur-xs lg:hidden"
              />
            )}
          </>
        )}

        <main className="app-main flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>

      <BottomNav />

      {syncError && (
        <div className="fixed z-[70] right-3 bottom-20 md:bottom-4 w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 shadow-xl" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">資料同步失敗</p>
              <p className="mt-1 break-words text-xs leading-relaxed">{syncError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSyncError('')}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 hover:text-rose-700"
              aria-label="關閉同步錯誤"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
