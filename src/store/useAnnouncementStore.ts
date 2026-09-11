import { create } from 'zustand';
import { getSupabaseConfig, supabase } from '../lib/supabase';
import { describeSupabaseError, type SyncResult } from '../lib/supabaseErrors';
import type { Announcement } from '../types';
import { useAppStore } from './useAppStore';

interface AnnouncementState {
  announcement: Announcement | null;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  fetchAnnouncements: () => Promise<void>;
  saveAnnouncement: (body: string) => Promise<SyncResult>;
  reset: () => void;
}

let requestVersion = 0;
const fields = 'id,body,updated_at';

export function isAnnouncementUnread(
  announcement: Announcement | null,
  userId: string,
  viewedByUser: Record<string, string>
): boolean {
  return Boolean(
    announcement?.body.trim()
    && userId
    && viewedByUser?.[userId] !== announcement.updated_at
  );
}

function messageFor(error: unknown, operation: string): string {
  const code = (error as { code?: string })?.code;
  if (code === 'PGRST205' || code === '42P01') return '公告同步尚未啟用，目前可先試填文字。';
  return describeSupabaseError(operation, error);
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  announcement: null,
  isLoading: false,
  hasLoaded: false,
  error: null,
  reset: () => {
    requestVersion++;
    set({ announcement: null, isLoading: false, hasLoaded: false, error: null });
  },
  fetchAnnouncements: async () => {
    const version = ++requestVersion;
    const userId = useAppStore.getState().currentUser.id;
    if (!userId || !getSupabaseConfig().isConfigured) return;
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.from('announcements').select(fields).eq('id', 'team').maybeSingle();
      if (version !== requestVersion || userId !== useAppStore.getState().currentUser.id) return;
      if (error) throw error;
      set({ announcement: data as Announcement | null, hasLoaded: true, isLoading: false, error: null });
    } catch (error) {
      if (version !== requestVersion || userId !== useAppStore.getState().currentUser.id) return;
      set({ isLoading: false, error: messageFor(error, '公告載入') });
    }
  },
  saveAnnouncement: async (body) => {
    const user = useAppStore.getState().currentUser;
    if (!user.id || user.role !== 'admin' || user.status !== 'approved') {
      return { success: false, message: '只有管理員可以儲存公告。' };
    }
    if (body.trim().length > 5000) return { success: false, message: '公告內容最多 5,000 字。' };
    if (!getSupabaseConfig().isConfigured) return { success: false, message: '系統服務尚未完成設定。' };
    try {
      const { data, error } = await supabase.from('announcements')
        .upsert({ id: 'team', body: body.trim() }, { onConflict: 'id' })
        .select(fields).single();
      if (error) throw error;
      if (user.id === useAppStore.getState().currentUser.id) {
        requestVersion++;
        set({ announcement: data as Announcement, hasLoaded: true, error: null, isLoading: false });
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: messageFor(error, '公告儲存') };
    }
  }
}));
