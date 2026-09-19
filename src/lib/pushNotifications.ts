import { getSupabaseConfig, supabase } from './supabase';

export type PushNotificationState = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
};

export type PushNotificationRecord = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
};

type NavigatorWithBadging = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type GoodmintonServiceWorkerMessage =
  | { type: 'GOODMINTON_BADGE_SYNC'; unreadCount: number }
  | { type: 'GOODMINTON_NOTIFICATION_READ'; notificationId: string }
  | { type: 'GOODMINTON_NOTIFICATIONS_READ_ALL' };

const getPublicKey = () => (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();

const isSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

const getRegistration = async () => {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (existing) return existing;
  if (import.meta.env.DEV) return null;
  return Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
  ]);
};

const postServiceWorkerMessage = async (message: GoodmintonServiceWorkerMessage): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await getRegistration();
  const worker = registration?.active || navigator.serviceWorker.controller;
  worker?.postMessage(message);
};

const syncAppBadge = async (unreadCount: number): Promise<void> => {
  const badgingNavigator = navigator as NavigatorWithBadging;
  if (unreadCount > 0) {
    if (badgingNavigator.setAppBadge) {
      try {
        await badgingNavigator.setAppBadge(unreadCount);
      } catch {
        // Keep a dot fallback on platforms that expose Badging without numbers.
        await badgingNavigator.setAppBadge().catch(() => undefined);
      }
    }
  } else {
    await badgingNavigator.clearAppBadge?.().catch(() => undefined);
  }
  await postServiceWorkerMessage({ type: 'GOODMINTON_BADGE_SYNC', unreadCount });
};

export const getPushNotificationState = async (): Promise<PushNotificationState> => {
  if (!isSupported()) {
    return { supported: false, configured: Boolean(getPublicKey()), permission: 'unsupported', subscribed: false };
  }
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return {
    supported: true,
    configured: Boolean(getPublicKey() && getSupabaseConfig().isConfigured),
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
};

export const enablePushNotifications = async (userId: string): Promise<void> => {
  const publicKey = getPublicKey();
  if (!isSupported()) throw new Error('此瀏覽器不支援 App 推播通知。');
  if (!publicKey || !getSupabaseConfig().isConfigured) throw new Error('推播服務尚未完成設定。');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知權限未開啟，請到瀏覽器或手機設定允許通知。');

  const registration = await getRegistration();
  if (!registration) throw new Error('App 背景服務尚未啟動，請重新整理後再試。');
  let subscription = await registration.pushManager.getSubscription();
  const createdNow = !subscription;
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;
  if (!p256dh || !auth) {
    if (createdNow) await subscription.unsubscribe();
    throw new Error('無法讀取裝置推播金鑰。');
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    expiration_time: subscription.expirationTime,
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' });

  if (error) {
    if (createdNow) await subscription.unsubscribe();
    throw new Error(error.code === 'PGRST205' || error.code === '42P01'
      ? '通知資料庫尚未啟用。'
      : `通知訂閱失敗：${error.message}`);
  }
};

export const disablePushNotifications = async (userId: string): Promise<void> => {
  if (!isSupported()) return;
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
  await clearAppBadge();
};

export const sendTestPushNotification = async (): Promise<void> => {
  const { error } = await supabase.rpc('goodminton_send_test_notification');
  if (error) throw new Error(`測試通知排程失敗：${error.message}`);
};

export const refreshUnreadPushCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('push_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) return 0;
  const unreadCount = count || 0;
  await syncAppBadge(unreadCount);
  return unreadCount;
};

export const fetchRecentPushNotifications = async (userId: string): Promise<PushNotificationRecord[]> => {
  const { data, error } = await supabase
    .from('push_notifications')
    .select('id,kind,title,body,url,created_at,read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(6);
  if (error) return [];
  return (data || []) as PushNotificationRecord[];
};

export const markPushNotificationRead = async (userId: string, notificationId: string): Promise<void> => {
  const { error } = await supabase.from('push_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (!error) {
    await postServiceWorkerMessage({ type: 'GOODMINTON_NOTIFICATION_READ', notificationId });
  }
};

export const markAllPushNotificationsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase.from('push_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (!error) {
    await postServiceWorkerMessage({ type: 'GOODMINTON_NOTIFICATIONS_READ_ALL' });
    await clearAppBadge();
  }
};

export const markOpenedPushNotification = async (userId: string): Promise<void> => {
  const url = new URL(window.location.href);
  const notificationId = url.searchParams.get('notification');
  if (!notificationId) return;

  await markPushNotificationRead(userId, notificationId);
  url.searchParams.delete('notification');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  await refreshUnreadPushCount(userId);
};

export const clearAppBadge = async (): Promise<void> => {
  await (navigator as NavigatorWithBadging).clearAppBadge?.().catch(() => undefined);
  await postServiceWorkerMessage({ type: 'GOODMINTON_BADGE_SYNC', unreadCount: 0 });
};
