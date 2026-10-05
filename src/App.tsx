/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import {
  FullSessionState,
  SHAPE_LIST,
  GAME_ASSETS,
  MISSION_LEVELS,
  formatCampDisplayName,
} from './types/game.ts';
import { PidBoardView } from './components/PidBoardView.tsx';
import { StudentUploaderView } from './components/StudentUploaderView.tsx';
import { TeacherDashboardView } from './components/TeacherDashboardView.tsx';
import { ShapeMascot3D, GameAssetImage } from './components/ShapeMascot3D.tsx';
import {
  SchoolWorldBackdrop,
  CharacterGuide,
  GeometricMascotParade,
  XpStarsDisplay,
  TeamCampBadge,
} from './components/GameAssets3D.tsx';
import {
  loadSavedGameState,
  saveGameState,
  updateMissionLevel,
  resetGameSession,
} from './utils/gameStore.ts';
import {
  supabase,
  isSupabaseConfigured,
  fetchKartuTemuanFromSupabase,
} from './supabaseClient.ts';
import { Discovery, ShapeType } from './types/game.ts';
import { LeaderboardModal } from './components/LeaderboardModal.tsx';
import { PodiumCelebrationModal } from './components/PodiumCelebrationModal.tsx';
import { Trophy, Award, Map, Sparkles } from 'lucide-react';
import {
  playClickSound,
  playPhotoIncomingSound,
  playShapeLockSound,
} from './utils/sound.ts';

type GameScreen =
  | 'start'
  | 'arena'
  | 'misi'
  | 'koleksi'
  | 'lencana'
  | 'uploader'
  | 'teacher';

function ShapeHunterApp() {
  const [screen, setScreen] = useState<GameScreen>('start');
  const [gameState, setGameState] = useState<FullSessionState>(() => loadSavedGameState());
  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600);
  const [koleksiShapeFilter, setKoleksiShapeFilter] = useState<string>('all');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isVictoryPodiumOpen, setIsVictoryPodiumOpen] = useState(false);

  const applyNewState = useCallback((nextState: FullSessionState) => {
    if (!nextState || !nextState.session) return;
    setGameState(nextState);
    saveGameState(nextState);
    if (typeof nextState.session.timerRemainingSeconds === 'number') {
      setRemainingSeconds(nextState.session.timerRemainingSeconds);
    }
  }, []);

  // Supabase as Single Source of Truth & Direct Realtime Event Handling
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // 1. Initial Load: Fetch all discoveries from Supabase once on mount
    const loadInitialSupabaseCards = async () => {
      try {
        const cards = await fetchKartuTemuanFromSupabase();
        if (Array.isArray(cards)) {
          setGameState((prev) => {
            if (!prev || !prev.session) return prev;

            const isCardInActiveSession = (cardRow: any) => {
              if (cardRow.session_code && prev.session.code) {
                return cardRow.session_code === prev.session.code;
              }
              if (cardRow.session_id && prev.session.id) {
                return Number(cardRow.session_id) === Number(prev.session.id);
              }
              if (prev.session.createdAt && cardRow.created_at) {
                return new Date(cardRow.created_at).getTime() >= new Date(prev.session.createdAt).getTime() - 10000;
              }
              return true;
            };

            const sessionCards = cards.filter(isCardInActiveSession);
            const seenIds = new Set<number>();
            const uniqueDiscoveries: Discovery[] = [];

            for (const card of sessionCards) {
              const cardId = Number(card.id);
              if (seenIds.has(cardId)) continue;
              seenIds.add(cardId);

              const existing = prev?.discoveries?.find((d) => d.id === cardId);
              const shape = (card.real_shape || 'lingkaran') as ShapeType;
              const isProven = Boolean(card.is_proven);
              const cardXp = typeof card.xp === 'number' && card.xp > 0 ? card.xp : (Number(card.xp) || 10);
              const studentName = (card as any).penemu || (card as any).student_name || (card as any).nama_siswa || (card as any).nama || existing?.studentName || 'Tanpa Nama';

              uniqueDiscoveries.push({
                id: cardId,
                sessionId: prev?.session?.id || 1,
                groupId: Number(card.kelompok_id) || 1,
                studentName: studentName,
                objectName: card.nama_benda || 'Benda Temuan',
                photoUrl: card.image_url || '',
                realShape: shape,
                expectedShape: shape,
                studentClaimedShape: shape,
                classifiedShape: existing?.classifiedShape ?? (existing?.island ?? null),
                island: existing?.island ?? existing?.classifiedShape ?? null,
                targetShape: existing?.targetShape ?? existing?.island ?? null,
                isLocked: existing?.isLocked ?? false,
                annotationsJson: existing?.annotationsJson ?? '[]',
                traitsVerified: isProven,
                isProven: isProven,
                xp: cardXp,
                createdAt: existing?.createdAt || new Date().toISOString(),
              });
            }

            const updatedScores = prev.scores.map((score) => {
              const groupCards = uniqueDiscoveries.filter((d) => d.groupId === score.groupId);
              const groupCardCount = groupCards.length;
              const accumulatedCardXp = groupCards.reduce((sum, d) => sum + (d.xp || 10), 0);
              return {
                ...score,
                totalDiscoveries: groupCardCount,
                xp: Math.max(score.xp, accumulatedCardXp),
                updatedAt: new Date().toISOString(),
              };
            });

            const nextState: FullSessionState = {
              ...prev,
              discoveries: uniqueDiscoveries,
              scores: updatedScores,
            };
            saveGameState(nextState);
            return nextState;
          });
        }
      } catch (err) {
        console.warn('Initial Supabase cards fetch notice:', err);
      }
    };

    loadInitialSupabaseCards();

    // 2. Realtime Event Listener: INSERT, UPDATE, DELETE directly from Supabase
    const channel = supabase
      .channel('public:kartu_temuan_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kartu_temuan' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow || !newRow.id) return;
          const cardId = Number(newRow.id);

          setGameState((prev) => {
            // Avoid adding if ID already exists
            if (prev.discoveries.some((d) => d.id === cardId)) {
              return prev;
            }

            const shape = (newRow.real_shape || 'lingkaran') as ShapeType;
            const isProven = Boolean(newRow.is_proven);
            const cardXp = typeof newRow.xp === 'number' && newRow.xp > 0 ? newRow.xp : (Number(newRow.xp) || 10);
            const studentName = newRow.penemu || newRow.student_name || newRow.nama_siswa || newRow.nama || 'Tanpa Nama';
            const newDiscovery: Discovery = {
              id: cardId,
              sessionId: prev.session.id || 1,
              groupId: Number(newRow.kelompok_id) || 1,
              studentName: studentName,
              objectName: newRow.nama_benda || 'Benda Temuan',
              photoUrl: newRow.image_url || '',
              realShape: shape,
              expectedShape: shape,
              studentClaimedShape: shape,
              classifiedShape: null,
              island: null,
              targetShape: null,
              isLocked: false,
              annotationsJson: '[]',
              traitsVerified: isProven,
              isProven: isProven,
              xp: cardXp,
              createdAt: new Date().toISOString(),
            };

            playPhotoIncomingSound();

            const nextDiscoveries = [newDiscovery, ...prev.discoveries];
            const updatedScores = prev.scores.map((score) => {
              const groupCards = nextDiscoveries.filter((d) => d.groupId === score.groupId);
              const count = groupCards.length;
              const accumulatedCardXp = groupCards.reduce((sum, d) => sum + (d.xp || 10), 0);
              return {
                ...score,
                totalDiscoveries: count,
                xp: Math.max(score.xp, accumulatedCardXp),
                updatedAt: new Date().toISOString(),
              };
            });

            const nextState: FullSessionState = {
              ...prev,
              discoveries: nextDiscoveries,
              scores: updatedScores,
            };
            saveGameState(nextState);
            return nextState;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kartu_temuan' },
        (payload) => {
          const updatedRow = payload.new as any;
          if (!updatedRow || !updatedRow.id) return;
          const cardId = Number(updatedRow.id);

          setGameState((prev) => {
            const updatedDiscoveries = prev.discoveries.map((d) => {
              if (d.id === cardId) {
                const shape = (updatedRow.real_shape || d.realShape || 'lingkaran') as ShapeType;
                const isProven = Boolean(updatedRow.is_proven ?? d.isProven);
                const updatedStudentName =
                  updatedRow.penemu ||
                  updatedRow.student_name ||
                  updatedRow.nama_siswa ||
                  updatedRow.nama ||
                  d.studentName ||
                  'Tanpa Nama';
                const resolvedIsland =
                  updatedRow.pulau ||
                  updatedRow.island ||
                  d.island ||
                  d.classifiedShape ||
                  (isProven ? shape : null);
                return {
                  ...d,
                  studentName: updatedStudentName,
                  objectName: updatedRow.nama_benda || d.objectName,
                  photoUrl: updatedRow.image_url || d.photoUrl,
                  realShape: shape,
                  expectedShape: shape,
                  groupId: Number(updatedRow.kelompok_id) || d.groupId,
                  isProven: isProven,
                  traitsVerified: isProven,
                  classifiedShape: resolvedIsland,
                  island: resolvedIsland,
                  targetShape: resolvedIsland,
                  isLocked: Boolean(resolvedIsland || d.isLocked),
                };
              }
              return d;
            });

            const nextState: FullSessionState = {
              ...prev,
              discoveries: updatedDiscoveries,
            };
            saveGameState(nextState);
            return nextState;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'kartu_temuan' },
        (payload) => {
          const oldRow = payload.old as any;
          if (!oldRow || !oldRow.id) return;
          const cardId = Number(oldRow.id);

          setGameState((prev) => {
            const nextDiscoveries = prev.discoveries.filter((d) => d.id !== cardId);
            const updatedScores = prev.scores.map((score) => {
              const count = nextDiscoveries.filter((d) => d.groupId === score.groupId).length;
              return {
                ...score,
                totalDiscoveries: count,
                updatedAt: new Date().toISOString(),
              };
            });

            const nextState: FullSessionState = {
              ...prev,
              discoveries: nextDiscoveries,
              scores: updatedScores,
            };
            saveGameState(nextState);
            return nextState;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!gameState || gameState.session.status !== 'playing') return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.session.status]);

  const handleJoinSessionByCode = async (code: string) => {
    try {
      const res = await fetch(`/api/sessions/code/${code.trim()}`);
      if (!res.ok) throw new Error('Kode sesi tidak ditemukan.');
      const data = await res.json();
      applyNewState(data);
    } catch {
      // ignore error
    }
    setScreen('arena');
  };

  const handleSelectLevel = async (levelNumber: number) => {
    if (!gameState) return;
    const updated = updateMissionLevel(gameState, levelNumber);
    applyNewState(updated);
    fetch(`/api/sessions/${gameState.session.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentLevel: levelNumber }),
    }).catch(() => {});
    setScreen('arena');
  };

  return (
    <div className="min-h-screen flex flex-col relative text-slate-900 select-none">
      {/* Illustrated 3D Chibi Elementary School Adventure World Backdrop */}
      <SchoolWorldBackdrop />

      {/* HEADER ATAS: BERSIH, MINIMALIS, & PROFESIONAL */}
      <header className="relative z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 bg-white/95 backdrop-blur-md border-b-4 border-amber-400 shadow-xs sticky top-0">
        {/* Left: Tombol Home & Judul Game (Tanpa Emoji) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setScreen('start');
            }}
            title="Kembali ke Beranda Utama"
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-slate-950 border-2 border-amber-600 shadow-[0_3px_0_#B45309] active:translate-y-0.5 active:shadow-[0_1px_0_#B45309] font-display font-black text-xs sm:text-sm tracking-wide cursor-pointer transition-all"
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setScreen('start');
            }}
            className="flex items-baseline flex-wrap gap-1 sm:gap-2 text-left cursor-pointer hover:opacity-90 transition-opacity"
          >
            <span className="font-display font-black text-base sm:text-2xl tracking-tight bg-gradient-to-r from-amber-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
              SHAPE HUNTER
            </span>
            <span className="font-display font-bold text-[11px] sm:text-xs text-amber-700 tracking-normal whitespace-nowrap">
              by Bu Guru Yennia
            </span>
          </button>
        </div>

        {/* Right: HANYA Tombol Ruang Guru (Tanpa Emoji) */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setScreen(screen === 'teacher' ? 'start' : 'teacher');
            }}
            className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl font-display font-bold text-xs sm:text-sm cursor-pointer transition-all ${
              screen === 'teacher'
                ? 'bg-slate-900 text-amber-300 shadow-xs border-2 border-slate-900'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300 shadow-xs'
            }`}
          >
            Ruang Guru
          </button>
        </div>
      </header>

      {/* MAIN GAME WORLD STAGE */}
      <main className="relative z-10 flex-1 flex flex-col">
        {gameState && (
          <>
            {/* 1. START SCREEN (HOME DENGAN GAMBAR ILUSTRASI 3D ASLI) */}
            {screen === 'start' && (
              <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center animate-fade-in">
                <div className="w-full rounded-[36px] bg-white/95 border-4 border-amber-400 shadow-[0_12px_0_#F59E0B] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center">
                  {/* Sisi Kiri: Gambar Ilustrasi 3D Sampul Aslinya */}
                  <div className="lg:col-span-6 relative h-64 sm:h-80 lg:h-full min-h-[300px] bg-sky-100 overflow-hidden">
                    <GameAssetImage
                      src={GAME_ASSETS.heroBanner}
                      alt="Shape Hunter Petualangan Bangun Datar"
                      className="w-full h-full object-cover object-center"
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-5 text-white">
                      <GeometricMascotParade size={46} />
                    </div>
                  </div>

                  {/* Sisi Kanan: Judul & Tombol Mulai Petualangan */}
                  <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col gap-5 text-center lg:text-left">
                    <div>
                      <span className="inline-block font-display font-bold text-xs sm:text-sm text-sky-700 tracking-wider uppercase mb-1">
                        Petualangan Matematika Kelas 2 SD
                      </span>
                      <h1 className="font-display text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
                        SHAPE HUNTER
                      </h1>
                      <div className="mt-1 mb-2 flex justify-center lg:justify-start">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-300 text-amber-900 font-display font-bold text-xs sm:text-sm shadow-xs">
                          ✨ Karya Bu Guru Yennia
                        </span>
                      </div>
                      <p className="font-display text-xl sm:text-2xl font-bold text-amber-600 mt-1">
                        “Temukan Bentuk di Sekitarmu!”
                      </p>
                    </div>

                    {/* Luna & Raka Welcome Guides */}
                    <div className="flex flex-col gap-2.5">
                      <CharacterGuide
                        character="luna"
                        message="Yuk, cari benda berbentuk Lingkaran, Segitiga, Persegi, dan Persegi Panjang di sekolah!"
                        compact
                      />
                      <CharacterGuide
                        character="raka"
                        message="Potret temuanmu lalu mainkan bersama tim di Papan Interaksi Digital!"
                        compact
                      />
                    </div>

                    {/* Tombol Mulai & Kamera */}
                    <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playShapeLockSound();
                          setScreen('arena');
                        }}
                        className="btn-3d w-full sm:flex-1 py-4 px-6 rounded-[24px] bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-2 border-emerald-400 shadow-[0_7px_0_#047857] font-display text-lg sm:text-xl font-black tracking-wide cursor-pointer"
                      >
                        MULAI PETUALANGAN
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setScreen('uploader');
                        }}
                        className="btn-3d w-full sm:w-auto py-4 px-6 rounded-[24px] bg-gradient-to-b from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white border-2 border-sky-400 shadow-[0_7px_0_#0369A1] font-display text-base sm:text-lg font-bold tracking-wide cursor-pointer"
                      >
                        KAMERA SISWA
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ARENA PID (PAPAN INTERAKSI DIGITAL KEMAH BERTANDING) */}
            {screen === 'arena' && (
              <PidBoardView
                state={gameState}
                remainingSeconds={remainingSeconds}
                onStateChange={applyNewState}
                onNavigateUploader={() => setScreen('uploader')}
                onOpenMissionModal={() => setScreen('misi')}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              />
            )}

            {/* 3. VISUAL MISSION SCREEN (PETA MISI PETUALANGAN) */}
            {screen === 'misi' && (
              <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6 animate-fade-in">
                <div className="rounded-[32px] bg-white/95 border-4 border-amber-400 shadow-[0_10px_0_#F59E0B] p-6">
                  {/* Top Bar with 'Kembali ke Beranda' and 'Papan Skor & Lencana' Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-slate-100">
                    <div>
                      <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900">
                        Peta Misi Petualangan
                      </h1>
                      <p className="text-sm sm:text-base font-semibold text-slate-600 mt-0.5">
                        Pilih misi yang ingin kamu jelajahi bersama kemahmu!
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setScreen('start');
                        }}
                        className="btn-3d px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-display font-bold text-sm border border-slate-300 cursor-pointer shadow-xs"
                      >
                        Kembali ke Beranda
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setIsLeaderboardOpen(true);
                        }}
                        className="btn-3d px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm shadow-[0_3px_0_#B45309] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trophy className="w-4 h-4 text-slate-950" />
                        <span>Papan Skor & Lencana</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Mission Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.values(MISSION_LEVELS).map((m) => {
                      const isActive = gameState.session.currentLevel === m.level;
                      return (
                        <div
                          key={m.level}
                          onClick={() => handleSelectLevel(m.level)}
                          className={`rounded-3xl border-4 p-5 flex flex-col justify-between transition-all cursor-pointer ${
                            isActive
                              ? 'border-amber-400 bg-amber-50/90 shadow-[0_8px_0_#B45309] scale-102'
                              : 'border-slate-200 bg-white hover:border-sky-300 shadow-md hover:-translate-y-1'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span
                                className={`px-3 py-1 rounded-full font-display font-black text-xs uppercase tracking-wider ${
                                  isActive
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                Level {m.level}
                              </span>
                              {isActive && (
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Aktif
                                </span>
                              )}
                            </div>

                            <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
                              {m.title}
                            </h3>
                            <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-4">
                              {m.shortLabel}
                            </p>

                            <div className="space-y-1.5 mb-4">
                              {m.storySteps.map((step, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 text-xs font-semibold text-slate-700"
                                >
                                  <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="w-full py-3 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-display font-bold text-base shadow-[0_4px_0_#B45309] cursor-pointer"
                          >
                            Mainkan {m.badgeText}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Teacher Mission Banner */}
                  <div className="mt-6 rounded-3xl bg-sky-50 border-3 border-sky-300 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <CharacterGuide
                      character="luna"
                      message={`Pesan Misi Guru: "${gameState.session.missionTitle}"`}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. KOLEKSI TEMUAN BANGUN DATAR */}
            {screen === 'koleksi' && (
              <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 animate-fade-in">
                <div className="rounded-[32px] bg-white/95 border-4 border-sky-400 shadow-[0_10px_0_#38BDF8] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b-2 border-slate-100">
                    <div>
                      <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900">
                        Galeri Temuan Supabase (`public.kartu_temuan`)
                      </h1>
                      <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">
                        {gameState.discoveries.length} foto temuan siswa tersinkronasi langsung dari database Supabase secara real-time.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setScreen('uploader');
                        }}
                        className="btn-3d px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-display font-bold text-sm shadow-[0_3px_0_#047857] cursor-pointer"
                      >
                        📸 Potret Benda Baru
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setScreen('arena');
                        }}
                        className="btn-3d px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm shadow-[0_3px_0_#B45309] cursor-pointer"
                      >
                        Ke Arena Kemah
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs Filter Bentuk */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setKoleksiShapeFilter('all');
                      }}
                      className={`btn-3d px-4 py-2 rounded-2xl font-display text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        koleksiShapeFilter === 'all'
                          ? 'bg-sky-500 text-white shadow-[0_3px_0_#0284C7]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Semua Benda ({gameState.discoveries.length})
                    </button>
                    {SHAPE_LIST.map((shapeDef) => {
                      const count = gameState.discoveries.filter(
                        (d) =>
                          d.classifiedShape === shapeDef.id ||
                          d.expectedShape === shapeDef.id ||
                          d.realShape === shapeDef.id
                      ).length;
                      const isSelected = koleksiShapeFilter === shapeDef.id;
                      return (
                        <button
                          key={`filter-${shapeDef.id}`}
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setKoleksiShapeFilter(shapeDef.id);
                          }}
                          className={`btn-3d px-3.5 py-2 rounded-2xl font-display text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 shadow-[0_3px_0_#B45309]'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <ShapeMascot3D shape={shapeDef.id} size={22} />
                          <span>{shapeDef.name} ({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Uniform & Consistent Card Grid */}
                  {(() => {
                    const filteredDiscoveries = gameState.discoveries.filter((d) => {
                      if (koleksiShapeFilter === 'all') return true;
                      return (
                        d.classifiedShape === koleksiShapeFilter ||
                        d.expectedShape === koleksiShapeFilter ||
                        d.realShape === koleksiShapeFilter
                      );
                    });

                    if (filteredDiscoveries.length === 0) {
                      return (
                        <div className="rounded-3xl border-3 border-dashed border-sky-300 bg-sky-50/60 p-10 text-center">
                          <p className="font-display text-base sm:text-lg font-bold text-slate-800">
                            Belum ada foto temuan untuk kategori ini.
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                            Buka kamera dari HP siswa untuk memotret benda sekolah!
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredDiscoveries.map((disc, idx) => {
                          const grp = gameState.groups.find((g) => g.id === disc.groupId);
                          const shapeKey = (disc.realShape || disc.expectedShape || 'lingkaran') as ShapeType;
                          const shapeDef = SHAPE_DEFINITIONS[shapeKey] || SHAPE_DEFINITIONS.lingkaran;
                          const isProven = disc.traitsVerified || disc.isProven;

                          return (
                            <div
                              key={`galeri-card-${disc.id || idx}-${idx}`}
                              className="rounded-3xl border-3 border-slate-200 bg-white p-3 shadow-[0_5px_0_#CBD5E1] hover:border-sky-400 hover:shadow-[0_8px_0_#38BDF8] hover:-translate-y-1 transition-all flex flex-col justify-between h-[230px] select-none"
                            >
                              {/* Fixed Aspect Ratio Photo Container */}
                              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                                <img
                                  src={disc.photoUrl}
                                  alt={disc.objectName}
                                  className="w-full h-full object-cover rounded-2xl pointer-events-none"
                                />

                                {/* Shape Tag Overlay */}
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-xl bg-slate-900/85 text-white font-display font-bold text-[10px] shadow-xs">
                                  {shapeDef.symbol} {shapeDef.name}
                                </span>

                                {/* XP Badge Overlay */}
                                <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border border-amber-300 font-display font-black text-[9px] shadow-xs flex items-center gap-0.5">
                                  ⭐ +{disc.xp || 10} XP
                                </span>

                                {/* Group Badge Overlay */}
                                {grp && (
                                  <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-xl bg-sky-100/90 text-sky-950 border border-sky-300 font-display font-bold text-[9px] shadow-2xs truncate max-w-[85px]">
                                    {formatCampDisplayName(grp.name)}
                                  </span>
                                )}

                                {/* Proof Badge Overlay */}
                                {isProven && (
                                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-xl bg-emerald-500 text-white font-display font-bold text-[9px] shadow-xs">
                                    Terbukti
                                  </span>
                                )}
                              </div>

                              {/* Card Title & Info */}
                              <div className="pt-2 flex flex-col justify-between flex-1 min-h-0">
                                <div>
                                  <h4 className="font-display font-bold text-sm text-slate-900 truncate">
                                    {disc.objectName}
                                  </h4>
                                  <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                                    {disc.studentName}
                                  </p>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                                  <span>Supabase Sync</span>
                                  <span className="text-emerald-600 font-extrabold">● Active</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 5. BADGES & SHAPE FRIENDS ("LENCANA") */}
            {screen === 'lencana' && (
              <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 animate-fade-in">
                {/* Treasure Chest & Team Badges */}
                <div className="rounded-[32px] bg-white/95 border-4 border-amber-400 shadow-[0_10px_0_#F59E0B] p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-3 border-amber-400 shadow-md shrink-0">
                        <GameAssetImage
                          src={GAME_ASSETS.treasureChest}
                          alt="Peti Harta Karun"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="font-display text-2xl font-black text-slate-900">
                          Peti Harta Karun & Lencana Petualang
                        </h2>
                        <p className="text-xs sm:text-sm font-semibold text-slate-600">
                          Buka lencana keren bersama kemahmu saat berhasil mengumpulkan benda!
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setIsLeaderboardOpen(true);
                      }}
                      className="btn-3d px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm shadow-[0_3px_0_#B45309] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-slate-950" />
                      <span>Lihat Peringkat</span>
                    </button>
                  </div>

                  {/* 4 Sahabat Bangun Datar 3D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    {SHAPE_LIST.map((shape) => (
                      <div
                        key={shape.id}
                        className="rounded-3xl border-3 border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-center flex flex-col items-center gap-2 shadow-sm"
                      >
                        <ShapeMascot3D shape={shape.id} size={72} />
                        <h3 className="font-display font-bold text-base text-slate-900 mt-1">
                          {shape.name}
                        </h3>
                        <span className="text-xs font-display font-semibold text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-full">
                          {shape.mascotName}
                        </span>
                        <p className="text-xs text-slate-600 font-medium">
                          {shape.sidesCount} Sisi · {shape.cornersCount} Sudut
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. FOTO TEMUANMU (KAMERA SISWA DENGAN SUPABASE STORAGE & GEMINI AI) */}
            {screen === 'uploader' && (
              <StudentUploaderView
                state={gameState}
                onDiscoveryUploaded={applyNewState}
                onJoinSessionByCode={handleJoinSessionByCode}
                onSwitchToPid={() => setScreen('arena')}
                onSwitchToHome={() => setScreen('start')}
              />
            )}

            {/* 7. RUANG GURU (TEACHER DASHBOARD) */}
            {screen === 'teacher' && (
              <TeacherDashboardView
                state={gameState}
                remainingSeconds={remainingSeconds}
                onStateChange={applyNewState}
                onSwitchToPid={() => setScreen('arena')}
              />
            )}
          </>
        )}
      </main>

      {/* POP-UP LEADERBOARD & LENCANA KEMENANGAN */}
      {gameState && (
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          state={gameState}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShapeHunterApp />
    </AuthProvider>
  );
}
