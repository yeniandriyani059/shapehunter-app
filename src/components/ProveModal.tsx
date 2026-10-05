import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Plus,
  Minus,
  CheckCircle2,
  RotateCcw,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  Discovery,
  ShapeType,
  SHAPE_DEFINITIONS,
  SHAPE_LIST,
} from '../types/game.ts';
import { ShapeMascot3D, GameAssetImage } from './ShapeMascot3D.tsx';
import { CharacterGuide } from './GameAssets3D.tsx';
import {
  playClickSound,
  playShapeLockSound,
  playTryAgainSound,
} from '../utils/sound.ts';
import { loadSavedGameState, saveGameState } from '../utils/gameStore.ts';
import { supabase, isSupabaseConfigured } from '../supabaseClient.ts';

interface ProveModalProps {
  isOpen: boolean;
  onClose: () => void;
  discovery: Discovery;
  sessionId: number;
  groupId: number;
  guideCharacter?: 'raka' | 'luna';
  onProvedSuccess: (newState: any, result: any) => void;
}

export const ProveModal: React.FC<ProveModalProps> = ({
  isOpen,
  onClose,
  discovery,
  sessionId,
  groupId,
  guideCharacter = 'raka',
  onProvedSuccess,
}) => {
  const [sides, setSides] = useState<number>(0);
  const [corners, setCorners] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: 'correct' | 'wrong' | null;
    message: string;
    pointsAwarded?: number;
  }>({
    status: null,
    message: '',
  });

  if (!isOpen) return null;

  const targetShapeKey = (discovery.classifiedShape ||
    discovery.expectedShape) as ShapeType;
  const shapeDef =
    SHAPE_DEFINITIONS[targetShapeKey] || SHAPE_DEFINITIONS.lingkaran;

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

  const handleSubmitProve = async () => {
    if (submitting) return;
    playClickSound();
    setSubmitting(true);
    setFeedback({ status: null, message: '' });

    try {
      const isCorrect =
        sides === targetShapeDef.sidesCount &&
        corners === targetShapeDef.cornersCount;

      if (isCorrect) {
        playShapeLockSound();
        try {
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.5 },
          });
        } catch {
          // ignore confetti error
        }

        const totalPoints = 15;
        setFeedback({
          status: 'correct',
          message: `HEBAT SEKALI! Terbukti "${discovery.objectName}" memiliki ${sides} sisi dan ${corners} titik sudut!`,
          pointsAwarded: totalPoints,
        });

        // Sync to Supabase table public.kartu_temuan
        if (isSupabaseConfigured) {
          try {
            await supabase
              .from('kartu_temuan')
              .update({ is_proven: true })
              .eq('id', discovery.id);
          } catch (dbErr) {
            console.warn('Supabase update is_proven notice:', dbErr);
          }
        }

        const currentState = loadSavedGameState();
        const updatedDiscoveries = currentState.discoveries.map((d) =>
          d.id === discovery.id
            ? { ...d, traitsVerified: true, isProven: true }
            : d
        );
        const updatedScores = currentState.scores.map((s) =>
          s.groupId === groupId
            ? { ...s, xp: s.xp + totalPoints, bonusPoints: s.bonusPoints + totalPoints }
            : s
        );
        const newState = {
          ...currentState,
          discoveries: updatedDiscoveries,
          scores: updatedScores,
        };
        saveGameState(newState);
        onProvedSuccess(newState, { isCorrect: true, pointsAwarded: 10, bonusAwarded: 5 });
      } else {
        playTryAgainSound();
        const motivationalMessages = [
          'Ups, hitunganmu belum tepat! Coba amati dan hitung kembali tepi & pojok bendanya ya!',
          'Hitunganmu hampir mendekati! Coba cek dan hitung ulang bersama kelompokmu!',
          'Ayo periksa kembali! Pastikan kamu menghitung semua garis lurus dan sudutnya dengan teliti!',
          'Belum pas nih! Coba amati dan hitung ulang tepi serta pojoknya bersama tim ya!',
        ];
        const randomMsg =
          motivationalMessages[
            Math.floor(Math.random() * motivationalMessages.length)
          ];

        setFeedback({
          status: 'wrong',
          message: `${
            guideCharacter === 'luna' ? 'Luna' : 'Raka'
          }: ${randomMsg}`,
        });
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-pop-in"
    >
      <div className="relative w-full max-w-xl rounded-[32px] bg-white border-4 border-amber-400 shadow-[0_16px_0_#D97706] p-5 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <Search className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 truncate">
                Misi 2 — Buktikan Bentuk!
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">
                Hitung jumlah garis sisi & pojok sudut benda temuanmu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Tutup Modal"
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Large Object Photo & Shape Island Tag */}
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-gradient-to-br from-amber-50/70 via-sky-50/50 to-white rounded-3xl p-3.5 border-2 border-amber-200">
          <div className="relative aspect-4/3 w-full sm:w-56 rounded-2xl overflow-hidden bg-slate-900 border-3 border-white shadow-md shrink-0">
            <GameAssetImage
              src={discovery.photoUrl}
              alt={discovery.objectName}
              className="w-full h-full object-contain"
            />
            {discovery.traitsVerified && (
              <span className="absolute top-2 right-2 px-2.5 py-1 rounded-xl bg-emerald-500 text-white font-display font-bold text-xs shadow-md">
                Terbukti
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-center sm:text-left min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 self-center sm:self-start">
              <ShapeMascot3D shape={targetShapeKey} size={28} />
              <span className="font-display text-xs sm:text-sm font-bold text-slate-800">
                {shapeDef.symbol} Pulau {shapeDef.name}
              </span>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 truncate">
              "{discovery.objectName}"
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Dipotret oleh: {discovery.studentName || (discovery as any).penemu || (discovery as any).student_name || (discovery as any).nama || 'Tanpa Nama'}
            </p>
            {discovery.traitsVerified ? (
              <div className="mt-1 px-3 py-1 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Ciri bentuk sudah berhasil dibuktikan!</span>
              </div>
            ) : (
              <div className="text-xs font-bold text-amber-700">
                Mari buktikan kenapa benda ini cocok di pulau {shapeDef.name}!
              </div>
            )}
          </div>
        </div>

        {/* 2 Tactile Children Counters (+ and -) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Counter 1: Sisi Lurus */}
          <div className="rounded-3xl border-3 border-sky-300 bg-sky-50/80 p-4 flex flex-col items-center gap-2 text-center shadow-[0_4px_0_#0284C7]">
            <span className="font-display text-sm font-bold text-sky-950 flex items-center gap-1.5">
              <span>Garis Sisi / Tepi:</span>
            </span>
            <div className="flex items-center gap-3 my-1">
              <button
                type="button"
                onClick={handleDecrementSides}
                disabled={sides <= 0 || submitting}
                aria-label="Kurangi Sisi"
                className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-40 border-2 border-sky-400 shadow-[0_3px_0_#0369A1] font-display text-2xl font-bold text-sky-800 flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <Minus className="w-6 h-6" />
              </button>

              <div className="w-16 h-14 rounded-2xl bg-white border-3 border-sky-500 shadow-inner flex items-center justify-center font-display text-3xl font-bold text-slate-900 tabular-nums">
                {sides}
              </div>

              <button
                type="button"
                onClick={handleIncrementSides}
                disabled={sides >= 10 || submitting}
                aria-label="Tambah Sisi"
                className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-40 border-2 border-sky-400 shadow-[0_3px_0_#0369A1] font-display text-2xl font-bold text-sky-800 flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <p className="text-[11px] font-semibold text-sky-800">
              Hitung garis tepi lurus pada benda
            </p>
          </div>

          {/* Counter 2: Titik Sudut */}
          <div className="rounded-3xl border-3 border-amber-300 bg-amber-50/80 p-4 flex flex-col items-center gap-2 text-center shadow-[0_4px_0_#D97706]">
            <span className="font-display text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <span>Titik Sudut / Pojok:</span>
            </span>
            <div className="flex items-center gap-3 my-1">
              <button
                type="button"
                onClick={handleDecrementCorners}
                disabled={corners <= 0 || submitting}
                aria-label="Kurangi Titik Sudut"
                className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-40 border-2 border-amber-400 shadow-[0_3px_0_#B45309] font-display text-2xl font-bold text-amber-800 flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <Minus className="w-6 h-6" />
              </button>

              <div className="w-16 h-14 rounded-2xl bg-white border-3 border-amber-500 shadow-inner flex items-center justify-center font-display text-3xl font-bold text-slate-900 tabular-nums">
                {corners}
              </div>

              <button
                type="button"
                onClick={handleIncrementCorners}
                disabled={corners >= 10 || submitting}
                aria-label="Tambah Titik Sudut"
                className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-40 border-2 border-amber-400 shadow-[0_3px_0_#B45309] font-display text-2xl font-bold text-amber-800 flex items-center justify-center cursor-pointer active:translate-y-0.5"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <p className="text-[11px] font-semibold text-amber-800">
              Hitung ujung pojok lancip pada benda
            </p>
          </div>
        </div>

        {/* Character Feedback Banner */}
        {feedback.status ? (
          <div
            className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 animate-pop-in ${
              feedback.status === 'correct'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="shrink-0">
              {feedback.status === 'correct' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-600" />
              )}
            </div>
            <div className="flex-1 text-sm font-bold">
              {feedback.message}
              {feedback.pointsAwarded ? (
                <span className="block text-emerald-700 font-display text-base font-bold mt-0.5">
                  +{feedback.pointsAwarded} XP Bintang Pembuktian!
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <CharacterGuide
            character={guideCharacter}
            mood="cheerful"
            message={`Ayo hitung garis sisi dan pojok sudut dari "${discovery.objectName}"!`}
            compact
          />
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {feedback.status === 'correct' ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-3d w-full py-4 px-5 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white font-display text-lg font-bold shadow-[0_5px_0_#047857] flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Selesai & Lanjut Petualangan!</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitProve}
                className="btn-3d flex-1 py-4 px-5 rounded-2xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-display text-lg sm:text-xl font-bold shadow-[0_6px_0_#047857] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                <span>{submitting ? 'MEMERIKSA...' : 'CEK JAWABAN'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSides(0);
                  setCorners(0);
                  setFeedback({ status: null, message: '' });
                }}
                title="Reset Hitungan"
                className="p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
