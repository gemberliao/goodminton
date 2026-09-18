import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { PWA_UPDATE_EVENT } from '../../pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'goodminton-install-prompt-dismissed-at';
const SHOW_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const PwaInstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    const mayShow = !dismissedAt || Date.now() - dismissedAt > SHOW_AGAIN_AFTER_MS;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (mayShow && !isStandalone()) setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallEvent(null);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleUpdate = () => setUpdateAvailable(true);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);

    if (mayShow && isIos() && !isStandalone()) setShowIosHelp(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  const dismissInstall = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setInstallEvent(null);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  const update = async () => {
    const registration = await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    if (!registration?.waiting) window.location.reload();
  };

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[120] mx-auto flex max-w-md flex-col gap-2 md:bottom-4">
      {!isOnline && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl" role="status">
          <WifiOff className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm font-bold">目前離線，將顯示上次載入的內容。</p>
        </div>
      )}

      {updateAvailable && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-300 bg-white px-4 py-3 shadow-xl" role="status">
          <RefreshCw className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 text-sm font-bold text-slate-800">新版 GOODMINTON 已準備好</p>
          <button type="button" onClick={() => void update()} className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white active:scale-95">
            更新
          </button>
        </div>
      )}

      {(installEvent || showIosHelp) && (
        <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" role="dialog" aria-label="安裝 GOODMINTON App">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">G</div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900">安裝 GOODMINTON App</p>
              {installEvent ? (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">加到手機主畫面，下次就能像一般 App 一樣開啟。</p>
              ) : (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  點 Safari 的 <Share className="mx-0.5 inline h-4 w-4 align-[-3px] text-emerald-600" /> 分享，再選「加入主畫面」。
                </p>
              )}
            </div>
            <button type="button" onClick={dismissInstall} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="稍後再說">
              <X className="h-5 w-5" />
            </button>
          </div>
          {installEvent && (
            <button type="button" onClick={() => void install()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm active:scale-[0.98]">
              <Download className="h-5 w-5" />
              安裝 App
            </button>
          )}
        </div>
      )}
    </div>
  );
};
