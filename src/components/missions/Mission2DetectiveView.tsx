import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Group,
  Discovery,
  SHAPE_DEFINITIONS,
  ShapeType,
} from '../../types/game.ts';
import { GameAssetImage } from '../ShapeMascot3D.tsx';
import {
  playClickSound,
  playShapeLockSound,
  playTryAgainSound,
} from '../../utils/sound.ts';
import { loadSavedGameState, saveGameState } from '../../utils/gameStore.ts';
import { supabase, isSupabaseConfigured } from '../../supabaseClient.ts';
import {
  Sparkles,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Lock,
  X,
} from 'lucide-react';

export interface Mission2DetectiveViewProps {
  campSide: 'left' | 'right';
  sessionId: number;
  isPlaying: boolean;
  group: Group;
  groupDiscoveries: Discovery[];
  guideCharacter: 'raka' | 'luna';
  onAttemptSubmitted: (newState: any) => void;
  onSetGuideMessage?: (msg: {
    mood: 'cheerful' | 'celebrating' | 'hint';
    text: string;
    pointsEarned?: number;
  }) => void;
}

export const Mission2DetectiveView: React.FC<Mission2DetectiveViewProps> = ({
  campSide,
  sessionId,
  isPlaying,
  group,
  groupDiscoveries,
  guideCharacter,
  onAttemptSubmitted,
  onSetGuideMessage,
}) => {
  // Modal state for proving an unproven card
  const [modalDiscovery, setModalDiscovery] = useState<Discovery | null>(null);

  // Counters for the active modal card
  const [sides, setSides] = useState<number>(0);
  const [corners, setCorners] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: 'correct' | 'wrong' | null;
    message: string;
    pointsAwarded?: number;
  }>({ status: null, message: '' });

  // Open modal for unproven card
  const handleOpenProveModal = (disc: Discovery) => {
    const isAlreadyProven = disc.traitsVerified || disc.isProven;
    if (isAlreadyProven || !isPlaying) return;

    playClickSound();
    setModalDiscovery(disc);
    setSides(0);
    setCorners(0);
    setFeedback({ status: null, message: '' });
  };

  const handleCloseModal = () => {
    playClickSound();
    setModalDiscovery(null);
    setFeedback({ status: null, message: '' });
  };

  const handleIncrementSides = () => {
    playClickSound();
    if (feedback.status === 'wrong') setFeedback({ status: null, message: '' });
    setSides((prev) => Math.min(10, prev + 1));
  };

  const handleDecrementSides = () => {
    playClickSound();
    if (feedback.status === 'wrong') setFeedback({ status: null, message: '' });
    setSides((prev) => Math.max(0, prev - 1));
  };

  const handleIncrementCorners = () => {
    playClickSound();
    if (feedback.status === 'wrong') setFeedback({ status: null, message: '' });
    setCorners((prev) => Math.min(10, prev + 1));
  };

  const handleDecrementCorners = () => {
    playClickSound();
    if (feedback.status === 'wrong') setFeedback({ status: null, message: '' });
    setCorners((prev) => Math.max(0, prev - 1));
  };

  const modalShapeKey = (modalDiscovery?.island ||
    modalDiscovery?.classifiedShape ||
    modalDiscovery?.realShape ||
    modalDiscovery?.expectedShape ||
    'lingkaran') as ShapeType;
  const modalShapeDef =
    SHAPE_DEFINITIONS[modalShapeKey] || SHAPE_DEFINITIONS.lingkaran;

  const handleSubmitProve = async () => {
    if (!modalDiscovery || submitting || !isPlaying) return;
    playClickSound();
    setSubmitting(true);
    setFeedback({ status: null, message: '' });

    try {
      // Circle allows 0 or 1 curved side with 0 corners
      const isCorrect =
        modalShapeKey === 'lingkaran'
          ? (sides === 0 || sides === 1) && corners === 0
          : sides === modalShapeDef.sidesCount &&
            corners === modalShapeDef.cornersCount;

      if (isCorrect) {
        playShapeLockSound();
        try {
          confetti({
            particleCount: 85,
            spread: 80,
            origin: { x: campSide === 'left' ? 0.3 : 0.7, y: 0.5 },
          });
        } catch {
          // ignore confetti error
        }

        const totalPoints = 15;

        setFeedback({
          status: 'correct',
          message: `⭐ LUAR BIASA! Terbukti "${modalDiscovery.objectName}" cocok sebagai ${modalShapeDef.name.toUpperCase()} (${sides} sisi & ${corners} titik sudut)! (+${totalPoints} XP ⭐)`,
          pointsAwarded: totalPoints,
        });

        // Sync to Supabase table public.kartu_temuan
        if (isSupabaseConfigured) {
          try {
            await supabase
              .from('kartu_temuan')
              .update({ is_proven: true })
              .eq('id', modalDiscovery.id);
          } catch (dbErr) {
            console.warn('Supabase update is_proven notice:', dbErr);
          }
        }

        const currentState = loadSavedGameState();
        const updatedDiscoveries = currentState.discoveries.map((d) =>
          d.id === modalDiscovery.id
            ? {
                ...d,
                traitsVerified: true,
                isProven: true,
                isLocked: true,
                island: d.island || modalShapeKey,
                classifiedShape: d.classifiedShape || modalShapeKey,
              }
            : d
        );
        const updatedScores = currentState.scores.map((s) =>
          s.groupId === group.id
            ? { ...s, xp: s.xp + totalPoints, bonusPoints: s.bonusPoints + totalPoints }
            : s
        );
        const newState = {
          ...currentState,
          discoveries: updatedDiscoveries,
          scores: updatedScores,
        };
        saveGameState(newState);

        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'celebrating',
            text: `Misi Buktikan Berhasil! "${modalDiscovery.objectName}" terbukti dan terkunci! (+${totalPoints} XP)`,
            pointsEarned: totalPoints,
          });
        }

        onAttemptSubmitted(newState);
      } else {
        playTryAgainSound();
        const motivationalMessages = [
          `Periksa lagi: Bangun ${modalShapeDef.name} memiliki ${modalShapeDef.sidesCount} sisi dan ${modalShapeDef.cornersCount} sudut!`,
          'Hitunganmu hampir mendekati! Coba cek dan hitung ulang bersama kelompokmu!',
          'Ayo periksa kembali! Pastikan kamu menghitung semua garis tepi dan sudutnya dengan teliti!',
          'Belum pas nih! Coba amati dan hitung ulang tepi serta pojoknya bersama tim ya!',
        ];
        const randomMsg =
          motivationalMessages[
            Math.floor(Math.random() * motivationalMessages.length)
          ];

        setFeedback({
          status: 'wrong',
          message: `${guideCharacter === 'luna' ? 'Luna' : 'Raka'}: ${randomMsg}`,
        });

        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'hint',
            text: `${guideCharacter === 'luna' ? 'Luna' : 'Raka'}: ${randomMsg}`,
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        status: 'wrong',
        message: err.message || 'Yuk periksa lagi hitunganmu!',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const provenCount = groupDiscoveries.filter(
    (d) => d.traitsVerified || d.isProven
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Top Detective Badge Header */}
      <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-amber-200 border-2 border-amber-400 flex items-center justify-center font-display font-black text-amber-950 text-sm shrink-0 shadow-xs">
            M2
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold text-amber-950 truncate">
              Misi 2: Detektif Bentuk — Buktikan Ciri Sisi & Sudut!
            </h3>
            <p className="text-xs text-amber-900 truncate">
              Klik kartu benda yang belum terbukti untuk menghitung sisi dan sudutnya (+15 XP).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-display font-bold text-xs shadow-xs">
            {provenCount}/{groupDiscoveries.length} Kartu Terbukti & Terkunci
          </span>
        </div>
      </div>

      {/* 2. Grid of Detective Evidence Cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-amber-600" />
            <span>Papan Bukti Temuan Kemah ({groupDiscoveries.length} Kartu):</span>
          </h4>
          <span className="text-xs text-slate-500 font-semibold">
            {provenCount === groupDiscoveries.length && groupDiscoveries.length > 0
              ? 'Semua kartu telah terbukti!'
              : 'Ketuk kartu untuk membuktikan'}
          </span>
        </div>

        {groupDiscoveries.length === 0 ? (
          <div className="rounded-3xl border-3 border-dashed border-amber-300 bg-amber-50/70 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center mx-auto mb-2 text-amber-700">
              <Search className="w-6 h-6" />
            </div>
            <p className="font-display text-base sm:text-lg font-bold text-amber-950">
              Belum Ada Kartu Benda yang Ditemukan
            </p>
            <p className="text-xs sm:text-sm text-amber-800 mt-1 max-w-sm mx-auto">
              Buka kamera di HP siswa untuk memotret benda di lingkungan sekolah agar masuk ke papan detektif!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {groupDiscoveries.map((disc, idx) => {
              const isProven = disc.traitsVerified || disc.isProven;
              const cardShape =
                SHAPE_DEFINITIONS[
                  (disc.realShape ||
                    disc.classifiedShape ||
                    disc.expectedShape) as ShapeType
                ] || SHAPE_DEFINITIONS.lingkaran;

              return (
                <div
                  key={`m2-disc-${disc.id}`}
                  onClick={() => !isProven && handleOpenProveModal(disc)}
                  className={`group relative rounded-3xl border-3 p-3 flex flex-col justify-between transition-all ${
                    isProven
                      ? 'border-emerald-400 bg-emerald-50/90 shadow-sm cursor-default'
                      : 'border-amber-300 bg-white hover:border-amber-500 hover:shadow-lg hover:-translate-y-1 cursor-pointer active:scale-98'
                  }`}
                  title={
                    isProven
                      ? 'Kartu ini sudah terbukti dan terkunci!'
                      : 'Klik kartu ini untuk membuktikan sisi & sudut!'
                  }
                >
                  {/* Photo with Badge */}
                  <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 mb-2.5 border border-slate-200">
                    <GameAssetImage
                      src={disc.photoUrl}
                      alt={disc.objectName}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />

                    {/* Shape Tag */}
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-slate-950/75 text-white font-display font-bold text-[10px] backdrop-blur-xs">
                      {cardShape.symbol} {cardShape.name}
                    </span>

                    {/* Proven Status Badge Overlay */}
                    {isProven && (
                      <div className="absolute inset-0 bg-emerald-950/30 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-lg shadow-md mb-1 animate-pop-in">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="bg-emerald-600 text-white text-[10px] font-display font-bold px-2 py-0.5 rounded-full shadow-xs">
                          Terbukti
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="text-center">
                    <h5 className="font-display text-sm font-bold text-slate-900 truncate">
                      {disc.objectName}
                    </h5>
                    <p className="text-[11px] font-bold text-sky-700 truncate mt-0.5 flex items-center justify-center gap-1">
                      <span>👤</span>
                      <span>{disc.studentName || (disc as any).penemu || (disc as any).student_name || (disc as any).nama || 'Tanpa Nama'}</span>
                    </p>
                  </div>

                  {/* Card Bottom Action / Status Button */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    {isProven ? (
                      <div className="w-full py-1.5 px-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-display font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs">
                        <Lock className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Terkunci & Selesai</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProveModal(disc);
                        }}
                        className="btn-3d w-full py-2 px-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_0_#B45309] cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5 text-slate-950" />
                        <span>Buktikan! (+15 XP)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. MODAL PEMBUKTIAN DETEKTIF (Saat Kartu Diklik) */}
      {modalDiscovery && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in"
        >
          <div className="relative w-full max-w-lg bg-white border-4 border-amber-400 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 border-b-2 border-amber-500 flex items-center justify-between text-slate-950">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-slate-950 text-amber-300 font-bold flex items-center justify-center text-sm shadow-xs">
                  <Search className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-slate-950 truncate max-w-[260px]">
                    Buktikan: {modalDiscovery.objectName}
                  </h3>
                  <p className="text-[11px] font-semibold text-amber-950">
                    Hitung garis lurus (sisi) dan titik pojoknya (sudut)!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl bg-white/70 hover:bg-white text-slate-800 border border-amber-500 cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
              {/* Photo Evidence with Watermark */}
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 shadow-inner max-h-56 mx-auto w-full">
                <GameAssetImage
                  src={modalDiscovery.photoUrl}
                  alt={modalDiscovery.objectName}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2.5 right-2.5 px-3 py-1 rounded-full bg-slate-950/70 text-amber-300 text-xs font-display font-bold backdrop-blur-xs flex items-center gap-1 border border-amber-400/40">
                  <span>Amati Tepian Benda</span>
                </div>
              </div>

              {/* Counter 1: Sisi */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border-2 border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-xs sm:text-sm font-bold text-slate-900">
                    1. Berapa Jumlah Sisi / Garis Lurusnya?
                  </span>
                  <span className="text-[11px] text-amber-900 font-semibold">
                    (Garis tepi benda)
                  </span>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleDecrementSides}
                    className="btn-3d w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-display font-bold text-2xl flex items-center justify-center shadow-[0_3px_0_#BE123C] cursor-pointer"
                    title="Kurangi Sisi"
                  >
                    <Minus className="w-6 h-6" />
                  </button>

                  <div className="w-24 py-1.5 rounded-2xl bg-white border-2 border-slate-300 text-center shadow-inner">
                    <span className="font-display text-3xl font-black text-slate-900 tabular-nums">
                      {sides}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Sisi
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrementSides}
                    className="btn-3d w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-display font-bold text-2xl flex items-center justify-center shadow-[0_3px_0_#047857] cursor-pointer"
                    title="Tambah Sisi"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Counter 2: Titik Sudut */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border-2 border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-xs sm:text-sm font-bold text-slate-900">
                    2. Berapa Jumlah Titik Sudut / Pojoknya?
                  </span>
                  <span className="text-[11px] text-amber-900 font-semibold">
                    (Pojok lancip/pertemuan)
                  </span>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleDecrementCorners}
                    className="btn-3d w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-display font-bold text-2xl flex items-center justify-center shadow-[0_3px_0_#BE123C] cursor-pointer"
                    title="Kurangi Sudut"
                  >
                    <Minus className="w-6 h-6" />
                  </button>

                  <div className="w-24 py-1.5 rounded-2xl bg-white border-2 border-slate-300 text-center shadow-inner">
                    <span className="font-display text-3xl font-black text-slate-900 tabular-nums">
                      {corners}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Sudut
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrementCorners}
                    className="btn-3d w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-display font-bold text-2xl flex items-center justify-center shadow-[0_3px_0_#047857] cursor-pointer"
                    title="Tambah Sudut"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Feedback Message */}
              {feedback.status && (
                <div
                  className={`p-3.5 rounded-2xl border-2 flex items-start gap-2.5 animate-pop-in ${
                    feedback.status === 'correct'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                      : 'bg-rose-50 border-rose-400 text-rose-950'
                  }`}
                >
                  {feedback.status === 'correct' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs sm:text-sm font-semibold">
                    {feedback.message}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t-2 border-slate-100 flex items-center gap-3">
              {feedback.status === 'correct' ? (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-3d w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-display text-base font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#047857] cursor-pointer"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Selesai & Kunci Kartu</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-200 font-display font-bold text-sm cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitProve}
                    disabled={submitting || !isPlaying}
                    className="btn-3d flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display text-base font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_#B45309] cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-5 h-5 text-slate-950" />
                    <span>
                      {submitting ? 'MEMERIKSA...' : 'CEK JAWABAN BUKTIKAN!'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
