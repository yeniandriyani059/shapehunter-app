import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Flame,
  Target,
  Clock,
  Sparkles,
  Map,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Maximize2,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { supabase, KelompokRow, KartuTemuanRow } from '../lib/supabase.ts';
import { TeamCampBadge, XpStarsDisplay } from './GameAssets3D.tsx';
import { ShapeMascot3D } from './ShapeMascot3D.tsx';
import { PodiumCelebrationModal } from './PodiumCelebrationModal.tsx';
import {
  playClickSound,
  playShapeLockSound,
  playPhotoIncomingSound,
} from '../utils/sound.ts';

interface DesktopDasborGuruViewProps {
  onSwitchToHome?: () => void;
}

const SHAPE_ISLANDS: Array<{
  id: string;
  name: string;
  bgGradient: string;
  borderColor: string;
  shadowColor: string;
  textColor: string;
  badgeBg: string;
  traits: string;
}> = [
  {
    id: 'Lingkaran',
    name: 'Pulau Lingkaran',
    bgGradient: 'from-amber-100 via-amber-200 to-amber-300',
    borderColor: 'border-amber-500',
    shadowColor: 'shadow-[0_8px_0_#B45309]',
    textColor: 'text-amber-950',
    badgeBg: 'bg-amber-400 text-slate-950',
    traits: '1 sisi melengkung · 0 sudut',
  },
  {
    id: 'Segitiga',
    name: 'Pulau Segitiga',
    bgGradient: 'from-rose-100 via-rose-200 to-rose-300',
    borderColor: 'border-rose-500',
    shadowColor: 'shadow-[0_8px_0_#BE123C]',
    textColor: 'text-rose-950',
    badgeBg: 'bg-rose-500 text-white',
    traits: '3 sisi lurus · 3 sudut',
  },
  {
    id: 'Persegi',
    name: 'Pulau Persegi',
    bgGradient: 'from-sky-100 via-sky-200 to-sky-300',
    borderColor: 'border-sky-500',
    shadowColor: 'shadow-[0_8px_0_#0369A1]',
    textColor: 'text-sky-950',
    badgeBg: 'bg-sky-500 text-white',
    traits: '4 sisi sama panjang · 4 sudut siku-siku',
  },
  {
    id: 'Persegi Panjang',
    name: 'Pulau Persegi Panjang',
    bgGradient: 'from-emerald-100 via-emerald-200 to-emerald-300',
    borderColor: 'border-emerald-500',
    shadowColor: 'shadow-[0_8px_0_#047857]',
    textColor: 'text-emerald-950',
    badgeBg: 'bg-emerald-500 text-white',
    traits: '4 sisi (2 pasang sejajar) · 4 sudut siku-siku',
  },
];

export const DesktopDasborGuruView: React.FC<DesktopDasborGuruViewProps> = ({
  onSwitchToHome,
}) => {
  const [kelompokList, setKelompokList] = useState<KelompokRow[]>([]);
  const [kartuList, setKartuList] = useState<KartuTemuanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    cardId?: string;
  } | null>(null);

  // Selected card for click-to-place (touch / smartboard accessibility)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [bouncingCardId, setBouncingCardId] = useState<string | null>(null);

  // Fetch groups and cards from Supabase
  const fetchData = async () => {
    try {
      const { data: kData, error: kErr } = await supabase
        .from('kelompok')
        .select('*')
        .order('nama_kelompok', { ascending: true });

      if (!kErr && kData) {
        setKelompokList(kData);
      }

      const { data: cData, error: cErr } = await supabase
        .from('kartu_temuan')
        .select('*')
        .order('created_at', { ascending: false });

      if (!cErr && cData) {
        setKartuList(cData);
      }
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Supabase Real-time Subscription for two-way sync
    const channel = supabase
      .channel('dasbor-guru-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kartu_temuan' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playPhotoIncomingSound();
            setActiveFeedback({
              type: 'success',
              message: `📸 Foto baru masuk dari HP: "${(payload.new as KartuTemuanRow).nama_benda || 'Benda Temuan'}"!`,
            });
          }
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kelompok' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Rock-solid polling fallback every 3 seconds
    const interval = setInterval(fetchData, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getCampColor = (name: string) => {
    const s = name.toLowerCase();
    if (s.includes('biru')) return 'blue';
    if (s.includes('merah')) return 'rose';
    if (s.includes('kuning')) return 'amber';
    if (s.includes('hijau')) return 'emerald';
    return 'blue';
  };

  const getAccuracy = (k: KelompokRow) => {
    if (k.total_percobaan === 0) return 100;
    return Math.round((k.jawaban_benar / k.total_percobaan) * 100);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, card: KartuTemuanRow) => {
    e.dataTransfer.setData('text/plain', card.id);
    setSelectedCardId(card.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnIsland = async (
    targetShapeName: string,
    kelompok: KelompokRow
  ) => {
    if (!selectedCardId) return;
    const card = kartuList.find((c) => c.id === selectedCardId);
    if (!card) return;

    await evaluatePlacement(card, targetShapeName, kelompok);
  };

  const evaluatePlacement = async (
    card: KartuTemuanRow,
    targetIslandShape: string,
    kelompok: KelompokRow
  ) => {
    // Normalization check
    const expected = (card.real_shape || '').trim().toLowerCase();
    const target = targetIslandShape.trim().toLowerCase();
    const isCorrect = expected === target;

    if (isCorrect) {
      // JIKA BENAR:
      // 1. Kunci kartu di tabel kartu_temuan (is_proven = true)
      // 2. Beri +10 XP dan update tabel kelompok (xp + 10, jawaban_benar + 1, total_percobaan + 1)
      playShapeLockSound();
      setActiveFeedback({
        type: 'success',
        message: `🎉 BENAR SEKALI! "${card.nama_benda}" adalah ${targetIslandShape}! +10 XP untuk ${kelompok.nama_kelompok}!`,
      });

      // Optimistic update
      setKartuList((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, is_proven: true } : c))
      );
      setKelompokList((prev) =>
        prev.map((k) =>
          k.id === kelompok.id
            ? {
                ...k,
                xp: k.xp + 10,
                jawaban_benar: k.jawaban_benar + 1,
                total_percobaan: k.total_percobaan + 1,
              }
            : k
        )
      );
      setSelectedCardId(null);

      try {
        await supabase
          .from('kartu_temuan')
          .update({ is_proven: true })
          .eq('id', card.id);

        await supabase
          .from('kelompok')
          .update({
            xp: kelompok.xp + 10,
            jawaban_benar: kelompok.jawaban_benar + 1,
            total_percobaan: kelompok.total_percobaan + 1,
          })
          .eq('id', kelompok.id);
      } catch (err) {
        console.error('Error updating correct placement:', err);
      }
    } else {
      // JIKA SALAH:
      // 1. Tolak kartu (bounce back ke slot kemah)
      // 2. Catat sebagai percobaan salah di tabel kelompok (total_percobaan + 1) tanpa mengurangi XP!
      playClickSound();
      setBouncingCardId(card.id);
      setTimeout(() => setBouncingCardId(null), 800);

      setActiveFeedback({
        type: 'error',
        message: `❌ Ups! "${card.nama_benda}" bukan ${targetIslandShape}. Coba amati lagi jumlah sisi & sudutnya ya!`,
      });

      // Optimistic update
      setKelompokList((prev) =>
        prev.map((k) =>
          k.id === kelompok.id
            ? { ...k, total_percobaan: k.total_percobaan + 1 }
            : k
        )
      );

      try {
        await supabase
          .from('kelompok')
          .update({
            total_percobaan: kelompok.total_percobaan + 1,
          })
          .eq('id', kelompok.id);
      } catch (err) {
        console.error('Error updating wrong attempt:', err);
      }
    }
  };

  // Reset function for new round
  const handleResetSession = async () => {
    try {
      // Reset scores in kelompok
      for (const k of kelompokList) {
        await supabase
          .from('kelompok')
          .update({ xp: 0, total_percobaan: 0, jawaban_benar: 0 })
          .eq('id', k.id);
      }
      // Reset is_proven in kartu_temuan
      await supabase.from('kartu_temuan').update({ is_proven: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      fetchData();
      setIsVictoryModalOpen(false);
      setActiveFeedback({
        type: 'success',
        message: 'Ronde baru dimulai! Skor dan status kartu berhasil di-reset.',
      });
    } catch (err) {
      console.error('Error resetting session:', err);
    }
  };

  return (
    <div className="w-full max-w-[1580px] mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4 animate-fade-in select-none">
      {/* 1. TOP HUD BAR: DASBOR ARENA GURU & PAPAN SKOR UTAMA */}
      <div className="rounded-[28px] bg-slate-900/95 backdrop-blur-md border-3 border-amber-400 shadow-[0_8px_0_#0F172A] p-3.5 sm:p-4 text-white flex flex-wrap items-center justify-between gap-3">
        {/* Left: Dasbor Title & Realtime indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-display font-black text-lg shadow-sm">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-lg sm:text-xl text-amber-300 tracking-wide">
                DASBOR ARENA GURU (PID)
              </h1>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Supabase Real-time Aktif" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              Papan Skor Utama & Monitor Drag-and-Drop 4 Kelompok Kemah
            </p>
          </div>
        </div>

        {/* Center: Live Camp Score Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {kelompokList.map((k) => {
            const color = getCampColor(k.nama_kelompok);
            const borderCol =
              color === 'blue'
                ? 'border-sky-400 bg-sky-950/60'
                : color === 'rose'
                ? 'border-rose-400 bg-rose-950/60'
                : color === 'amber'
                ? 'border-amber-400 bg-amber-950/60'
                : 'border-emerald-400 bg-emerald-950/60';

            return (
              <div
                key={k.id}
                className={`px-3 py-1.5 rounded-2xl border-2 ${borderCol} flex items-center gap-2 text-xs shadow-xs`}
              >
                <TeamCampBadge color={color} size={24} />
                <span className="font-display font-bold text-white whitespace-nowrap">
                  {k.nama_kelompok}
                </span>
                <span className="font-display font-black text-amber-300 px-1.5 py-0.5 rounded-md bg-slate-900/80">
                  {k.xp} XP
                </span>
                <span className="text-[11px] text-slate-300 font-bold">
                  {getAccuracy(k)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: Tombol Simulasi "Selesaikan Misi 3" & Home */}
        <div className="flex items-center gap-2">
          {/* Tombol Simulasi "Selesaikan Misi 3" sesuai instruksi */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsVictoryModalOpen(true);
            }}
            className="btn-3d px-4 py-2 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-black text-xs sm:text-sm border-2 border-amber-300 shadow-[0_4px_0_#B45309] flex items-center gap-2 cursor-pointer"
            title="Selesaikan Misi 3 dan Buka Layar Selebrasi Podium Kemenangan"
          >
            <Trophy className="w-4 h-4 text-slate-950" />
            <span>Selesaikan Misi 3</span>
          </button>

          {onSwitchToHome && (
            <button
              type="button"
              onClick={onSwitchToHome}
              className="btn-3d px-3 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-display font-bold text-xs cursor-pointer"
            >
              Beranda
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNER (SUCCESS / BOUNCE ERROR) */}
      {activeFeedback && (
        <div
          className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-display font-bold flex items-center justify-between gap-3 animate-pop-in ${
            activeFeedback.type === 'success'
              ? 'bg-emerald-100 border-emerald-400 text-emerald-950 shadow-sm'
              : 'bg-amber-100 border-amber-400 text-amber-950 shadow-sm animate-gentle-shake'
          }`}
        >
          <div className="flex items-center gap-2">
            {activeFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{activeFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFeedback(null)}
            className="text-xs underline font-bold opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. GRID SELURUH KELOMPOK KEMAH (4 Kuadran Aktivitas Drag & Drop) */}
      {loading ? (
        <div className="max-w-md mx-auto my-20 p-8 rounded-3xl bg-white border-4 border-amber-400 text-center font-display font-bold text-lg text-slate-800 shadow-xl">
          Memuat Arena Kemah dari Supabase...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {kelompokList.map((kelompok) => {
            const campColor = getCampColor(kelompok.nama_kelompok);
            const teamCards = kartuList.filter(
              (c) => c.kelompok_id === kelompok.id
            );
            const unprovenCards = teamCards.filter((c) => !c.is_proven);
            const provenCards = teamCards.filter((c) => c.is_proven);

            const themeBorder =
              campColor === 'blue'
                ? 'border-sky-400'
                : campColor === 'rose'
                ? 'border-rose-400'
                : campColor === 'amber'
                ? 'border-amber-400'
                : 'border-emerald-400';

            const themeHeaderBg =
              campColor === 'blue'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600'
                : campColor === 'rose'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600'
                : campColor === 'amber'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600';

            return (
              <div
                key={kelompok.id}
                className={`rounded-[32px] bg-white/95 border-4 ${themeBorder} shadow-[0_10px_0_#CBD5E1] p-4 sm:p-5 flex flex-col gap-4 relative overflow-hidden`}
              >
                {/* Kemah Header Bar */}
                <div
                  className={`rounded-2xl ${themeHeaderBg} p-3 text-white flex items-center justify-between shadow-sm`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white/95 p-1 shadow-md flex items-center justify-center">
                      <TeamCampBadge color={campColor} size={36} />
                    </div>
                    <div>
                      <h2 className="font-display font-black text-base sm:text-lg text-white leading-tight">
                        {kelompok.nama_kelompok}
                      </h2>
                      <span className="text-[11px] font-bold text-white/90">
                        {provenCards.length} Kartu Terkunci
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-black/20 rounded-xl px-2.5 py-1 text-xs font-display font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      <span>{kelompok.xp} XP</span>
                    </div>
                    <div className="bg-black/20 rounded-xl px-2.5 py-1 text-xs font-display font-bold flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{getAccuracy(kelompok)}% Akurat</span>
                    </div>
                  </div>
                </div>

                {/* SLOT KARTU TEMUAN DARI HP SISWA (Unproven Cards) */}
                <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-display font-bold text-slate-700">
                      <span>📥 Kartu Temuan dari HP Siswa:</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px]">
                        {unprovenCards.length} Menunggu Dikelompokkan
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                      Tarik (drag) kartu ke pulau bentuk di bawah 👇
                    </span>
                  </div>

                  {unprovenCards.length === 0 ? (
                    <div className="py-5 text-center flex flex-col items-center justify-center gap-1 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs font-semibold">
                      <span>Belum ada foto yang masuk dari HP {kelompok.nama_kelompok}.</span>
                      <span className="text-[11px] text-slate-400">
                        Siswa dapat membuka Kamera di HP untuk memotret benda nyata!
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-1 scrollbar-none">
                      {unprovenCards.map((card) => {
                        const isSelected = selectedCardId === card.id;
                        const isBouncing = bouncingCardId === card.id;

                        return (
                          <div
                            key={card.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, card)}
                            onClick={() => {
                              playClickSound();
                              setSelectedCardId(isSelected ? null : card.id);
                            }}
                            className={`w-32 sm:w-36 rounded-2xl bg-white border-3 p-2 flex flex-col gap-1.5 shrink-0 cursor-grab active:cursor-grabbing transition-all select-none ${
                              isBouncing
                                ? 'border-rose-500 bg-rose-50 animate-gentle-shake'
                                : isSelected
                                ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-300 scale-105 shadow-md'
                                : 'border-slate-300 hover:border-amber-400 shadow-xs'
                            }`}
                            title="Tarik kartu ini ke salah satu Pulau Bentuk di bawah"
                          >
                            {/* Card Image */}
                            <div className="relative w-full h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                              <img
                                src={card.image_url}
                                alt={card.nama_benda || 'Foto Benda'}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-amber-300 text-[9px] font-display font-bold">
                                ? Bentuk
                              </div>
                            </div>

                            {/* Card Title (TANPA MENYEBUTKAN BENTUK ASLI SESUAI INSTRUKSI) */}
                            <div className="text-center">
                              <h4 className="font-display font-bold text-xs text-slate-900 truncate" title={card.nama_benda || 'Benda Temuan'}>
                                {card.nama_benda || 'Benda Temuan'}
                              </h4>
                              <div className="text-[10px] text-sky-700 font-bold mt-0.5">
                                Tarik ke Pulau!
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4 PULAU BENTUK (DROP ZONES) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SHAPE_ISLANDS.map((island) => {
                    // Cards of this group that belong to this island and are locked/proven
                    const islandCards = provenCards.filter(
                      (c) => (c.real_shape || '').trim().toLowerCase() === island.id.toLowerCase()
                    );

                    return (
                      <div
                        key={island.id}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDropOnIsland(island.id, kelompok)}
                        onClick={() => {
                          if (selectedCardId) {
                            handleDropOnIsland(island.id, kelompok);
                          }
                        }}
                        className={`rounded-2xl bg-gradient-to-b ${island.bgGradient} border-3 ${island.borderColor} ${island.shadowColor} p-2.5 flex flex-col justify-between min-h-[145px] transition-all cursor-pointer hover:scale-102 relative overflow-hidden`}
                      >
                        {/* Island Header */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-display font-black px-2 py-0.5 rounded-lg ${island.badgeBg}`}>
                              {island.name}
                            </span>
                            <span className="text-[11px] font-bold text-slate-800">
                              {islandCards.length}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-700 font-semibold leading-tight mb-2">
                            {island.traits}
                          </div>
                        </div>

                        {/* Proven Cards inside Island */}
                        <div className="flex-1 flex flex-col justify-end">
                          {islandCards.length === 0 ? (
                            <div className="py-2 text-center text-[10px] font-bold text-slate-500 border border-dashed border-slate-400/60 rounded-xl bg-white/40">
                              Drop kartu di sini
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                              {islandCards.slice(0, 3).map((pc) => (
                                <div
                                  key={pc.id}
                                  className="w-8 h-8 rounded-lg overflow-hidden border border-white shadow-xs shrink-0"
                                  title={`${pc.nama_benda} (Benar +10 XP)`}
                                >
                                  <img
                                    src={pc.image_url}
                                    alt={pc.nama_benda || ''}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {islandCards.length > 3 && (
                                <span className="text-[10px] font-bold text-slate-700">
                                  +{islandCards.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Interactive Drop Hint if a card is selected */}
                        {selectedCardId && (
                          <div className="absolute inset-0 bg-amber-400/20 backdrop-blur-[1px] flex items-center justify-center p-1 pointer-events-none">
                            <span className="px-2 py-1 rounded-lg bg-slate-900 text-amber-300 font-display font-bold text-[10px] shadow-sm">
                              Klik / Lepas di Sini
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. PODIUM CELEBRATION MODAL (MISI 3) */}
      <PodiumCelebrationModal
        isOpen={isVictoryModalOpen}
        onClose={() => setIsVictoryModalOpen(false)}
        kelompokList={kelompokList}
        onResetSession={handleResetSession}
      />
    </div>
  );
};
