import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  X,
  Image as ImageIcon,
  Flame,
  Award,
  Loader2,
  Target,
} from 'lucide-react';
import {
  supabase,
  uploadFotoTemuan,
  KelompokRow,
  KartuTemuanRow,
} from '../lib/supabase.ts';
import { identifyShapeWithGeminiVision, GeminiVisionResult } from '../lib/gemini.ts';
import { TeamCampBadge } from './GameAssets3D.tsx';
import { LiveCameraModal } from './LiveCameraModal.tsx';
import {
  playClickSound,
  playPhotoIncomingSound,
  playShapeLockSound,
} from '../utils/sound.ts';

interface MobileStudentCameraViewProps {
  onSwitchToHome?: () => void;
}

export const MobileStudentCameraView: React.FC<MobileStudentCameraViewProps> = () => {
  const [kelompokList, setKelompokList] = useState<KelompokRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [teamCards, setTeamCards] = useState<KartuTemuanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Camera & Capture states
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);

  // Processing state: 'uploading' | 'analyzing' | 'done' | null
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [lastUploadedCard, setLastUploadedCard] = useState<KartuTemuanRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch groups from Supabase
  const fetchKelompok = async () => {
    try {
      const { data, error } = await supabase
        .from('kelompok')
        .select('*')
        .order('nama_kelompok', { ascending: true });

      if (!error && data && data.length > 0) {
        setKelompokList(data);
        // Load saved selection or default to first group
        const saved = localStorage.getItem('shape_hunter_student_group_uuid');
        if (saved && data.some((g) => g.id === saved)) {
          setSelectedGroupId(saved);
        } else {
          setSelectedGroupId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching kelompok in mobile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cards for selected group
  const fetchTeamCards = async (groupId: string) => {
    if (!groupId) return;
    try {
      const { data, error } = await supabase
        .from('kartu_temuan')
        .select('*')
        .eq('kelompok_id', groupId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTeamCards(data);
      }
    } catch (err) {
      console.error('Error fetching cards for group:', err);
    }
  };

  useEffect(() => {
    fetchKelompok();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchTeamCards(selectedGroupId);

      // Realtime subscription for team cards
      const channel = supabase
        .channel(`mobile-cards-${selectedGroupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kartu_temuan',
            filter: `kelompok_id=eq.${selectedGroupId}`,
          },
          () => {
            fetchTeamCards(selectedGroupId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kelompok',
            filter: `id=eq.${selectedGroupId}`,
          },
          () => {
            fetchKelompok();
          }
        )
        .subscribe();

      const poll = setInterval(() => fetchTeamCards(selectedGroupId), 3000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(poll);
      };
    }
  }, [selectedGroupId]);

  const activeGroup =
    kelompokList.find((g) => g.id === selectedGroupId) || kelompokList[0];

  const handleGroupSelect = (id: string) => {
    playClickSound();
    setSelectedGroupId(id);
    try {
      localStorage.setItem('shape_hunter_student_group_uuid', id);
    } catch {
      // ignore
    }
  };

  const getCampColor = (name?: string) => {
    const s = (name || '').toLowerCase();
    if (s.includes('biru')) return 'blue';
    if (s.includes('merah')) return 'rose';
    if (s.includes('kuning')) return 'amber';
    if (s.includes('hijau')) return 'emerald';
    return 'blue';
  };

  const getAccuracy = (k?: KelompokRow) => {
    if (!k || k.total_percobaan === 0) return 100;
    return Math.round((k.jawaban_benar / k.total_percobaan) * 100);
  };

  // Process and Upload Photo to Supabase & Gemini AI
  const processAndUploadPhoto = async (dataUrl: string, blob: Blob) => {
    if (!selectedGroupId) {
      setErrorMsg('Pilih kelompokmu terlebih dahulu ya!');
      return;
    }

    setErrorMsg(null);
    setProcessStep('1/2 Mengunggah foto ke Supabase Storage (bucket "foto_temuan")...');

    try {
      // 1. Upload to Supabase Storage bucket 'foto_temuan'
      const publicUrl = await uploadFotoTemuan(blob, selectedGroupId);

      // 2. Send image to Gemini AI Vision with secret instructions
      setProcessStep('2/2 Menganalisis bentuk dengan Gemini AI Vision...');
      const aiResult: GeminiVisionResult = await identifyShapeWithGeminiVision(dataUrl);

      // 3. Save to Supabase table 'kartu_temuan'
      setProcessStep('Menyimpan kartu ke Papan Layar Besar...');
      const { data: newCard, error: insertError } = await supabase
        .from('kartu_temuan')
        .insert({
          kelompok_id: selectedGroupId,
          image_url: publicUrl,
          nama_benda: aiResult.namaBenda,
          real_shape: aiResult.realShape,
          is_proven: false,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      playPhotoIncomingSound();
      setLastUploadedCard(newCard);
      fetchTeamCards(selectedGroupId);
      setPhotoPreview('');
      setRawBlob(null);
    } catch (err: any) {
      console.error('Error during upload/Gemini pipeline:', err);
      setErrorMsg(err.message || 'Gagal memproses foto. Silakan coba lagi.');
    } finally {
      setProcessStep(null);
    }
  };

  // From LiveCameraModal
  const handleCaptureFromLiveCamera = async (dataUrl: string, file: File) => {
    setIsCameraModalOpen(false);
    setPhotoPreview(dataUrl);
    setRawBlob(file);
    await processAndUploadPhoto(dataUrl, file);
  };

  // From native file input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playClickSound();
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      setRawBlob(file);
      await processAndUploadPhoto(dataUrl, file);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 flex flex-col gap-4 pb-20 animate-fade-in select-none">
      {/* 1. HEADER KELOMPOK SISWA (Tab Pemilih Kelompok Siswa) */}
      <div className="rounded-[28px] bg-white/95 border-3 border-amber-400 shadow-[0_6px_0_#F59E0B] p-3.5 sm:p-4">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-display font-black text-xs sm:text-sm text-slate-800 uppercase tracking-wider">
              Kemah Tim Siswa
            </span>
          </div>

          {activeGroup && (
            <div className="flex items-center gap-2 text-xs font-display font-bold">
              <span className="flex items-center gap-1 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-amber-950">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>{activeGroup.xp} XP</span>
              </span>
              <span className="flex items-center gap-1 bg-sky-100 border border-sky-300 px-2.5 py-0.5 rounded-full text-sky-950">
                <Target className="w-3.5 h-3.5 text-sky-600" />
                <span>{getAccuracy(activeGroup)}%</span>
              </span>
            </div>
          )}
        </div>

        {/* Tab Kelompok (Harimau Biru, Elang Merah, Gajah Kuning, Lumba-lumba Hijau) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {kelompokList.map((grp) => {
            const isSelected = grp.id === selectedGroupId;
            const campColor = getCampColor(grp.nama_kelompok);
            const dotBg =
              campColor === 'blue'
                ? 'bg-blue-500'
                : campColor === 'rose'
                ? 'bg-rose-500'
                : campColor === 'amber'
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => handleGroupSelect(grp.id)}
                className={`btn-3d px-3 py-2 rounded-2xl border-2 flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-[0_3px_0_#B45309] font-black scale-102'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white font-bold'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${dotBg} shrink-0`} />
                <span className="font-display text-xs sm:text-sm whitespace-nowrap">
                  {grp.nama_kelompok}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TENGAH: TOMBOL RAKSASA KAMERA ("📷 POTRET BENDA SEKARANG") */}
      <div className="rounded-[32px] bg-gradient-to-b from-sky-400 via-sky-500 to-sky-600 border-4 border-sky-300 shadow-[0_10px_0_#0284C7] p-5 sm:p-7 text-white text-center flex flex-col items-center gap-4 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/20 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />

        {/* Subtitle prompt */}
        <div className="bg-white/20 backdrop-blur-xs px-4 py-1.5 rounded-full border border-white/40 text-xs font-display font-bold text-white shadow-xs">
          ✨ Misi Aktif: Potret Benda Nyata di Sekitarmu!
        </div>

        {/* Hidden Fallback File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* TOMBOL RAKSASA KAMERA ("📷 POTRET BENDA SEKARANG") */}
        <button
          type="button"
          disabled={Boolean(processStep)}
          onClick={() => {
            playClickSound();
            setIsCameraModalOpen(true);
          }}
          className="btn-3d w-full py-7 sm:py-8 px-4 rounded-[30px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-slate-950 border-4 border-amber-200 shadow-[0_8px_0_#B45309] active:translate-y-1 active:shadow-[0_2px_0_#B45309] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none group disabled:opacity-60"
        >
          <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-3xl bg-white/90 border-4 border-amber-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            {processStep ? (
              <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
            ) : (
              <Camera className="w-12 h-12 text-amber-600 animate-pulse" />
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className="font-display font-black text-2xl sm:text-3xl text-slate-950 tracking-tight leading-tight">
              📷 POTRET BENDA SEKARANG
            </span>
            <span className="font-display font-bold text-xs sm:text-sm text-amber-950/80 mt-1">
              Ketuk untuk membuka kamera & kirim ke Kemah
            </span>
          </div>
        </button>

        {/* Tombol alternatif galeri file HP */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            fileInputRef.current?.click();
          }}
          className="text-xs font-display font-bold text-sky-100 hover:text-white underline underline-offset-4 flex items-center gap-1.5 cursor-pointer opacity-90"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Atau pilih dari galeri foto HP</span>
        </button>
      </div>

      {/* PROGRESS / LOADING INDIKATOR GEMINI + SUPABASE */}
      {processStep && (
        <div className="rounded-2xl bg-amber-50 border-3 border-amber-400 p-4 text-amber-950 flex items-center gap-3 animate-pop-in">
          <Loader2 className="w-6 h-6 text-amber-600 animate-spin shrink-0" />
          <div className="flex-1 font-display font-bold text-sm">
            {processStep}
          </div>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 border-2 border-rose-400 p-3.5 text-rose-950 font-display font-bold text-xs">
          {errorMsg}
        </div>
      )}

      {/* SUCCESS NOTIFICATION */}
      {lastUploadedCard && !processStep && (
        <div className="rounded-2xl bg-emerald-50 border-3 border-emerald-400 p-4 text-emerald-950 flex items-center justify-between gap-3 animate-pop-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-400 shrink-0">
              <img
                src={lastUploadedCard.image_url}
                alt={lastUploadedCard.nama_benda || ''}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-display font-black text-sm">
                🎉 Kartu Berhasil Terkirim ke PID!
              </div>
              <div className="text-xs font-semibold text-emerald-800">
                "{lastUploadedCard.nama_benda}" telah dikirim ke Layar Besar untuk dikelompokkan!
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastUploadedCard(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 3. BAWAH: GALERI KECIL (INVENTARIS FOTO KELOMPOK) */}
      <div className="rounded-[30px] bg-white/95 border-3 border-slate-300 shadow-[0_6px_0_#CBD5E1] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎒</span>
            <h3 className="font-display font-black text-base sm:text-lg text-slate-900">
              Galeri Hasil Jepretan {activeGroup?.nama_kelompok || 'Kelompok'}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 font-display font-bold text-xs text-slate-700">
            {teamCards.length} Foto
          </span>
        </div>

        {teamCards.length === 0 ? (
          <div className="py-8 px-4 text-center flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border-2 border-sky-200 flex items-center justify-center text-sky-600">
              <Camera className="w-7 h-7" />
            </div>
            <p className="font-display font-bold text-slate-700 text-sm">
              Belum ada foto yang dipotret oleh {activeGroup?.nama_kelompok || 'kelompok ini'}.
            </p>
            <p className="text-xs text-slate-500 font-semibold max-w-xs">
              Tekan tombol kamera kuning di atas untuk memotret benda pertamamu di sekolah!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {teamCards.map((card) => {
              const isLocked = card.is_proven;

              return (
                <div
                  key={card.id}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-2.5 flex flex-col gap-2 shadow-xs transition-all"
                >
                  {/* Photo Thumbnail */}
                  <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={card.image_url}
                      alt={card.nama_benda || 'Foto Benda'}
                      className="w-full h-full object-cover"
                    />

                    {/* Status Badge */}
                    <div className="absolute top-1.5 right-1.5">
                      {isLocked ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-display font-black text-[10px] shadow-sm flex items-center gap-0.5">
                          ✓ Terkunci (+10 XP)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-display font-bold text-[10px] shadow-sm flex items-center gap-0.5">
                          ⏳ Di PID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Title & Info */}
                  <div className="flex flex-col">
                    <h4
                      className="font-display font-bold text-xs sm:text-sm text-slate-900 truncate"
                      title={card.nama_benda || 'Benda Temuan'}
                    >
                      {card.nama_benda || 'Benda Temuan'}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-1">
                      <span className={isLocked ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                        {isLocked ? `Pulau ${card.real_shape}` : 'Menunggu Dikelompokkan'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Camera Modal */}
      <LiveCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCaptureFromLiveCamera}
      />
    </div>
  );
};
