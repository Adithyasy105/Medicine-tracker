import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    storageKey: 'medicine-tracker-auth',
    detectSessionInUrl: false,
  },
  global: { headers: { 'x-client-info': 'medicine-tracker' } },
});

export const tables = {
  profiles: 'profiles',
  medicines: 'medicines',
  logs: 'medicine_logs',
  devices: 'devices',
  scans: 'scans',
};

export const storageBucket = 'medicine-images';

