/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LEGACY_STORAGE_URL_KEY = 'goodminton_supabase_url';
const LEGACY_STORAGE_ANON_KEY = 'goodminton_supabase_anon_key';

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  // The connection editor UI has been removed. Keep already-saved values as a
  // migration fallback until the deployment has VITE_* variables configured.
  // The anon key is public by design; Auth JWT + RLS provide authorization.
  const legacyUrl = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_URL_KEY) || '' : '';
  const legacyAnonKey = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_ANON_KEY) || '' : '';
  const url = envUrl.trim() || legacyUrl.trim();
  const anonKey = envAnonKey.trim() || legacyAnonKey.trim();

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url.trim() !== '' &&
    url !== 'https://your-project.supabase.co' &&
    url.startsWith('https://') &&
    anonKey.length > 15
  );

  return { url, anonKey, isConfigured };
}

let activeClient: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  const configKey = `${url}:${anonKey}`;

  if (activeClient && currentConfigKey === configKey) {
    return activeClient;
  }

  currentConfigKey = configKey;
  if (isConfigured) {
    activeClient = createClient(url, anonKey);
  } else {
    activeClient = createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');
  }

  return activeClient;
}

// Proxy object for backward compatibility so existing imports `supabase.from(...)` work seamlessly
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});
