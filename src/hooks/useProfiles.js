import { useCallback, useEffect, useState } from 'react';
import { supabase, tables } from '../lib/supabase';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching profiles...');
      const { data, error: err } = await supabase.from(tables.profiles).select('*').order('created_at', { ascending: false });
      if (err) {
        console.error('Supabase fetch error:', err);
        throw err;
      }
      console.log('Profiles fetched:', data);
      setProfiles(data ?? []);
    } catch (err) {
      console.error('Load profiles failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProfile = useCallback(async (payload) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No user logged in');

      const record = { ...payload, user_id: session.user.id };
      const { data, error: err } = await supabase.from(tables.profiles).insert(record).select().single();
      if (err) throw err;
      setProfiles((prev) => [data, ...prev]);
    } catch (err) {
      console.error('Create profile error:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteProfile = useCallback(async (id) => {
    try {
      const { error: err } = await supabase.from(tables.profiles).delete().eq('id', id);
      if (err) throw err;
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete profile error:', err);
      throw err;
    }
  }, []);

  return { profiles, loading, error, reloadProfiles: load, createProfile, deleteProfile };
};

