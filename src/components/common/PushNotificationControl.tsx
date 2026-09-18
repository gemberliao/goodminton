import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, LoaderCircle, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  disablePushNotifications,
  enablePushNotifications,
  fetchRecentPushNotifications,
  getPushNotificationState,
  markAllPushNotificationsRead,
  markOpenedPushNotification,
  markPushNotificationRead,
  refreshUnreadPushCount,
  sendTestPushNotification,
  type PushNotificationRecord,
  type PushNotificationState,
} from '../../lib/pushNotifications';

type Props = { userId: string };

const initialState: PushNotificationState = {
  supported: true,
  configured: true,
  permission: 'default',
  subscribed: false,
};

export const PushNotificationControl: React.FC<Props> = ({ userId }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState(initialState);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<PushNotificationRecord[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [nextState, nextUnreadCount, recentNotifications] = await Promise.all([
      getPushNotificationState(),
      refreshUnreadPushCount(userId),
      fetchRecentPushNotifications(userId),
    ]);
    setState(nextState);
    setUnreadCount(nextUnreadCount);
    setNotifications(recentNotifications);
  }, [userId]);

  useEffect(() => {
    void refresh();
    void markOpenedPushNotification(userId);

    const channel = supabase
      .channel(`goodminton-push-notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'push_notifications',
        filter: `user_id=eq.${userId}`,
      }, () => void Promise.all([
        refreshUnreadPushCount(userId),
        fetchRecentPushNotifications(userId),
      ]).then(([count, recent]) => {
        setUnreadCount(count);
        setNotifications(recent);
      }))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [refresh, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const enable = async () => {
    setIsBusy(true);
    setMessage('');
    try {
      await enablePushNotifications(userId);
      setMessage('通知已開啟，這台裝置會收到球隊消息。');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '通知開啟失敗。');
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async () => {
    setIsBusy(true);
    setMessage('');
    try {
      await disablePushNotifications(userId);
      setMessage('已關閉這台裝置的通知。');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '通知關閉失敗。');
    } finally {
      setIsBusy(false);
    }
  };

  const sendTest = async () => {
    setIsBusy(true);
    setMessage('');
    try {
      await sendTestPushNotification();
      setMessage('測試通知已送出，請稍候幾秒。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '測試通知送出失敗。');
    } finally {
      setIsBusy(false);
    }
  };

  const openNotification = async (notification: PushNotificationRecord) => {
    await markPushNotificationRead(userId, notification.id);
    setIsOpen(false);
    await refresh();
    navigate(notification.url.replace(/^#/, '') || '/member/dashboard');
  };

  const markAllRead = async () => {
    await markAllPushNotificationsRead(userId);
    await refresh();
  };

  const statusText = !state.supported
    ? '此瀏覽器不支援推播'
    : !state.configured
      ? '管理員尚未完成推播設定'
      : state.permission === 'denied'
        ? '通知權限已被封鎖'
        : state.subscribed
          ? '這台裝置已開啟通知'
          : '尚未開啟通知';

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-95 ${
          state.subscribed
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
        }`}
        title={statusText}
        aria-label={`通知：${statusText}`}
        aria-expanded={isOpen}
      >
        {state.permission === 'denied' ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-3 right-3 top-[4.5rem] z-[80] max-h-[calc(100dvh-5.25rem)] w-auto overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[min(38rem,calc(100dvh-5.5rem))] sm:w-[min(22rem,calc(100vw-1.5rem))]">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${state.subscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {state.subscribed ? <Check className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900">App 通知</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{statusText}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="關閉通知設定">
              <X className="h-4 w-4" />
            </button>
          </div>

          {state.permission === 'denied' && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800">
              請到 Chrome 網站設定或手機「設定 → 通知 → GOODMINTON」允許通知。
            </p>
          )}
          {message && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-700">{message}</p>}

          <div className="mt-3 grid gap-2">
            {!state.subscribed && state.supported && state.configured && state.permission !== 'denied' && (
              <button type="button" disabled={isBusy} onClick={() => void enable()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">
                {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                開啟通知
              </button>
            )}
            {state.subscribed && (
              <>
                <button type="button" disabled={isBusy} onClick={() => void sendTest()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">
                  {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  發送測試通知
                </button>
                <button type="button" disabled={isBusy} onClick={() => void disable()} className="min-h-10 rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-60">
                  關閉這台裝置的通知
                </button>
              </>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">最近通知</p>
                {unreadCount > 0 && (
                  <button type="button" onClick={() => void markAllRead()} className="text-xs font-bold text-emerald-700 hover:text-emerald-600">
                    全部已讀
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${notification.read_at ? 'border-transparent bg-slate-50' : 'border-emerald-200 bg-emerald-50'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-800">{notification.title}</p>
                        {notification.body && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{notification.body}</p>}
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                          {new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(notification.created_at))}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
