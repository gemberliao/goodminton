import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getSupabaseConfig } from '../lib/supabase';
import { reportSupabaseError, SyncResult } from '../lib/supabaseErrors';
import { isEventPast, isFeeCollectionOpen } from '../utils/dateUtils';
import { 
  Profile, 
  BadmintonEvent, 
  AttendanceRecord, 
  FinanceLedger, 
  FeeCollection, 
  FeeRecord, 
  AttendanceStatus,
  MatchDiscipline,
  MatchSurveyResponse,
  MatchPointSlot,
  MatchLineupConfig
} from '../types';

// Standard UUID Generator (RFC 4122 v4)
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Deduplication Helper for State Lists
export function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item) return false;
    const id = item.id;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Supabase Async Sync Helpers
async function syncProfileInsert(profile: Profile): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const cleanUsername = profile.username && profile.username.trim() !== ''
      ? profile.username.trim().toLowerCase()
      : `user_${profile.id.replace(/-/g, '').slice(0, 8)}`;

    const row: Record<string, any> = {
      id: profile.id,
      auth_user_id: profile.auth_user_id || null,
      username: cleanUsername,
      name: profile.name,
      role: profile.role,
      level: profile.level,
      gender: profile.gender || 'male',
      status: profile.status || (profile.role === 'admin' ? 'approved' : 'pending'),
      phone: profile.phone || null,
      avatar_url: profile.avatar_url || null,
      created_at: profile.created_at || new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert([row], { onConflict: 'id' });
    if (error) return reportSupabaseError('隊員新增', error);
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('隊員新增', error);
  }
}

async function syncProfileUpdate(id: string, updates: Partial<Profile>, username?: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.username !== undefined) payload.username = updates.username.trim().toLowerCase();
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.level !== undefined) payload.level = updates.level;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.created_at !== undefined) payload.created_at = updates.created_at;

    if (Object.keys(payload).length === 0) return { success: true };

    // 1. Try update by ID
    let { data: updatedRows, error } = await supabase.from('profiles').update(payload).eq('id', id).select();

    // If no row matched the client ID, try the normalized username. Do not hide
    // a schema/RLS error behind a smaller fallback payload.
    if (!error && (!updatedRows || updatedRows.length === 0) && username) {
      const byUsername = await supabase
        .from('profiles')
        .update(payload)
        .eq('username', username.trim().toLowerCase())
        .select('id');
      error = byUsername.error;
      updatedRows = byUsername.data;
    }

    if (error) return reportSupabaseError('隊員更新', error);
    if (!updatedRows || updatedRows.length === 0) {
      return reportSupabaseError('隊員更新', { code: 'PGRST116', message: `找不到 id=${id} 的遠端 profiles 資料` });
    }
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('隊員更新', error);
  }
}

async function syncProfileDelete(id: string, username?: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    // Child rows are handled by the database ON DELETE CASCADE/SET NULL rules.
    const { data: dData, error: idErr } = await supabase.from('profiles').delete().eq('id', id).select();
    if (idErr) return reportSupabaseError('隊員刪除', idErr);

    // Delete is idempotent. Only use username when the ID was not present.
    if ((!dData || dData.length === 0) && username) {
      const byUsername = await supabase
        .from('profiles')
        .delete()
        .eq('username', username.trim().toLowerCase())
        .select('id');
      if (byUsername.error) return reportSupabaseError('隊員刪除', byUsername.error);
    }
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('隊員刪除', error);
  }
}

async function syncEventInsert(event: BadmintonEvent): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('events').upsert([event], { onConflict: 'id' });
    return error ? reportSupabaseError('活動寫入', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('活動寫入', error);
  }
}

async function syncEventDelete(id: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('events').delete().eq('id', id);
    return error ? reportSupabaseError('活動刪除', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('活動刪除', error);
  }
}

async function syncFinanceInsert(finance: FinanceLedger): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('finances').upsert([finance], { onConflict: 'id' });
    return error ? reportSupabaseError('財務新增', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('財務新增', error);
  }
}

async function syncFinanceUpdate(id: string, updates: Partial<FinanceLedger>): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('finances').update(updates).eq('id', id);
    return error ? reportSupabaseError('財務更新', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('財務更新', error);
  }
}

async function syncFinanceDelete(id: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('finances').delete().eq('id', id);
    return error ? reportSupabaseError('財務刪除', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('財務刪除', error);
  }
}

async function syncFeeCollectionDelete(collectionId: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('fee_collections').delete().eq('id', collectionId);
    return error ? reportSupabaseError('收費專案刪除', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('收費專案刪除', error);
  }
}

async function syncFeeCollectionUpdate(collectionId: string, updates: Partial<FeeCollection>): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('fee_collections').update(updates).eq('id', collectionId);
    return error ? reportSupabaseError('收費專案更新', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('收費專案更新', error);
  }
}

async function syncFeeCollectionInsert(collection: FeeCollection, records: FeeRecord[]): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error: cErr } = await supabase
      .from('fee_collections')
      .upsert([collection], { onConflict: 'id' });
    if (cErr) return reportSupabaseError('收費專案新增', cErr);

    if (records.length > 0) {
      const { error: rErr } = await supabase
        .from('fee_records')
        .upsert(records, { onConflict: 'collection_id,user_id' });
      if (rErr) {
        // The collection and its records form one logical operation. If the
        // second request fails, remove the already-created parent so a reload
        // cannot reveal a half-created collection.
        const { error: rollbackError } = await supabase
          .from('fee_collections')
          .delete()
          .eq('id', collection.id);
        if (rollbackError) {
          console.error('Unable to roll back the incomplete fee collection:', rollbackError);
        }
        return reportSupabaseError('繳費明細新增', rErr);
      }
    }
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('收費專案新增', error);
  }
}

async function syncFeeRecordInsert(records: FeeRecord[]): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured || records.length === 0) return { success: true };
  try {
    // Use INSERT instead of UPSERT so an existing paid record can never be
    // overwritten when an administrator adds members to a collection.
    const { error } = await supabase.from('fee_records').insert(records);
    return error ? reportSupabaseError('新增收費隊員', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('新增收費隊員', error);
  }
}

async function syncFeeRecordUpdate(recordId: string, updates: Partial<FeeRecord>): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase
      .from('fee_records')
      .update(updates)
      .eq('id', recordId);
    return error ? reportSupabaseError('繳費明細更新', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('繳費明細更新', error);
  }
}

async function syncFeeCollectionClose(collectionId: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase
      .from('fee_collections')
      .update({ status: 'closed' })
      .eq('id', collectionId);
    return error ? reportSupabaseError('收費專案結案', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('收費專案結案', error);
  }
}

async function syncAttendanceUpsert(record: AttendanceRecord): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase
      .from('attendance')
      .upsert([record], { onConflict: 'user_id,event_id' });
    return error ? reportSupabaseError('出席紀錄寫入', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('出席紀錄寫入', error);
  }
}

async function syncMatchSurveyUpsert(survey: MatchSurveyResponse): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const { error } = await supabase.from('match_surveys').upsert([survey], { onConflict: 'event_id,user_id' });
    return error ? reportSupabaseError('出賽意願寫入', error) : { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('出賽意願寫入', error);
  }
}

async function syncMatchLineupUpsert(eventId: string, config: MatchLineupConfig, slots: MatchPointSlot[]): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const previousConfigResult = await supabase
      .from('match_lineup_configs')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    if (previousConfigResult.error) return reportSupabaseError('舊排點設定讀取', previousConfigResult.error);
    const previousSlotsResult = await supabase
      .from('match_lineup_slots')
      .select('*')
      .eq('event_id', eventId);
    if (previousSlotsResult.error) return reportSupabaseError('舊排點名單讀取', previousSlotsResult.error);

    const restorePreviousLineup = async () => {
      if (previousConfigResult.data) {
        await supabase.from('match_lineup_configs').upsert([previousConfigResult.data], { onConflict: 'event_id' });
      } else {
        await supabase.from('match_lineup_configs').delete().eq('event_id', eventId);
      }
      await supabase.from('match_lineup_slots').delete().eq('event_id', eventId);
      if (previousSlotsResult.data?.length) {
        await supabase.from('match_lineup_slots').upsert(previousSlotsResult.data, { onConflict: 'id' });
      }
    };

    const configResult = await supabase.from('match_lineup_configs').upsert([config], { onConflict: 'event_id' });
    if (configResult.error) return reportSupabaseError('排點設定寫入', configResult.error);

    const deleteResult = await supabase.from('match_lineup_slots').delete().eq('event_id', eventId);
    if (deleteResult.error) {
      await restorePreviousLineup();
      return reportSupabaseError('舊排點刪除', deleteResult.error);
    }

    if (slots.length > 0) {
      const slotsResult = await supabase.from('match_lineup_slots').upsert(slots, { onConflict: 'id' });
      if (slotsResult.error) {
        await restorePreviousLineup();
        return reportSupabaseError('排點名單寫入', slotsResult.error);
      }
    }
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('排點名單寫入', error);
  }
}

async function syncMatchLineupDelete(eventId: string): Promise<SyncResult> {
  if (!getSupabaseConfig().isConfigured) return { success: true };
  try {
    const previousSlotsResult = await supabase
      .from('match_lineup_slots')
      .select('*')
      .eq('event_id', eventId);
    if (previousSlotsResult.error) return reportSupabaseError('排點名單讀取', previousSlotsResult.error);

    const slotsResult = await supabase.from('match_lineup_slots').delete().eq('event_id', eventId);
    if (slotsResult.error) return reportSupabaseError('排點名單刪除', slotsResult.error);
    const configResult = await supabase.from('match_lineup_configs').delete().eq('event_id', eventId);
    if (configResult.error) {
      if (previousSlotsResult.data?.length) {
        await supabase.from('match_lineup_slots').upsert(previousSlotsResult.data, { onConflict: 'id' });
      }
      return reportSupabaseError('排點設定刪除', configResult.error);
    }
    return { success: true };
  } catch (error: unknown) {
    return reportSupabaseError('排點名單刪除', error);
  }
}

interface AppState {
  currentUser: Profile;
  profiles: Profile[];
  events: BadmintonEvent[];
  attendance: AttendanceRecord[];
  finances: FinanceLedger[];
  feeCollections: FeeCollection[];
  feeRecords: FeeRecord[];
  matchSurveys: MatchSurveyResponse[];
  matchLineupSlots: MatchPointSlot[];
  matchLineupConfigs: Record<string, MatchLineupConfig>; // event_id -> config
  viewedEventIdsByUser: Record<string, string[]>;
  viewedFeeRecordIdsByUser: Record<string, string[]>;
  viewedAnnouncementUpdatedAtByUser: Record<string, string>;
  
  // Notification / View Tracking
  markEventsAsViewed: (userId: string) => void;
  markFinancesAsViewed: (userId: string) => void;
  markAnnouncementAsViewed: (userId: string, updatedAt: string) => void;
  
  // Actions
  setCurrentUserRole: (role: 'admin' | 'member') => void;
  setCurrentUserById: (userId: string) => void;
  setCurrentUserProfile: (profile: Profile) => void;
  addProfile: (profile: Omit<Profile, 'id' | 'created_at'> & { id?: string }) => Promise<{ profile: Profile; sync: SyncResult }>;
  updateProfile: (id: string, updates: Partial<Profile>, username?: string) => Promise<{ success: boolean; message?: string }>;
  deleteProfile: (id: string, username?: string) => Promise<{ success: boolean; message?: string }>;
  
  // Events
  addEvent: (event: Omit<BadmintonEvent, 'id' | 'created_at'>) => Promise<SyncResult>;
  updateEvent: (id: string, updates: Partial<BadmintonEvent>) => Promise<SyncResult>;
  deleteEvent: (id: string) => Promise<SyncResult>;
  
  // Attendance
  toggleAttendance: (userId: string, eventId: string, status: AttendanceStatus, remarks?: string) => Promise<SyncResult>;

  // Match Surveys & Lineup System (出賽意願調查與 5 點排單管理)
  saveMatchSurvey: (survey: Omit<MatchSurveyResponse, 'id' | 'updated_at'>) => Promise<SyncResult>;
  saveMatchLineup: (eventId: string, slots: MatchPointSlot[], isPublished: boolean, notes?: string) => Promise<SyncResult>;
  deleteMatchLineup: (eventId: string) => Promise<SyncResult>;
  autoGenerateFairLineup: (eventId: string) => MatchPointSlot[];
  getMemberMatchStats: (userId: string, targetEventId?: string) => {
    historicalPlayedCount: number;
    currentEventSlotCount: number;
    survey?: MatchSurveyResponse;
  };
  
  // Finances
  addFinance: (finance: Omit<FinanceLedger, 'id' | 'created_at'>) => Promise<SyncResult>;
  updateFinance: (id: string, updates: Partial<FinanceLedger>) => Promise<SyncResult>;
  deleteFinance: (id: string) => Promise<SyncResult>;
  
  // Fee Collections & Split Engine
  addFeeCollection: (
    title: string, 
    c_type: 'fixed' | 'split', 
    totalAmount: number, 
    amountPerPerson: number, 
    targetUserIds: string[], 
    dueDate?: string
  ) => Promise<SyncResult>;
  updateFeeCollection: (id: string, updates: Partial<FeeCollection>) => Promise<SyncResult>;
  addUsersToFeeCollection: (collectionId: string, userIds: string[]) => Promise<SyncResult>;
  deleteFeeCollection: (id: string) => Promise<SyncResult>;
  reportFeePayment: (recordId: string, notes?: string) => Promise<SyncResult>;
  confirmFeePayment: (recordId: string) => Promise<SyncResult>;
  rejectFeePayment: (recordId: string, reason?: string) => Promise<SyncResult>;
  toggleFeePaidStatus: (recordId: string, isPaid: boolean) => Promise<SyncResult>;
  closeFeeCollection: (collectionId: string) => Promise<SyncResult>;
  
  // Remote data refresh
  fetchFromSupabase: () => Promise<{ success: boolean; message: string }>;
}

const emptyProfile: Profile = {
  id: '',
  username: '',
  name: '',
  level: '初級',
  role: 'member',
  gender: 'male',
  status: 'pending',
  created_at: '',
};

const initialProfiles: Profile[] = [];

const initialEvents: BadmintonEvent[] = [];
const initialAttendance: AttendanceRecord[] = [];
const initialMatchSurveys: MatchSurveyResponse[] = [];

const initialMatchLineupSlots: MatchPointSlot[] = [];
const initialMatchLineupConfigs: Record<string, MatchLineupConfig> = {};

const initialFinances: FinanceLedger[] = [];
const initialFeeCollections: FeeCollection[] = [];
const initialFeeRecords: FeeRecord[] = [];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: emptyProfile,
      profiles: initialProfiles,
      events: initialEvents,
      attendance: initialAttendance,
      finances: initialFinances,
      feeCollections: initialFeeCollections,
      feeRecords: initialFeeRecords,
      matchSurveys: initialMatchSurveys,
      matchLineupSlots: initialMatchLineupSlots,
      matchLineupConfigs: initialMatchLineupConfigs,
      viewedEventIdsByUser: {},
      viewedFeeRecordIdsByUser: {},
      viewedAnnouncementUpdatedAtByUser: {},

      markEventsAsViewed: (userId: string) => {
        if (!userId) return;
        const currentEvents = get().events;
        const currentEventIds = currentEvents.map((e) => e.id);
        set((state) => ({
          viewedEventIdsByUser: {
            ...state.viewedEventIdsByUser,
            [userId]: Array.from(new Set([...(state.viewedEventIdsByUser?.[userId] || []), ...currentEventIds]))
          }
        }));
      },

      markFinancesAsViewed: (userId: string) => {
        if (!userId) return;
        const currentFeeRecords = get().feeRecords.filter((r) => r.user_id === userId);
        const currentRecordIds = currentFeeRecords.map((r) => r.id);
        set((state) => ({
          viewedFeeRecordIdsByUser: {
            ...state.viewedFeeRecordIdsByUser,
            [userId]: Array.from(new Set([...(state.viewedFeeRecordIdsByUser?.[userId] || []), ...currentRecordIds]))
          }
        }));
      },

      markAnnouncementAsViewed: (userId: string, updatedAt: string) => {
        if (!userId || !updatedAt) return;
        set((state) => ({
          viewedAnnouncementUpdatedAtByUser: {
            ...state.viewedAnnouncementUpdatedAtByUser,
            [userId]: updatedAt
          }
        }));
      },

      setCurrentUserRole: (role) => {
        const { profiles, currentUser } = get();
        const matched = profiles.find(p => p.role === role) || {
          ...currentUser,
          role
        };
        set({ currentUser: matched });
      },

      setCurrentUserById: (userId) => {
        const { profiles } = get();
        const matched = profiles.find(p => p.id === userId);
        if (matched) {
          set({ currentUser: matched });
        }
      },

      setCurrentUserProfile: (profile) => {
        const safeProfile: Profile = { ...profile };
        set((state) => ({
          currentUser: safeProfile,
          profiles: deduplicateById([
            safeProfile,
            ...state.profiles.filter((p) =>
              p.id !== safeProfile.id &&
              p.username?.toLowerCase() !== safeProfile.username?.toLowerCase()
            )
          ])
        }));
      },

      addProfile: async (newProfile) => {
        const created: Profile = {
          ...newProfile,
          id: newProfile.id || generateUUID(),
          status: newProfile.status || (newProfile.role === 'admin' ? 'approved' : 'pending'),
          created_at: new Date().toISOString()
        };
        set((state) => ({
          profiles: deduplicateById([...state.profiles, created])
        }));
        const sync = await syncProfileInsert(created);
        if (!sync.success) {
          set((state) => ({
            profiles: state.profiles.filter((profile) => profile.id !== created.id)
          }));
        }
        return { profile: created, sync };
      },

      updateProfile: async (id, updates, username) => {
        const profileToUpdate = get().profiles.find(p => p.id === id || (username && p.username?.toLowerCase() === username.toLowerCase()));
        const targetUsername = username || profileToUpdate?.username;
        const previousCurrentUser = get().currentUser;

        set((state) => ({
          profiles: state.profiles.map((p) => {
            if (p.id === id || (targetUsername && p.username?.toLowerCase() === targetUsername.toLowerCase())) {
              return { ...p, ...updates };
            }
            return p;
          }),
          currentUser: (state.currentUser.id === id || (targetUsername && state.currentUser.username?.toLowerCase() === targetUsername.toLowerCase()))
            ? { ...state.currentUser, ...updates }
            : state.currentUser
        }));
        const sync = await syncProfileUpdate(id, updates, targetUsername);
        if (!sync.success && profileToUpdate) {
          set((state) => ({
            profiles: state.profiles.map((profile) =>
              profile.id === profileToUpdate.id ? profileToUpdate : profile
            ),
            currentUser: previousCurrentUser.id === profileToUpdate.id
              ? previousCurrentUser
              : state.currentUser
          }));
        }
        return sync;
      },

      deleteProfile: async (id: string, username?: string) => {
        const previousState = get();
        const profileToDelete = previousState.profiles.find(p => p.id === id || (username && p.username === username));
        const targetUsername = username || profileToDelete?.username;

        set((state) => {
          const remainingProfiles = state.profiles.filter((p) => p.id !== id && (targetUsername ? p.username !== targetUsername : true));
          const nextUser = state.currentUser.id === id || (targetUsername && state.currentUser.username === targetUsername)
            ? (remainingProfiles[0] || state.currentUser) 
            : state.currentUser;
          return {
            profiles: remainingProfiles,
            currentUser: nextUser,
            attendance: state.attendance.filter(a => a.user_id !== id),
            feeRecords: state.feeRecords.filter(r => r.user_id !== id),
            matchSurveys: state.matchSurveys.filter(s => s.user_id !== id)
          };
        });

        const sync = await syncProfileDelete(id, targetUsername);
        if (!sync.success) {
          set({
            profiles: previousState.profiles,
            currentUser: previousState.currentUser,
            attendance: previousState.attendance,
            feeRecords: previousState.feeRecords,
            matchSurveys: previousState.matchSurveys
          });
        }
        return sync;
      },

      addEvent: async (newEvent) => {
        const created: BadmintonEvent = {
          ...newEvent,
          id: generateUUID(),
          created_at: new Date().toISOString()
        };
        set((state) => ({
          events: deduplicateById([created, ...state.events])
        }));
        const sync = await syncEventInsert(created);
        if (!sync.success) {
          set((state) => ({
            events: state.events.filter((event) => event.id !== created.id)
          }));
        }
        return sync;
      },

      updateEvent: async (id, updates) => {
        const previousEvent = get().events.find((event) => event.id === id);
        if (!previousEvent) {
          return { success: false, message: '找不到要更新的活動，請重新整理後再試。' };
        }
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e))
        }));
        const existing = get().events.find(e => e.id === id);
        const sync = existing
          ? await syncEventInsert(existing)
          : { success: false, message: '找不到要更新的活動，請重新整理後再試。' };
        if (!sync.success) {
          set((state) => ({
            events: state.events.map((event) => event.id === id ? previousEvent : event)
          }));
        }
        return sync;
      },

      deleteEvent: async (id) => {
        const previousState = get();
        const eventToDelete = previousState.events.find((event) => event.id === id);
        if (!eventToDelete) {
          return { success: false, message: '找不到要刪除的活動，請重新整理後再試。' };
        }
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
          attendance: state.attendance.filter((a) => a.event_id !== id),
          matchSurveys: state.matchSurveys.filter((survey) => survey.event_id !== id),
          matchLineupSlots: state.matchLineupSlots.filter((slot) => slot.event_id !== id),
          matchLineupConfigs: Object.fromEntries(
            Object.entries(state.matchLineupConfigs).filter(([eventId]) => eventId !== id)
          )
        }));
        const sync = await syncEventDelete(id);
        if (!sync.success) {
          set({
            events: previousState.events,
            attendance: previousState.attendance,
            matchSurveys: previousState.matchSurveys,
            matchLineupSlots: previousState.matchLineupSlots,
            matchLineupConfigs: previousState.matchLineupConfigs
          });
        }
        return sync;
      },

      toggleAttendance: async (userId, eventId, status, remarks) => {
        const currentState = get();
        const targetEvent = currentState.events.find((event) => event.id === eventId);
        if (currentState.currentUser.role !== 'admin' && targetEvent && isEventPast(targetEvent)) {
          console.warn('Attendance submission is closed for event:', eventId);
          return { success: false, message: '活動已截止，無法再變更出席狀態。' };
        }

        // If registering to attend, ensure event is not already full
        if (status === 'attending') {
          if (targetEvent && targetEvent.max_participants && targetEvent.max_participants > 0) {
            const currentRecord = currentState.attendance.find(
              (a) => a.user_id === userId && a.event_id === eventId
            );
            // Only check if user is not already attending
            if (currentRecord?.status !== 'attending') {
              const currentAttendingCount = currentState.attendance.filter(
                (a) => a.event_id === eventId && a.status === 'attending'
              ).length;
              if (currentAttendingCount >= targetEvent.max_participants) {
                console.warn('Registration full for event:', eventId);
                return { success: false, message: '活動名額已滿，無法報名。' };
              }
            }
          }
        }

        const previousAttendance = currentState.attendance;
        const existingIndex = previousAttendance.findIndex(
          (record) => record.user_id === userId && record.event_id === eventId
        );
        const updatedAttendance = [...previousAttendance];
        const updatedRecord: AttendanceRecord = existingIndex >= 0
          ? {
              ...updatedAttendance[existingIndex],
              status,
              remarks: remarks !== undefined ? remarks : updatedAttendance[existingIndex].remarks
            }
          : {
              id: generateUUID(),
              user_id: userId,
              event_id: eventId,
              status,
              remarks: remarks || '',
              created_at: new Date().toISOString()
            };

        if (existingIndex >= 0) updatedAttendance[existingIndex] = updatedRecord;
        else updatedAttendance.push(updatedRecord);
        set({ attendance: updatedAttendance });

        const sync = await syncAttendanceUpsert(updatedRecord);
        if (!sync.success) set({ attendance: previousAttendance });
        return sync;
      },

      // Match Surveys & Lineup System Implementation
      saveMatchSurvey: async (surveyData) => {
        const currentState = get();
        const targetEvent = currentState.events.find((event) => event.id === surveyData.event_id);
        if (currentState.currentUser.role !== 'admin' && targetEvent && isEventPast(targetEvent)) {
          console.warn('Cannot save match survey: event submission is closed');
          return { success: false, message: '活動已截止，無法再修改出賽意願。' };
        }
        // Check if user is attending this event (只有已報名出席才能填寫意願)
        const userAtt = currentState.attendance.find(
          a => a.event_id === surveyData.event_id && a.user_id === surveyData.user_id
        );
        if (userAtt?.status !== 'attending') {
          console.warn('Cannot save match survey: user is not attending');
          return { success: false, message: '必須先報名出席，才能填寫出賽意願。' };
        }

        const now = new Date().toISOString();
        const previousSurveys = currentState.matchSurveys;
        let targetSurvey: MatchSurveyResponse;
        set((state) => {
          const existingIdx = state.matchSurveys.findIndex(
            s => s.event_id === surveyData.event_id && s.user_id === surveyData.user_id
          );
          let nextSurveys = [...state.matchSurveys];
          if (existingIdx >= 0) {
            targetSurvey = {
              ...nextSurveys[existingIdx],
              ...surveyData,
              updated_at: now
            };
            nextSurveys[existingIdx] = targetSurvey;
          } else {
            targetSurvey = {
              id: generateUUID(),
              ...surveyData,
              updated_at: now
            };
            nextSurveys.push(targetSurvey);
          }
          return { matchSurveys: nextSurveys };
        });

        const sync = await syncMatchSurveyUpsert(targetSurvey!);
        if (!sync.success) set({ matchSurveys: previousSurveys });
        return sync;
      },

      saveMatchLineup: async (eventId, slots, isPublished, notes) => {
        const now = new Date().toISOString();
        const config: MatchLineupConfig = {
          event_id: eventId,
          is_published: isPublished,
          notes: notes || '',
          updated_at: now
        };

        const previousSlots = get().matchLineupSlots;
        const previousConfigs = get().matchLineupConfigs;
        set((state) => {
          // Replace slots for this eventId
          const remainingSlots = state.matchLineupSlots.filter(s => s.event_id !== eventId);
          const updatedSlots = [...remainingSlots, ...slots];
          const updatedConfigs = {
            ...state.matchLineupConfigs,
            [eventId]: config
          };
          return {
            matchLineupSlots: updatedSlots,
            matchLineupConfigs: updatedConfigs
          };
        });

        const sync = await syncMatchLineupUpsert(eventId, config, slots);
        if (!sync.success) {
          set({ matchLineupSlots: previousSlots, matchLineupConfigs: previousConfigs });
        }
        return sync;
      },

      deleteMatchLineup: async (eventId) => {
        const previousSlots = get().matchLineupSlots;
        const previousConfigs = get().matchLineupConfigs;
        set((state) => {
          const nextSlots = state.matchLineupSlots.filter(s => s.event_id !== eventId);
          const nextConfigs = { ...state.matchLineupConfigs };
          delete nextConfigs[eventId];
          return {
            matchLineupSlots: nextSlots,
            matchLineupConfigs: nextConfigs
          };
        });

        const sync = await syncMatchLineupDelete(eventId);
        if (!sync.success) {
          set({ matchLineupSlots: previousSlots, matchLineupConfigs: previousConfigs });
        }
        return sync;
      },

      getMemberMatchStats: (userId, targetEventId) => {
        const state = get();
        // 1. Total historical matches played in all published events
        let historicalPlayedCount = 0;
        state.matchLineupSlots.forEach((slot) => {
          if (slot.event_id !== targetEventId) {
            const cfg = state.matchLineupConfigs[slot.event_id];
            if (cfg?.is_published && slot.player_ids.includes(userId)) {
              historicalPlayedCount += 1;
            }
          }
        });

        // 2. Current target event assigned slot count
        let currentEventSlotCount = 0;
        if (targetEventId) {
          state.matchLineupSlots.forEach((slot) => {
            if (slot.event_id === targetEventId && slot.player_ids.includes(userId)) {
              currentEventSlotCount += 1;
            }
          });
        }

        // 3. User's survey for this event
        const survey = targetEventId 
          ? state.matchSurveys.find(s => s.event_id === targetEventId && s.user_id === userId)
          : undefined;

        return {
          historicalPlayedCount,
          currentEventSlotCount,
          survey
        };
      },

      autoGenerateFairLineup: (eventId) => {
        const state = get();
        const targetEvent = state.events.find(e => e.id === eventId);
        if (!targetEvent) return [];

        // 1. Attending members
        const attendingUserIds = state.attendance
          .filter(a => a.event_id === eventId && a.status === 'attending')
          .map(a => a.user_id);
        
        // If no one RSVPed yet, fallback to all approved members
        const eligibleMembers = (attendingUserIds.length > 0
          ? state.profiles.filter(p => attendingUserIds.includes(p.id))
          : state.profiles
        ).filter(p => p.status === 'approved' || !p.status);

        if (eligibleMembers.length === 0) return [];

        // 2. Historical published match counts
        const historyCounts: Record<string, number> = {};
        state.profiles.forEach(p => { historyCounts[p.id] = 0; });
        state.matchLineupSlots.forEach(slot => {
          if (slot.event_id !== eventId) {
            const cfg = state.matchLineupConfigs[slot.event_id];
            if (cfg?.is_published) {
              slot.player_ids.forEach(pid => {
                historyCounts[pid] = (historyCounts[pid] || 0) + 1;
              });
            }
          }
        });

        // 3. Current survey responses
        const surveys = state.matchSurveys.filter(s => s.event_id === eventId);
        const surveyMap = new Map(surveys.map(s => [s.user_id, s]));

        // Helper to determine gender
        const isMemberFemale = (member: Profile) => {
          if (member.gender === 'female') return true;
          if (member.gender === 'male') return false;
          const name = member.name || '';
          return name.includes('蓉') || name.includes('雯') || name.includes('珊') ||
                 name.includes('婷') || name.includes('琪') || name.includes('雅') ||
                 name.includes('萱') || name.includes('玲') || name.includes('美') ||
                 name.includes('如') || name.includes('怡') || name.includes('佳') ||
                 name.includes('慧') || name.includes('欣') || name.includes('妤');
        };

        const isMemberMale = (member: Profile) => !isMemberFemale(member);

        // 5 standard points definition
        const pointTemplates: {
          index: number;
          name: string;
          discipline: MatchDiscipline;
          requiredCount: number;
          preferredGender?: 'male' | 'female' | 'mixed';
        }[] = [
          { index: 1, name: '第 1 點 男單 (MS)', discipline: '男單', requiredCount: 1, preferredGender: 'male' },
          { index: 2, name: '第 2 點 女單 (WS)', discipline: '女單', requiredCount: 1, preferredGender: 'female' },
          { index: 3, name: '第 3 點 男雙 (MD)', discipline: '男雙', requiredCount: 2, preferredGender: 'male' },
          { index: 4, name: '第 4 點 女雙 (WD)', discipline: '女雙', requiredCount: 2, preferredGender: 'female' },
          { index: 5, name: '第 5 點 混雙 (XD)', discipline: '混雙', requiredCount: 2, preferredGender: 'mixed' },
        ];

        // Global assignment map to guarantee: 人不能兼點 (One person max 1 slot across all 5 points)
        const globalAssignedCounts: Record<string, number> = {};
        eligibleMembers.forEach(m => { globalAssignedCounts[m.id] = 0; });

        const generatedSlots: MatchPointSlot[] = [];

        for (const pt of pointTemplates) {
          const chosenPlayerIds: string[] = [];

          for (let req = 0; req < pt.requiredCount; req++) {
            // Priority 1: Pick from players who are NOT yet assigned to ANY point in this match (人不能兼點)
            let unassignedPool = eligibleMembers.filter(
              m => (globalAssignedCounts[m.id] || 0) === 0 && !chosenPlayerIds.includes(m.id)
            );

            // Fallback only if eligible pool is smaller than 8 players and everyone already has at least 1 point
            if (unassignedPool.length === 0) {
              const minAssignedCount = Math.min(
                ...eligibleMembers
                  .filter(m => !chosenPlayerIds.includes(m.id))
                  .map(m => globalAssignedCounts[m.id] || 0)
              );
              unassignedPool = eligibleMembers.filter(
                m => !chosenPlayerIds.includes(m.id) && (globalAssignedCounts[m.id] || 0) <= minAssignedCount
              );
            }

            const scoredCandidates = unassignedPool.map(member => {
              let score = 0;
              const survey = surveyMap.get(member.id);
              const historyCount = historyCounts[member.id] || 0;
              const assignedCount = globalAssignedCounts[member.id] || 0;
              const isFemale = isMemberFemale(member);
              const isMale = !isFemale;

              // 1. 嚴格不兼點懲罰 (Prioritize 0-point players massively)
              score -= assignedCount * 50000;

              // 2. 有意願的優先 (Discipline Preference Priority)
              const hasExplicitWants = survey?.preferred_disciplines?.includes(pt.discipline);
              if (hasExplicitWants) {
                score += 15000; // Explicitly checked this discipline -> highest priority!
              } else if (!survey || !survey.preferred_disciplines || survey.preferred_disciplines.length === 0) {
                score += 3000; // Open to any discipline
              } else {
                score += 500; // Selected other disciplines only
              }

              // 3. 從未出賽過 (0 場) 優先安排
              if (historyCount === 0) {
                score += 5000;
              } else {
                score -= historyCount * 100;
              }

              // 4. 性別符合度 (Gender Match)
              if (pt.preferredGender === 'male') {
                if (isMale) score += 6000;
                else score -= 12000;
              } else if (pt.preferredGender === 'female') {
                if (isFemale) score += 6000;
                else score -= 12000;
              } else if (pt.preferredGender === 'mixed') {
                if (chosenPlayerIds.length === 0) {
                  // First player for mixed doubles
                  score += 1000;
                } else {
                  // Second player for mixed doubles: opposite gender bonus to form true 1M + 1F
                  const firstPlayer = eligibleMembers.find(m => m.id === chosenPlayerIds[0]);
                  const firstIsFemale = firstPlayer ? isMemberFemale(firstPlayer) : false;
                  if (firstIsFemale && isMale) score += 8000;
                  else if (!firstIsFemale && isFemale) score += 8000;
                  else score -= 4000;
                }
              }

              // 5. 搭檔偏好 (Partner Preference Bonus)
              if (chosenPlayerIds.length === 1 && survey?.partner_preference) {
                const firstPlayer = eligibleMembers.find(m => m.id === chosenPlayerIds[0]);
                if (firstPlayer && survey.partner_preference.toLowerCase().includes(firstPlayer.name.slice(0, 2).toLowerCase())) {
                  score += 2500;
                }
              }

              return { member, score };
            }).sort((a, b) => b.score - a.score);

            if (scoredCandidates.length > 0) {
              const topCandidate = scoredCandidates[0];
              chosenPlayerIds.push(topCandidate.member.id);
              globalAssignedCounts[topCandidate.member.id] = (globalAssignedCounts[topCandidate.member.id] || 0) + 1;
            }
          }

          generatedSlots.push({
            id: generateUUID(),
            event_id: eventId,
            point_index: pt.index,
            point_name: pt.name,
            discipline: pt.discipline,
            player_ids: chosenPlayerIds,
            opponent_info: '',
            score: ''
          });
        }

        return generatedSlots;
      },

      addFinance: async (newFinance) => {
        const item: FinanceLedger = {
          ...newFinance,
          id: generateUUID(),
          created_at: new Date().toISOString()
        };
        set((state) => ({
          finances: deduplicateById([item, ...state.finances])
        }));
        const sync = await syncFinanceInsert(item);
        if (!sync.success) {
          set((state) => ({
            finances: state.finances.filter((finance) => finance.id !== item.id)
          }));
        }
        return sync;
      },

      updateFinance: async (id, updates) => {
        const previousFinance = get().finances.find((finance) => finance.id === id);
        if (!previousFinance) {
          return { success: false, message: '找不到要更新的帳務資料，請重新整理後再試。' };
        }
        set((state) => ({
          finances: state.finances.map((f) => (f.id === id ? { ...f, ...updates } : f))
        }));
        const sync = await syncFinanceUpdate(id, updates);
        if (!sync.success) {
          set((state) => ({
            finances: state.finances.map((finance) => finance.id === id ? previousFinance : finance)
          }));
        }
        return sync;
      },

      deleteFinance: async (id) => {
        const previousFinances = get().finances;
        if (!previousFinances.some((finance) => finance.id === id)) {
          return { success: false, message: '找不到要刪除的帳務資料，請重新整理後再試。' };
        }
        set((state) => ({
          finances: state.finances.filter((f) => f.id !== id)
        }));
        const sync = await syncFinanceDelete(id);
        if (!sync.success) set({ finances: previousFinances });
        return sync;
      },

      addFeeCollection: async (title, c_type, totalAmount, amountPerPerson, targetUserIds, dueDate) => {
        const collectionId = generateUUID();
        const newCol: FeeCollection = {
          id: collectionId,
          title,
          c_type,
          total_amount: totalAmount,
          amount_per_person: amountPerPerson,
          status: 'active',
          due_date: dueDate,
          created_at: new Date().toISOString()
        };

        const newRecords: FeeRecord[] = targetUserIds.map((uId) => ({
          id: generateUUID(),
          collection_id: collectionId,
          user_id: uId,
          is_paid: false,
          payment_status: 'unpaid',
          created_at: new Date().toISOString()
        }));

        set((state) => ({
          feeCollections: deduplicateById([newCol, ...state.feeCollections]),
          feeRecords: deduplicateById([...state.feeRecords, ...newRecords])
        }));
        const sync = await syncFeeCollectionInsert(newCol, newRecords);
        if (!sync.success) {
          set((state) => ({
            feeCollections: state.feeCollections.filter((collection) => collection.id !== collectionId),
            feeRecords: state.feeRecords.filter((record) => record.collection_id !== collectionId)
          }));
        }
        return sync;
      },

      updateFeeCollection: async (id, updates) => {
        const previousCollection = get().feeCollections.find((collection) => collection.id === id);
        if (!previousCollection) {
          return { success: false, message: '找不到要更新的收費專案，請重新整理後再試。' };
        }
        set((state) => ({
          feeCollections: state.feeCollections.map((c) => (c.id === id ? { ...c, ...updates } : c))
        }));
        const sync = await syncFeeCollectionUpdate(id, updates);
        if (!sync.success) {
          set((state) => ({
            feeCollections: state.feeCollections.map((collection) =>
              collection.id === id ? previousCollection : collection
            )
          }));
        }
        return sync;
      },

      addUsersToFeeCollection: async (collectionId, userIds) => {
        const currentState = get();
        if (!currentState.feeCollections.some((collection) => collection.id === collectionId)) {
          return { success: false, message: '找不到要加入隊員的收費專案，請重新整理後再試。' };
        }

        const existingUserIds = new Set(
          currentState.feeRecords
            .filter((record) => record.collection_id === collectionId)
            .map((record) => record.user_id)
        );
        const validProfileIds = new Set(currentState.profiles.map((profile) => profile.id));
        const newUserIds = [...new Set(userIds)].filter(
          (userId) => validProfileIds.has(userId) && !existingUserIds.has(userId)
        );

        if (newUserIds.length === 0) return { success: true };

        const newRecords: FeeRecord[] = newUserIds.map((userId) => ({
          id: generateUUID(),
          collection_id: collectionId,
          user_id: userId,
          is_paid: false,
          payment_status: 'unpaid',
          created_at: new Date().toISOString()
        }));
        const newRecordIds = new Set(newRecords.map((record) => record.id));

        set((state) => ({
          feeRecords: deduplicateById([...state.feeRecords, ...newRecords])
        }));
        const sync = await syncFeeRecordInsert(newRecords);
        if (!sync.success) {
          set((state) => ({
            feeRecords: state.feeRecords.filter((record) => !newRecordIds.has(record.id))
          }));
        }
        return sync;
      },

      deleteFeeCollection: async (id) => {
        const previousCollections = get().feeCollections;
        const previousRecords = get().feeRecords;
        if (!previousCollections.some((collection) => collection.id === id)) {
          return { success: false, message: '找不到要刪除的收費專案，請重新整理後再試。' };
        }
        set((state) => ({
          feeCollections: state.feeCollections.filter((c) => c.id !== id),
          feeRecords: state.feeRecords.filter((r) => r.collection_id !== id)
        }));
        const sync = await syncFeeCollectionDelete(id);
        if (!sync.success) {
          set({ feeCollections: previousCollections, feeRecords: previousRecords });
        }
        return sync;
      },

      reportFeePayment: async (recordId, notes) => {
        const currentState = get();
        const previousRecord = currentState.feeRecords.find((record) => record.id === recordId);
        const collection = currentState.feeCollections.find(
          (item) => item.id === previousRecord?.collection_id
        );
        if (!previousRecord) {
          return { success: false, message: '找不到這筆繳費紀錄，請重新整理後再試。' };
        }
        if (currentState.currentUser.role !== 'admin' && !isFeeCollectionOpen(collection)) {
          return { success: false, message: '此收費專案已截止或結案，無法再回報匯款。' };
        }
        const now = new Date().toISOString();
        const updates: Partial<FeeRecord> = {
          is_paid: false,
          payment_status: 'pending',
          reported_at: now,
          notes: notes || '隊員已回報完成匯款，待對帳'
        };
        set((state) => ({
          feeRecords: state.feeRecords.map((r) =>
            r.id === recordId ? { ...r, ...updates } : r
          )
        }));
        const sync = await syncFeeRecordUpdate(recordId, updates);
        if (!sync.success && previousRecord) {
          set((state) => ({
            feeRecords: state.feeRecords.map((record) =>
              record.id === recordId ? previousRecord : record
            )
          }));
        }
        return sync;
      },

      confirmFeePayment: async (recordId) => {
        const previousRecord = get().feeRecords.find((record) => record.id === recordId);
        const now = new Date().toISOString();
        const updates: Partial<FeeRecord> = {
          is_paid: true,
          payment_status: 'paid',
          paid_at: now
        };
        set((state) => ({
          feeRecords: state.feeRecords.map((r) =>
            r.id === recordId ? { ...r, ...updates } : r
          )
        }));
        const sync = await syncFeeRecordUpdate(recordId, updates);
        if (!sync.success && previousRecord) {
          set((state) => ({
            feeRecords: state.feeRecords.map((record) =>
              record.id === recordId ? previousRecord : record
            )
          }));
        }
        return sync;
      },

      rejectFeePayment: async (recordId, reason) => {
        const previousRecord = get().feeRecords.find((record) => record.id === recordId);
        const updates: Partial<FeeRecord> = {
          is_paid: false,
          payment_status: 'unpaid',
          notes: reason ? `審核未通過：${reason}` : undefined
        };
        set((state) => ({
          feeRecords: state.feeRecords.map((r) =>
            r.id === recordId ? { ...r, ...updates } : r
          )
        }));
        const sync = await syncFeeRecordUpdate(recordId, updates);
        if (!sync.success && previousRecord) {
          set((state) => ({
            feeRecords: state.feeRecords.map((record) =>
              record.id === recordId ? previousRecord : record
            )
          }));
        }
        return sync;
      },

      toggleFeePaidStatus: async (recordId, isPaid) => {
        const currentState = get();
        const previousRecord = currentState.feeRecords.find((record) => record.id === recordId);
        const collection = currentState.feeCollections.find(
          (item) => item.id === previousRecord?.collection_id
        );
        if (!previousRecord) {
          return { success: false, message: '找不到這筆繳費紀錄，請重新整理後再試。' };
        }
        if (currentState.currentUser.role !== 'admin' && !isFeeCollectionOpen(collection)) {
          return { success: false, message: '此收費專案已截止或結案，無法變更匯款回報。' };
        }
        const now = new Date().toISOString();
        const updates: Partial<FeeRecord> = {
          is_paid: isPaid,
          payment_status: isPaid ? 'paid' : 'unpaid',
          paid_at: isPaid ? now : undefined
        };
        set((state) => ({
          feeRecords: state.feeRecords.map((r) =>
            r.id === recordId ? { ...r, ...updates } : r
          )
        }));
        const sync = await syncFeeRecordUpdate(recordId, updates);
        if (!sync.success && previousRecord) {
          set((state) => ({
            feeRecords: state.feeRecords.map((record) =>
              record.id === recordId ? previousRecord : record
            )
          }));
        }
        return sync;
      },

      closeFeeCollection: async (collectionId) => {
        const previousCollection = get().feeCollections.find((collection) => collection.id === collectionId);
        if (!previousCollection) {
          return { success: false, message: '找不到要結案的收費專案，請重新整理後再試。' };
        }
        set((state) => ({
          feeCollections: state.feeCollections.map((c) =>
            c.id === collectionId ? { ...c, status: 'closed' } : c
          )
        }));
        const sync = await syncFeeCollectionClose(collectionId);
        if (!sync.success) {
          set((state) => ({
            feeCollections: state.feeCollections.map((collection) =>
              collection.id === collectionId ? previousCollection : collection
            )
          }));
        }
        return sync;
      },

      fetchFromSupabase: async () => {
        if (!getSupabaseConfig().isConfigured) {
          return { success: false, message: '系統服務尚未完成設定' };
        }
        try {
          const [
            profilesResult,
            eventsResult,
            attendanceResult,
            financesResult,
            collectionsResult,
            recordsResult,
            surveysResult,
            slotsResult,
            configsResult
          ] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('events').select('*'),
            supabase.from('attendance').select('*'),
            supabase.from('finances').select('*'),
            supabase.from('fee_collections').select('*'),
            supabase.from('fee_records').select('*'),
            supabase.from('match_surveys').select('*'),
            supabase.from('match_lineup_slots').select('*'),
            supabase.from('match_lineup_configs').select('*')
          ]);

          const remoteResults = [
            ['profiles', profilesResult],
            ['events', eventsResult],
            ['attendance', attendanceResult],
            ['finances', financesResult],
            ['fee_collections', collectionsResult],
            ['fee_records', recordsResult],
            ['match_surveys', surveysResult],
            ['match_lineup_slots', slotsResult],
            ['match_lineup_configs', configsResult]
          ] as const;

          const failedResult = remoteResults.find(([, result]) => result.error);
          if (failedResult) {
            const [table, result] = failedResult;
            throw new Error(`${table}: ${result.error?.message || '讀取失敗'}`);
          }

          const pData = profilesResult.data || [];
          const eData = eventsResult.data || [];
          const aData = attendanceResult.data || [];
          const fData = financesResult.data || [];
          const cData = collectionsResult.data || [];
          const rData = recordsResult.data || [];
          const remoteSurveys = (surveysResult.data || []) as MatchSurveyResponse[];
          const remoteSlots = (slotsResult.data || []) as MatchPointSlot[];
          const remoteConfigs = ((configsResult.data || []) as MatchLineupConfig[]).reduce<Record<string, MatchLineupConfig>>(
            (configs, config) => {
              configs[config.event_id] = config;
              return configs;
            },
            {}
          );

          const currentProfiles = get().profiles;
          const mergedProfiles = (pData || []).map((remoteP: any) => {
            const localP = currentProfiles.find(lp => lp.id === remoteP.id || lp.username?.toLowerCase() === remoteP.username?.toLowerCase());
            return {
              ...remoteP,
              status: remoteP.status || localP?.status || (remoteP.role === 'admin' ? 'approved' : 'pending'),
              auth_user_id: remoteP.auth_user_id
            };
          });

          // Remote database is authoritative when available
          const allProfiles = deduplicateById(mergedProfiles);

          const existingUser = get().currentUser;
          const rawMatchedUser = (pData || []).find((profile: any) =>
            profile.id === existingUser?.id ||
            (existingUser?.auth_user_id && profile.auth_user_id === existingUser.auth_user_id)
          );
          const matchedCurrentUser = rawMatchedUser
            ? { ...rawMatchedUser }
            : (allProfiles.find((profile) => profile.id === existingUser?.id) || existingUser);

          set({
            profiles: allProfiles,
            events: deduplicateById(eData || []),
            attendance: deduplicateById(aData || []),
            finances: deduplicateById(fData || []),
            feeCollections: deduplicateById(cData || []),
            feeRecords: deduplicateById((rData || []).map((r: any) => ({
              ...r,
              payment_status: r.payment_status || (r.is_paid ? 'paid' : 'unpaid')
            }))),
            matchSurveys: deduplicateById(remoteSurveys),
            matchLineupSlots: deduplicateById(remoteSlots),
            matchLineupConfigs: remoteConfigs,
            currentUser: matchedCurrentUser
          });

          return { success: true, message: '系統資料已更新。' };
        } catch (err: any) {
          console.warn('Supabase RLS-scoped fetch failed:', err?.message || err);
          return { success: false, message: '資料載入失敗，請檢查網路後重新整理。' };
        }
      }
    }),
    {
      name: 'goodminton-storage',
      version: 3,
      migrate: (persistedState: any, version) => {
        if (version < 3) {
          return {
            viewedEventIdsByUser: persistedState?.viewedEventIdsByUser || {},
            viewedFeeRecordIdsByUser: persistedState?.viewedFeeRecordIdsByUser || {},
            viewedAnnouncementUpdatedAtByUser: persistedState?.viewedAnnouncementUpdatedAtByUser || {}
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.profiles = deduplicateById(state.profiles || []);
          state.events = deduplicateById(state.events || []);
          state.attendance = deduplicateById(state.attendance || []);
          state.finances = deduplicateById(state.finances || []);
          state.feeCollections = deduplicateById(state.feeCollections || []);
          state.feeRecords = deduplicateById(state.feeRecords || []);
          state.matchSurveys = deduplicateById(state.matchSurveys || []);
          state.matchLineupSlots = deduplicateById(state.matchLineupSlots || []);
        }
      },
      partialize: (state) => ({
        // Server-owned business data is intentionally not persisted. This
        // prevents a member from seeing a previous admin's cached rows on a
        // shared browser before the new Auth/RLS-scoped fetch completes.
        viewedEventIdsByUser: state.viewedEventIdsByUser || {},
        viewedFeeRecordIdsByUser: state.viewedFeeRecordIdsByUser || {},
        viewedAnnouncementUpdatedAtByUser: state.viewedAnnouncementUpdatedAtByUser || {}
      })
    }
  )
);
