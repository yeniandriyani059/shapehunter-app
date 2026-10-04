import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Kredensial Supabase sesuai instruksi user untuk prototipe
export const SUPABASE_URL = 'https://nqdopaupzxibaozlolpl.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';

export const isSupabaseConfigured = true;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const STORAGE_BUCKET = 'foto_temuan';

export interface KelompokRow {
  id: string;
  nama_kelompok: string;
  xp: number;
  total_percobaan: number;
  jawaban_benar: number;
}

export interface KartuTemuanRow {
  id: string;
  kelompok_id: string | null;
  image_url: string;
  nama_benda: string | null;
  real_shape: string | null; // 'Lingkaran' | 'Segitiga' | 'Persegi' | 'Persegi Panjang'
  is_proven: boolean;
  created_at?: string;
}

/**
 * Uploads a student photo to Supabase Storage bucket 'foto_temuan'
 * and returns its public URL.
 */
export async function uploadFotoTemuan(
  fileOrBlob: File | Blob,
  kelompokId: string
): Promise<string> {
  const ext = fileOrBlob instanceof File && fileOrBlob.name
    ? fileOrBlob.name.split('.').pop() || 'jpg'
    : 'jpg';

  const fileName = `${kelompokId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileOrBlob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/jpeg',
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Gagal mengunggah foto ke storage: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  if (!publicUrlData?.publicUrl) {
    throw new Error('Gagal mendapatkan Public URL dari Supabase Storage');
  }

  return publicUrlData.publicUrl;
}

// Backward compatibility helper
export async function uploadDiscoveryPhotoToStorage(
  fileOrDataUrl: File | string,
  _sessionCode: string,
  groupId: number | string
): Promise<string> {
  if (typeof fileOrDataUrl === 'string') {
    // If it's a data URL, convert to Blob and upload
    const res = await fetch(fileOrDataUrl);
    const blob = await res.blob();
    return uploadFotoTemuan(blob, String(groupId));
  }
  return uploadFotoTemuan(fileOrDataUrl, String(groupId));
}
