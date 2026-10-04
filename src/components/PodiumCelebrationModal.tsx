import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Medal, Sparkles, Flame, Target, X, RotateCcw } from 'lucide-react';
import { TeamCampBadge } from './GameAssets3D.tsx';
import { playClickSound } from '../utils/sound.ts';

export interface CampScoreItem {
  id: string | number;
  nama_kelompok: string;
  xp: number;
  total_percobaan: number;
  jawaban_benar: number;
}

interface PodiumCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  kelompokList: CampScoreItem[];
  onResetSession?: () => void;
}

export const PodiumCelebrationModal: React.FC<PodiumCelebrationModalProps> = ({
  isOpen,
  onClose,
  kelompokList,
  onResetSession,
}) => {
  // Fire celebratory confetti when open
  useEffect(() => {
    if (!isOpen) return;

    // Confetti cannon sequence
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#10B981', '#38BDF8', '#EC4899', '#8B5CF6'],
    });

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // Fireworks from left and right edges
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#F59E0B', '#10B981', '#38BDF8', '#EC4899'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#F59E0B', '#10B981', '#38BDF8', '#EC4899'],
      });
    }, 350);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate accuracy and sort:
  // 1) Total XP tertinggi, lalu 2) Ketepatan tertinggi
  const sorted = [...kelompokList].sort((a, b) => {
    if (b.xp !== a.xp) {
      return b.xp - a.xp;
    }
    const accA = a.total_percobaan > 0 ? (a.jawaban_benar / a.total_percobaan) : 1;
    const accB = b.total_percobaan > 0 ? (b.jawaban_benar / b.total_percobaan) : 1;
    return accB - accA;
  });

  const winner = sorted[0];
  const second = sorted[1];
  const third = sorted[2];
  const fourth = sorted[3];

  const getAccuracy = (k?: CampScoreItem) => {
    if (!k || k.total_percobaan === 0) return 100;
    return Math.round((k.jawaban_benar / k.total_percobaan) * 100);
  };

  const getCampColor = (name: string) => {
    const s = name.toLowerCase();
    if (s.includes('biru')) return 'blue';
    if (s.includes('merah')) return 'rose';
    if (s.includes('kuning')) return 'amber';
    if (s.includes('hijau')) return 'emerald';
    return 'blue';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in select-none">
      <div className="relative w-full max-w-4xl rounded-[36px] bg-gradient-to-b from-sky-400 via-sky-500 to-indigo-600 border-4 border-amber-300 shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-5 sm:p-8 flex flex-col items-center text-center text-white overflow-hidden my-auto">
        {/* Glow & Sparkle accents */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-amber-400/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-emerald-400/30 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white border border-white/40 cursor-pointer transition-all"
          title="Tutup Podium"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Badge Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-display font-black text-xs sm:text-sm tracking-wider uppercase shadow-md mb-2">
          <Sparkles className="w-4 h-4 text-slate-950 animate-spin" />
          <span>SELEBRASI PODIUM KEMENANGAN MISI 3</span>
          <Sparkles className="w-4 h-4 text-slate-950 animate-spin" />
        </div>

        {/* Teks Animasi Kemenangan Juara 1 bergaya game (Riffic/Lilita One) */}
        <h1 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-amber-200 tracking-tight leading-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] animate-pop-in mt-1 mb-6">
          YEAY SELAMAT KELOMPOK{' '}
          <span className="text-white underline decoration-amber-400 decoration-wavy">
            {(winner?.nama_kelompok || 'JUARA 1').toUpperCase()}
          </span>{' '}
          MENANG! 🎉
        </h1>

        {/* 3D PODIUM CONTAINER (Slide Up Animation from bottom) */}
        <div className="w-full max-w-3xl flex items-end justify-center gap-2 sm:gap-4 pt-8 pb-4 min-h-[300px]">
          {/* JUARA 2 (Podium Kiri - Silver) */}
          {second && (
            <div className="flex-1 flex flex-col items-center transition-all animate-slide-up duration-500 delay-100">
              {/* Mascot / Avatar */}
              <div className="mb-2 flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 border-3 border-slate-300 p-1 shadow-lg flex items-center justify-center">
                  <TeamCampBadge color={getCampColor(second.nama_kelompok)} size={56} />
                </div>
                <div className="font-display font-black text-xs sm:text-sm text-slate-100 mt-1 truncate max-w-[110px]">
                  {second.nama_kelompok}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-100">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{second.xp} XP</span>
                  <span>·</span>
                  <Target className="w-3 h-3 text-emerald-300" />
                  <span>{getAccuracy(second)}%</span>
                </div>
              </div>

              {/* Balok Podium 2 */}
              <div className="w-full h-36 sm:h-44 rounded-t-3xl bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-t-4 border-x-4 border-white/80 shadow-[0_8px_0_#64748B] flex flex-col items-center justify-start pt-3 text-slate-800">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 border-2 border-slate-400 flex items-center justify-center shadow-inner mb-1">
                  <Medal className="w-6 h-6 text-slate-600" />
                </div>
                <span className="font-display font-black text-2xl sm:text-3xl text-slate-800">2</span>
                <span className="font-display font-bold text-[10px] sm:text-xs text-slate-600 uppercase tracking-wider">
                  Juara 2
                </span>
              </div>
            </div>
          )}

          {/* JUARA 1 (Podium Tengah - Gold Champion, Paling Tinggi) */}
          {winner && (
            <div className="flex-1 flex flex-col items-center z-10 transition-all animate-slide-up duration-500">
              {/* Crown & Mascot */}
              <div className="mb-2 flex flex-col items-center relative">
                {/* Crown */}
                <div className="text-3xl sm:text-4xl animate-bounce mb-[-8px]">
                  👑
                </div>
                <div className="w-20 h-20 sm:w-26 sm:h-26 rounded-3xl bg-amber-400/90 border-4 border-white p-1.5 shadow-[0_0_25px_rgba(251,191,36,0.8)] flex items-center justify-center scale-105">
                  <TeamCampBadge color={getCampColor(winner.nama_kelompok)} size={72} />
                </div>
                <div className="font-display font-black text-sm sm:text-base text-amber-200 mt-1 truncate max-w-[140px] drop-shadow-sm">
                  {winner.nama_kelompok}
                </div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-300">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{winner.xp} XP</span>
                  <span>·</span>
                  <Target className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{getAccuracy(winner)}%</span>
                </div>
              </div>

              {/* Balok Podium 1 (Paling Tinggi) */}
              <div className="w-full h-48 sm:h-60 rounded-t-3xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-t-4 border-x-4 border-amber-100 shadow-[0_10px_0_#B45309] flex flex-col items-center justify-start pt-4 text-slate-950">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 border-2 border-amber-600 flex items-center justify-center shadow-lg mb-1 animate-pulse">
                  <Trophy className="w-8 h-8 text-amber-600" />
                </div>
                <span className="font-display font-black text-3xl sm:text-4xl text-slate-950">1</span>
                <span className="font-display font-black text-xs sm:text-sm text-amber-950 uppercase tracking-wider">
                  JUARA UTAMA
                </span>
              </div>
            </div>
          )}

          {/* JUARA 3 (Podium Kanan - Bronze) */}
          {third && (
            <div className="flex-1 flex flex-col items-center transition-all animate-slide-up duration-500 delay-200">
              {/* Mascot / Avatar */}
              <div className="mb-2 flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 border-3 border-amber-600/40 p-1 shadow-lg flex items-center justify-center">
                  <TeamCampBadge color={getCampColor(third.nama_kelompok)} size={56} />
                </div>
                <div className="font-display font-black text-xs sm:text-sm text-slate-100 mt-1 truncate max-w-[110px]">
                  {third.nama_kelompok}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-100">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{third.xp} XP</span>
                  <span>·</span>
                  <Target className="w-3 h-3 text-emerald-300" />
                  <span>{getAccuracy(third)}%</span>
                </div>
              </div>

              {/* Balok Podium 3 */}
              <div className="w-full h-28 sm:h-36 rounded-t-3xl bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800 border-t-4 border-x-4 border-amber-300/60 shadow-[0_6px_0_#451A03] flex flex-col items-center justify-start pt-2 text-amber-100">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-amber-900 border-2 border-amber-400 flex items-center justify-center shadow-inner mb-1">
                  <Medal className="w-5 h-5 text-amber-300" />
                </div>
                <span className="font-display font-black text-xl sm:text-2xl text-amber-100">3</span>
                <span className="font-display font-bold text-[10px] sm:text-xs text-amber-200 uppercase tracking-wider">
                  Juara 3
                </span>
              </div>
            </div>
          )}
        </div>

        {/* JUARA 4 / APRESIASI KEMAH LAIN */}
        {fourth && (
          <div className="w-full max-w-md bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20 px-4 py-2 flex items-center justify-between text-xs font-display font-bold mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">⭐</span>
              <span>Juara Harapan: {fourth.nama_kelompok}</span>
            </div>
            <div className="flex items-center gap-2 text-amber-300">
              <span>{fourth.xp} XP</span>
              <span>·</span>
              <span>Akurasi {getAccuracy(fourth)}%</span>
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-4 border-t border-white/20 w-full max-w-md">
          {onResetSession && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onResetSession();
              }}
              className="btn-3d px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-sm shadow-[0_4px_0_#B45309] flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Mulai Ronde Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="btn-3d px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-display font-black text-sm border-2 border-white/30 shadow-[0_4px_0_#0F172A] cursor-pointer"
          >
            Kembali ke Dasbor
          </button>
        </div>
      </div>
    </div>
  );
};
