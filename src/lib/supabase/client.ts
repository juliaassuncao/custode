import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

function initializeClient(): SupabaseClient<Database> | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  try {
    return createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch {
    // Invalid local configuration must not prevent the reader from loading.
    return null;
  }
}

// ES modules share this instance across all importers.
export const supabase = initializeClient();

// Indicates client initialization, not remote service health or connectivity.
export const isSupabaseAvailable = supabase !== null;
