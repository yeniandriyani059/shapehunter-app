import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env)
  ? (import.meta as any).env
  : (typeof process !== 'undefined' && process && process.env ? process.env : {});

const supabaseUrl = env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co'
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export default supabase;
