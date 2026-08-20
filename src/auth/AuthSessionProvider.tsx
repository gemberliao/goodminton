import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseConfig, supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { Profile } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthSessionContextValue {
  status: AuthStatus;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const PROFILE_FIELDS = 'id, auth_user_id, username, name, level, role, gender, status, phone, avatar_url, created_at';

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const profileRequestId = useRef(0);
  const setCurrentUserProfile = useAppStore((state) => state.setCurrentUserProfile);
  const fetchFromSupabase = useAppStore((state) => state.fetchFromSupabase);

  const loadProfileForSession = useCallback(async (session: Session | null): Promise<Profile | null> => {
    const requestId = ++profileRequestId.current;
    if (!session?.user) {
      if (requestId === profileRequestId.current) setStatus('anonymous');
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Unable to load the authenticated profile:', error);
      if (requestId === profileRequestId.current) setStatus('anonymous');
      return null;
    }

    if (!data || data.status !== 'approved') {
      if (requestId === profileRequestId.current) {
        await supabase.auth.signOut();
        setStatus('anonymous');
      }
      return null;
    }

    const profile = data as Profile;
    if (requestId !== profileRequestId.current) return null;

    // Authentication is complete as soon as the approved profile is known.
    // Business-table synchronization must not send a valid user back to the
    // login page merely because a secondary request is slow or temporarily
    // unavailable.
    setCurrentUserProfile(profile);
    setStatus('authenticated');
    void fetchFromSupabase().then((syncResult) => {
      if (!syncResult.success) {
        console.error('Unable to load the RLS-scoped application data:', syncResult.message);
      }
    });
    return profile;
  }, [fetchFromSupabase, setCurrentUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (!getSupabaseConfig().isConfigured) {
      setStatus('anonymous');
      return null;
    }
    const { data } = await supabase.auth.getSession();
    return loadProfileForSession(data.session);
  }, [loadProfileForSession]);

  useEffect(() => {
    if (!getSupabaseConfig().isConfigured) {
      setStatus('anonymous');
      return;
    }

    let disposed = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed) void loadProfileForSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (!disposed) void loadProfileForSession(session);
      }, 0);
    });

    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

  const value = useMemo(() => ({ status, refreshProfile }), [refreshProfile, status]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
};

export const useAuthSession = (): AuthSessionContextValue => {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return value;
};
