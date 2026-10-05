import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ganti teks di bawah ini dengan Project URL dan Anon Key asli dari Supabase Ibu
const SUPABASE_PROJECT_URL = 'https://nqdopaupzxibaozlolpl.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';       

const env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env)
  ? (import.meta as any).env
  : (typeof process !== 'undefined' && process && process.env ? process.env : {});

const supabaseUrl = env?.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  !supabaseUrl.includes('MASUKKAN_URL')
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Uploads a base64 photo to Supabase Storage bucket "foto_temuan".
 * Returns fully qualified valid Supabase Public CDN URL.
 */
export async function uploadPhotoToSupabaseBucket(dataUrl: string): Promise<string> {
  if (!isSupabaseConfigured || !dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  try {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9\+\-]+);base64,(.+)$/);
    if (!match) return dataUrl;

    const contentType = match[1];
    const base64Data = match[2];

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const fileExt = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const fileName = `temuan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('foto_temuan')
      .upload(fileName, bytes, {
        contentType: contentType || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage "foto_temuan" upload notice:', error.message);
      return dataUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from('foto_temuan')
      .getPublicUrl(data.path);

    if (publicUrlData && publicUrlData.publicUrl) {
      console.log('Generated Supabase Public CDN URL:', publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
    }
  } catch (err) {
    console.warn('Supabase storage exception:', err);
  }

  return dataUrl;
}

/**
 * Neutralized: insertions must ONLY happen via explicit manual form submission in StudentUploaderView.tsx
 */
export async function syncKartuTemuanToSupabase(_discovery: any): Promise<void> {
  // No-op: prevents automatic looping inserts
  return;
}

/**
 * Fetches all records from Supabase table "public.kartu_temuan" with ID deduplication
 */
export async function fetchKartuTemuanFromSupabase(): Promise<Array<{
  id: number;
  image_url: string;
  nama_benda: string;
  real_shape: string;
  kelompok_id: number;
  is_proven: boolean;
}>> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('kartu_temuan')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      return [];
    }

    if (Array.isArray(data)) {
      const seenIds = new Set<number>();
      const results: Array<{
        id: number;
        image_url: string;
        nama_benda: string;
        real_shape: string;
        kelompok_id: number;
        is_proven: boolean;
      }> = [];

      for (let idx = 0; idx < data.length; idx++) {
        const item = data[idx];
        const rawId = Number(item.id);
        const validId = !isNaN(rawId) && rawId !== 0 ? rawId : (idx + 1);
        if (seenIds.has(validId)) continue;
        seenIds.add(validId);

        const rawGroupId = Number(item.kelompok_id);
        const validGroupId = !isNaN(rawGroupId) && rawGroupId > 0 ? rawGroupId : 1;

        results.push({
          id: validId,
          image_url: String(item.image_url || ''),
          nama_benda: String(item.nama_benda || 'Benda Temuan'),
          real_shape: String(item.real_shape || 'lingkaran'),
          kelompok_id: validGroupId,
          is_proven: Boolean(item.is_proven),
        });
      }

      return results;
    }
  } catch {
    // Suppress network errors
  }

  return [];
}

/**
 * Updates real_shape for a discovery in Supabase table "public.kartu_temuan"
 */
export async function updateDiscoveryShapeInSupabase(id: number, newRealShape: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase
      .from('kartu_temuan')
      .update({ real_shape: newRealShape })
      .eq('id', id);
  } catch {
    // Safe ignore
  }
}

/**
 * Resets all kartu_temuan records in Supabase (on session reset)
 */
export async function resetKartuTemuanInSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase
      .from('kartu_temuan')
      .delete()
      .gte('id', 0);
  } catch {
    // Safe ignore
  }
}

export default supabase;