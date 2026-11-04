import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Imported only by the administrative route. Never reuse the reader's singleton.
export const ADMIN_STORAGE_KEY = 'custode-community-admin-auth-v1';

function initialize(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: {
      storageKey: ADMIN_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    } });
  } catch { return null; }
}

export const adminClient = initialize();
