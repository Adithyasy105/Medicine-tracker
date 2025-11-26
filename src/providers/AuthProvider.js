import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { upsertDeviceToken, rescheduleAllMedicineNotifications, clearNotificationStateOnLogout, startNotificationListeners } from '../services/notifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const rescheduleAttempted = React.useRef(false);

  useEffect(() => {
    let mounted = true;

    // Start listeners for "sent today" tracking
    const stopListeners = startNotificationListeners();

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (newSession) {
        upsertDeviceToken().catch((err) => console.warn('Device token registration failed', err));

        // One-time cleanup of ALL legacy notifications to fix "flood" issues
        const performCleanupAndReschedule = async () => {
          try {
            const hasCleaned = await AsyncStorage.getItem('has_cleaned_legacy_notifications_v2');
            if (!hasCleaned) {
              console.log('Performing one-time nuclear cleanup of notifications...');
              await Notifications.cancelAllScheduledNotificationsAsync();
              await AsyncStorage.setItem('has_cleaned_legacy_notifications_v2', 'true');
            }

            // Only reschedule if we haven't done so in this session
            if (!rescheduleAttempted.current) {
              rescheduleAttempted.current = true;
              await rescheduleAllMedicineNotifications();
            }
          } catch (err) {
            console.warn('Failed to cleanup/reschedule notifications', err);
          }
        };

        performCleanupAndReschedule();
      } else {
        rescheduleAttempted.current = false; // Reset on logout
      }
    });

    // Listen for app state changes to refresh session
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.getSession().then(({ data }) => {
          if (mounted) setSession(data.session ?? null);
        });
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
      appStateListener.remove();
      if (stopListeners) stopListeners();
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
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'medicinetracker://',
          },
        }).then(({ error, data }) => {
          if (error) throw error;
          return data;
        }),
      signOut: async () => {
        try {
          // Use the new strict cleanup function
          await clearNotificationStateOnLogout();
        } catch (e) {
          console.warn('Failed to clear notifications on logout', e);
        }
        return supabase.auth.signOut();
      },
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

