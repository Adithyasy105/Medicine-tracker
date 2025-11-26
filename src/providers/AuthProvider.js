import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { upsertDeviceToken, rescheduleAllMedicineNotifications } from '../services/notifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        upsertDeviceToken().catch((err) => console.warn('Device token registration failed', err));
        // Reschedule all notifications when user logs in
        rescheduleAllMedicineNotifications().catch((err) => console.warn('Failed to reschedule notifications', err));
      }
    });

    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
      appStateListener.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }).then(({ error, data }) => {
          if (error) throw error;
          return data;
        }),
      signUp: (email, password) =>
        supabase.auth.signUp({ email, password }).then(({ error, data }) => {
          if (error) throw error;
          return data;
        }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

