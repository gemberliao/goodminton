export const SUPABASE_SYNC_ERROR_EVENT = 'goodminton:supabase-sync-error';

export interface SyncResult {
  success: boolean;
  message?: string;
}

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function errorParts(error: unknown): SupabaseErrorLike {
  if (error && typeof error === 'object') return error as SupabaseErrorLike;
  return { message: String(error || '未知錯誤') };
}

export function describeSupabaseError(operation: string, error: unknown): string {
  const parsed = errorParts(error);
  const raw = parsed.message || '未知錯誤';

  if (parsed.code === '42501' || /row-level security|permission denied|policy/i.test(raw)) {
    return `${operation}失敗：目前帳號沒有執行此操作的權限。`;
  }

  if (parsed.code === 'PGRST204' || /schema cache|could not find.+column/i.test(raw)) {
    return `${operation}失敗：系統資料格式尚未完成更新，請聯絡管理員。`;
  }

  if (parsed.code === '23503' || /foreign key/i.test(raw)) {
    return `${operation}失敗：相關資料不存在或已經被刪除。`;
  }

  if (parsed.code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
    return `${operation}失敗：相同資料已經存在。`;
  }

  return `${operation}失敗，請稍後再試或聯絡管理員。`;
}

export function reportSupabaseError(operation: string, error: unknown): SyncResult {
  const message = describeSupabaseError(operation, error);
  console.error(message, error);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUPABASE_SYNC_ERROR_EVENT, { detail: { message } }));
  }

  return { success: false, message };
}
