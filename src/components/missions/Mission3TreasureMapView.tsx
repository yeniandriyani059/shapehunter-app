import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Group,
  Discovery,
  SHAPE_DEFINITIONS,
  SHAPE_LIST,
  ShapeType,
  GroupScore,
  GAME_ASSETS,
} from '../../types/game.ts';
import { GameAssetImage } from '../ShapeMascot3D.tsx';
import {
  playClickSound,
  playShapeLockSound,
  playTryAgainSound,
  playSplashSound,
  playMagicBoomSound,
} from '../../utils/sound.ts';
import {
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  RefreshCw,
  Trophy,
  BookOpen,
  Flame,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface Mission3TreasureMapViewProps {
  campSide: 'left' | 'right';
  sessionId: number;
  isPlaying: boolean;
  group: Group;
  score?: GroupScore;
  groupDiscoveries: Discovery[];
  missionTitle?: string;
  missionTargetShape?: string;
  missionTargetCount?: number;
  guideCharacter: 'raka' | 'luna';
  onAttemptSubmitted?: (newState: any) => void;
  onSetGuideMessage?: (msg: {
    mood: 'cheerful' | 'celebrating' | 'hint';
    text: string;
    pointsEarned?: number;
  }) => void;
}

// Recipe target: 2 per shape category (Lingkaran, Segitiga, Persegi, Persegi Panjang = 8 items)
const RECIPE_TARGET_PER_SHAPE = 2;
const TOTAL_REQUIRED_INGREDIENTS = 8;

interface ActiveCardDrag {
  discoveryId: number;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  cardCenterX: number;
  cardCenterY: number;
  hasMoved: boolean;
}

export const Mission3TreasureMapView: React.FC<Mission3TreasureMapViewProps> = ({
  campSide,
  group,
  groupDiscoveries,
  guideCharacter,
  onSetGuideMessage,
}) => {
  // Proven cards from Mission 1 & 2
  const provenDiscoveries = groupDiscoveries.filter(
    (d) => d.traitsVerified || d.isProven
  );

  // Helper to resolve discovery shape
  const getCardShape = useCallback((disc: Discovery): ShapeType => {
    const raw = (disc.realShape || disc.classifiedShape || disc.expectedShape) as ShapeType;
    if (raw && SHAPE_DEFINITIONS[raw]) return raw;
    return 'lingkaran';
  }, []);

  // Storage key per group to persist cauldron contents
  const storageKey = `shape_hunter_cauldron_${group.id}`;

  // Cauldron ingredients: array of discovery IDs currently inside the cauldron
  const [cauldronCardIds, setCauldronCardIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter only valid proven IDs belonging to this group
          return parsed.filter((id) =>
            provenDiscoveries.some((d) => d.id === id)
          );
        }
      }
    } catch {
      // ignore error
    }
    return [];
  });

  // Save cauldron state whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cauldronCardIds));
    } catch {
      // ignore
    }
  }, [cauldronCardIds, storageKey]);

  // Derived cauldron discoveries
  const cauldronDiscoveries = cauldronCardIds
    .map((id) => provenDiscoveries.find((d) => d.id === id))
    .filter((d): d is Discovery => d !== undefined);

  // Available cards in "Kantong Bahan" (proven, not yet in cauldron)
  const pouchCards = provenDiscoveries.filter(
    (d) => !cauldronCardIds.includes(d.id)
  );

  // Recipe progress calculation per shape
  const recipeProgress: Record<ShapeType, number> = {
    lingkaran: 0,
    segitiga: 0,
    persegi: 0,
    persegi_panjang: 0,
  };

  cauldronDiscoveries.forEach((d) => {
    const s = getCardShape(d);
    if (recipeProgress[s] !== undefined) {
      recipeProgress[s] += 1;
    }
  });

  const totalBrewed = cauldronDiscoveries.length;
  const isRecipeComplete =
    recipeProgress.lingkaran >= RECIPE_TARGET_PER_SHAPE &&
    recipeProgress.segitiga >= RECIPE_TARGET_PER_SHAPE &&
    recipeProgress.persegi >= RECIPE_TARGET_PER_SHAPE &&
    recipeProgress.persegi_panjang >= RECIPE_TARGET_PER_SHAPE;

  // Cauldron interactive feedback states
  const [isCauldronHovered, setIsCauldronHovered] = useState(false);
  const [isSplashing, setIsSplashing] = useState(false);
  const [isVomiting, setIsVomiting] = useState(false);
  const [cauldronFeedbackMessage, setCauldronFeedbackMessage] = useState<string | null>(null);
  const [justBrewedShape, setJustBrewedShape] = useState<ShapeType | null>(null);

  // Climax & Celebration states
  const [isMagicBursting, setIsMagicBursting] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [isShowingCampCelebration, setIsShowingCampCelebration] = useState(false);
  const [selectedInspectDisc, setSelectedInspectDisc] = useState<Discovery | null>(null);

  // Multi-Touch Pointer Events Drag State
  const [activeDrags, setActiveDrags] = useState<Record<number, ActiveCardDrag>>({});
  const [returningCardId, setReturningCardId] = useState<number | null>(null);

  const cauldronDropRef = useRef<HTMLDivElement | null>(null);

  // Trigger magic burst when all 8 ingredients are fulfilled
  useEffect(() => {
    if (isRecipeComplete && !hasCelebrated) {
      setHasCelebrated(true);
      setIsMagicBursting(true);
      playMagicBoomSound();

      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { x: campSide === 'left' ? 0.3 : 0.7, y: 0.5 },
        });
      } catch {
        // ignore
      }

      if (onSetGuideMessage) {
        onSetGuideMessage({
          mood: 'celebrating',
          text: `Ramuan Ajaib Berhasil! Sihir membuka Peti Harta Karun Kemah ${group.name}! (+50 XP)`,
          pointsEarned: 50,
        });
      }
    }
  }, [isRecipeComplete, hasCelebrated, campSide, group.name, onSetGuideMessage]);

  /**
   * Attempt to drop/add a card into the magic cauldron
   */
  const handleDropOrTapCardToCauldron = useCallback(
    (disc: Discovery) => {
      const shape = getCardShape(disc);
      const currentCount = recipeProgress[shape] || 0;
      const shapeDef = SHAPE_DEFINITIONS[shape];

      // Check if this shape is still required in the recipe (< 2)
      if (currentCount < RECIPE_TARGET_PER_SHAPE) {
        // ACCEPTED! Splash into the brew
        playSplashSound();
        setIsSplashing(true);
        setJustBrewedShape(shape);
        setTimeout(() => setIsSplashing(false), 700);

        setCauldronCardIds((prev) => [...prev, disc.id]);
        setCauldronFeedbackMessage(
          `"${disc.objectName}" masuk ke kuali! Resep ${shapeDef.name} bertambah (${currentCount + 1}/${RECIPE_TARGET_PER_SHAPE})`
        );

        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'cheerful',
            text: `Bagus! "${disc.objectName}" (${shapeDef.name}) menyatu ke dalam ramuan!`,
          });
        }
      } else {
        // REJECTED / VOMITED! Recipe for this shape is already 2/2
        playTryAgainSound();
        setIsVomiting(true);
        setReturningCardId(disc.id);
        setTimeout(() => {
          setIsVomiting(false);
          setReturningCardId(null);
        }, 650);

        setCauldronFeedbackMessage(
          `Resep ${shapeDef.name} sudah penuh (${RECIPE_TARGET_PER_SHAPE}/${RECIPE_TARGET_PER_SHAPE})! Kuali membutuhkan bentuk lain.`
        );

        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'hint',
            text: `Resep ${shapeDef.name} sudah lengkap! Masukkan bentuk lain yang belum tercentang di buku resep.`,
          });
        }
      }
    },
    [getCardShape, recipeProgress, onSetGuideMessage]
  );

  /**
   * Reset / Empty cauldron to allow students to retry or re-experiment
   */
  const handleResetCauldron = () => {
    playClickSound();
    setCauldronCardIds([]);
    setCauldronFeedbackMessage(null);
    setHasCelebrated(false);
    setIsMagicBursting(false);
    if (onSetGuideMessage) {
      onSetGuideMessage({
        mood: 'cheerful',
        text: 'Bahan-bahan telah dikeluarkan kembali ke kantong. Siap meracik ulang!',
      });
    }
  };

  /**
   * Hit-test pointer coordinates against Cauldron vessel
   */
  const checkCauldronHitTest = useCallback(
    (px: number, py: number, cx: number, cy: number): boolean => {
      const el = cauldronDropRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const tolerance = 24;

      const pointerInside =
        px >= rect.left - tolerance &&
        px <= rect.right + tolerance &&
        py >= rect.top - tolerance &&
        py <= rect.bottom + tolerance;

      const centerInside =
        cx >= rect.left - tolerance &&
        cx <= rect.right + tolerance &&
        cy >= rect.top - tolerance &&
        cy <= rect.bottom + tolerance;

      return pointerInside || centerInside;
    },
    []
  );

  // Multi-Touch Pointer Event Handlers for Dragging Cards to Cauldron
  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery
  ) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;

    setActiveDrags((prev) => ({
      ...prev,
      [disc.id]: {
        discoveryId: disc.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
        cardCenterX,
        cardCenterY,
        hasMoved: false,
      },
    }));
  };

  const handleCardPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery
  ) => {
    const drag = activeDrags[disc.id];
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const hasMoved = drag.hasMoved || Math.hypot(dx, dy) > 8;

    const isHoveringCauldron = checkCauldronHitTest(
      e.clientX,
      e.clientY,
      drag.cardCenterX + dx,
      drag.cardCenterY + dy
    );

    setIsCauldronHovered(isHoveringCauldron);

    setActiveDrags((prev) => {
      const existing = prev[disc.id];
      if (!existing || existing.pointerId !== e.pointerId) return prev;
      return {
        ...prev,
        [disc.id]: {
          ...existing,
          dx,
          dy,
          hasMoved,
        },
      };
    });
  };

  const handleCardPointerUpOrCancel = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery,
    isCancel = false
  ) => {
    const drag = activeDrags[disc.id];
    if (!drag || drag.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    setIsCauldronHovered(false);

    setActiveDrags((prev) => {
      const next = { ...prev };
      delete next[disc.id];
      return next;
    });

    if (isCancel) return;

    if (drag.hasMoved) {
      const droppedOnCauldron = checkCauldronHitTest(
        e.clientX,
        e.clientY,
        drag.cardCenterX + drag.dx,
        drag.cardCenterY + drag.dy
      );

      if (droppedOnCauldron) {
        handleDropOrTapCardToCauldron(disc);
      } else {
        setReturningCardId(disc.id);
        setTimeout(() => setReturningCardId(null), 400);
      }
    } else {
      // Quick tap -> immediately attempt adding to cauldron
      handleDropOrTapCardToCauldron(disc);
    }
  };

  const handleCardLostPointerCapture = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery
  ) => {
    setActiveDrags((prev) => {
      if (!prev[disc.id] || prev[disc.id].pointerId !== e.pointerId) return prev;
      const next = { ...prev };
      delete next[disc.id];
      return next;
    });
    setIsCauldronHovered(false);
  };

  const handleOpenCelebrationModal = () => {
    playClickSound();
    playShapeLockSound();
    setIsShowingCampCelebration(true);
    try {
      confetti({
        particleCount: 130,
        spread: 100,
        origin: { x: campSide === 'left' ? 0.3 : 0.7, y: 0.5 },
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative flex flex-col gap-4">
      {/* 1. TOP SECTION — 3 BALANCED COLUMNS (BUKU RESEP, KUALI AJAIB, PETI HARTA KARUN) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* ========================================================
            COLUMN 1: BUKU RESEP SANG GURU (TARGET CHECKLIST)
           ======================================================== */}
        <div className="md:col-span-4 rounded-[28px] bg-gradient-to-b from-amber-50/95 via-amber-50 to-orange-50/90 border-3 border-amber-300 shadow-[0_6px_0_#F59E0B] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b-2 border-amber-200">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-200 border border-amber-400 flex items-center justify-center text-amber-900 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-display text-sm sm:text-base font-black text-amber-950">
                    Buku Resep Sang Guru
                  </h3>
                  <span className="text-[11px] font-bold text-amber-800">
                    Target: Masing-masing 2 Benda
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-display font-black text-xs">
                {totalBrewed}/{TOTAL_REQUIRED_INGREDIENTS}
              </span>
            </div>

            {/* Shape Target Rows (Lingkaran, Segitiga, Persegi, Persegi Panjang) */}
            <div className="flex flex-col gap-2 mt-2">
              {SHAPE_LIST.map((shapeDef) => {
                const count = recipeProgress[shapeDef.id] || 0;
                const isFulfilled = count >= RECIPE_TARGET_PER_SHAPE;

                return (
                  <div
                    key={shapeDef.id}
                    className={`rounded-2xl p-2.5 border-2 flex items-center justify-between gap-2 transition-all ${
                      isFulfilled
                        ? 'border-emerald-400 bg-emerald-100/90 shadow-2xs'
                        : count === 1
                        ? 'border-amber-300 bg-white/95'
                        : 'border-slate-200 bg-white/70 opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl ${shapeDef.portalRing} font-display font-bold text-sm flex items-center justify-center shrink-0`}
                      >
                        {shapeDef.symbol}
                      </span>
                      <div className="min-w-0">
                        <span
                          className={`font-display text-xs sm:text-sm font-bold block truncate ${
                            isFulfilled
                              ? 'line-through text-emerald-800'
                              : 'text-slate-900'
                          }`}
                        >
                          2 {shapeDef.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {isFulfilled
                            ? 'Lengkap!'
                            : count === 1
                            ? 'Butuh 1 lagi'
                            : 'Butuh 2 lagi'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`font-display font-black text-xs px-2 py-0.5 rounded-lg ${
                          isFulfilled
                            ? 'bg-emerald-500 text-white'
                            : count === 1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}/{RECIPE_TARGET_PER_SHAPE}
                      </span>
                      {isFulfilled && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset / Empty Cauldron Button */}
          {totalBrewed > 0 && !isRecipeComplete && (
            <div className="pt-2 mt-2 border-t border-amber-200 text-right">
              <button
                type="button"
                onClick={handleResetCauldron}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 ml-auto cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Keluarkan Semua Bahan</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================
            COLUMN 2: KUALI AJAIB (MAGIC CAULDRON & BOILING BREW)
           ======================================================== */}
        <div
          ref={cauldronDropRef}
          data-group-id={group.id}
          className={`md:col-span-4 rounded-[28px] bg-gradient-to-b from-slate-900 via-purple-950/90 to-slate-950 border-3 transition-all duration-200 p-4 sm:p-5 flex flex-col items-center justify-between text-center relative overflow-hidden ${
            isCauldronHovered
              ? 'border-amber-400 ring-4 ring-amber-300 shadow-[0_12px_28px_rgba(245,158,11,0.4)] scale-102'
              : isMagicBursting
              ? 'border-amber-400 animate-magic-glow'
              : isVomiting
              ? 'border-rose-400 animate-cauldron-vomit shadow-[0_8px_0_#F43F5E]'
              : 'border-purple-400/80 shadow-[0_6px_0_#581C87]'
          }`}
        >
          {/* Header Banner */}
          <div className="w-full flex items-center justify-between gap-2 z-10">
            <span className="font-display font-bold text-xs sm:text-sm text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Kuali Ramuan Ajaib</span>
            </span>
            <span className="text-[11px] font-display font-bold px-2 py-0.5 rounded-lg bg-purple-900/80 text-amber-300 border border-purple-600">
              {totalBrewed}/8 Bahan
            </span>
          </div>

          {/* Central Cauldron Vessel with Liquid, Bubbles, and Flame */}
          <div className="relative my-2 w-full max-w-[220px] flex flex-col items-center select-none">
            {/* Cauldron Pot Body */}
            <div className="relative w-44 sm:w-48 h-32 sm:h-36 rounded-b-[60px] rounded-t-[22px] bg-gradient-to-b from-slate-800 via-slate-900 to-black border-4 border-slate-700 shadow-2xl overflow-hidden flex flex-col items-center justify-start p-2">
              {/* Cauldron Metal Rim */}
              <div className="w-full h-4 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 border-b border-slate-900 shadow-inner" />

              {/* Glowing Boiling Potion Liquid */}
              <div className="relative w-36 sm:w-40 h-24 sm:h-28 mt-1 rounded-b-[50px] bg-gradient-to-b from-emerald-400 via-teal-600 to-indigo-900 overflow-hidden shadow-inner flex items-center justify-center">
                {/* Floating Bubbles */}
                <div className="absolute w-3 h-3 rounded-full bg-white/70 animate-cauldron-bubble left-6" />
                <div
                  className="absolute w-4 h-4 rounded-full bg-white/80 animate-cauldron-bubble left-14"
                  style={{ animationDelay: '0.4s' }}
                />
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white/75 animate-cauldron-bubble right-8"
                  style={{ animationDelay: '0.9s' }}
                />

                {/* Splash Ripple Burst */}
                {isSplashing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-16 h-16 rounded-full border-4 border-amber-300 bg-amber-200/50 animate-splash-ripple" />
                  </div>
                )}

                {/* Brewing Mini Tokens Inside Liquid */}
                {cauldronDiscoveries.length > 0 ? (
                  <div className="z-10 flex flex-wrap items-center justify-center gap-1 max-w-[130px] p-1">
                    {cauldronDiscoveries.map((disc, idx) => {
                      const s = getCardShape(disc);
                      const sDef = SHAPE_DEFINITIONS[s];
                      return (
                        <span
                          key={`m3-brew-${disc.id || idx}-${idx}`}
                          className="w-5 h-5 rounded-md bg-white/90 text-slate-900 font-display font-bold text-[10px] flex items-center justify-center shadow-xs animate-pop-in"
                          title={`${disc.objectName} (${sDef.name})`}
                        >
                          {sDef.symbol}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[11px] font-display font-bold text-emerald-100/90 text-center px-2">
                    {isCauldronHovered
                      ? 'Lepaskan Bahan!'
                      : 'Kuali Siap Meracik!'}
                  </span>
                )}
              </div>
            </div>

            {/* Fire Flames Underneath Cauldron */}
            <div className="flex items-center justify-center gap-1.5 -mt-2 animate-flame-flicker">
              <span className="w-5 h-6 rounded-t-full bg-gradient-to-t from-red-600 via-orange-500 to-amber-300" />
              <span className="w-7 h-8 rounded-t-full bg-gradient-to-t from-red-600 via-orange-400 to-amber-200" />
              <span className="w-5 h-6 rounded-t-full bg-gradient-to-t from-red-600 via-orange-500 to-amber-300" />
            </div>
          </div>

          {/* Subtext Instructions / Cauldron Reaction Banner */}
          <div className="w-full z-10">
            {cauldronFeedbackMessage ? (
              <div
                className={`py-1.5 px-2.5 rounded-xl font-display text-xs font-bold ${
                  isVomiting
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-500/80 animate-gentle-shake'
                    : 'bg-purple-900/80 text-amber-300 border border-purple-500/80 animate-pop-in'
                }`}
              >
                {cauldronFeedbackMessage}
              </div>
            ) : (
              <p className="text-[11px] font-semibold text-slate-300">
                Seret atau ketuk kartu dari kantong untuk dimasukkan ke kuali!
              </p>
            )}
          </div>
        </div>

        {/* ========================================================
            COLUMN 3: PETI HARTA KARUN (LOCKED OR UNLOCKED)
           ======================================================== */}
        <div
          className={`md:col-span-4 rounded-[28px] border-3 p-4 sm:p-5 flex flex-col items-center justify-between text-center transition-all ${
            isRecipeComplete
              ? 'bg-gradient-to-b from-amber-50 via-amber-100/80 to-yellow-50 border-amber-400 shadow-[0_8px_0_#F59E0B]'
              : 'bg-gradient-to-b from-slate-100 via-slate-50 to-white border-slate-300 shadow-[0_6px_0_#94A3B8]'
          }`}
        >
          {/* Header Status */}
          <div className="w-full flex items-center justify-between mb-1">
            <span className="font-display font-bold text-xs sm:text-sm text-slate-800">
              Peti Harta Karun
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-display text-xs font-black ${
                isRecipeComplete
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isRecipeComplete ? 'TERBUKA!' : 'TERKUNCI'}
            </span>
          </div>

          {/* Chest Visual */}
          <div
            onClick={isRecipeComplete ? handleOpenCelebrationModal : undefined}
            className={`my-2 relative select-none transition-transform duration-200 ${
              isRecipeComplete
                ? 'cursor-pointer hover:scale-105 active:scale-95'
                : 'opacity-85'
            }`}
            title={
              isRecipeComplete
                ? 'Peti Terbuka! Ketuk untuk merayakan kemenangan!'
                : 'Gembok masih terkunci mantra!'
            }
          >
            {isRecipeComplete ? (
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-3xl overflow-hidden border-4 border-amber-400 shadow-[0_12px_24px_rgba(245,158,11,0.5)]">
                  <GameAssetImage
                    src={GAME_ASSETS.treasureChest}
                    alt="Peti Harta Karun Terbuka"
                    className="w-full h-full object-cover animate-bounce-gentle"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-display font-black shadow-xs flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    <span>BUKA</span>
                  </div>
                </div>

                <div className="mt-2.5 px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-display font-black text-xs sm:text-sm border border-amber-300 shadow-sm animate-pop-in">
                  GEMBOK SIHIR TERPECAH!
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-slate-300 shadow-md">
                  <GameAssetImage
                    src={GAME_ASSETS.treasureChest}
                    alt="Peti Harta Karun Terkunci"
                    className="w-full h-full object-cover grayscale-40"
                  />
                  <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400 border-2 border-amber-600 flex items-center justify-center text-slate-950 shadow-lg">
                      <Lock className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="mt-2 px-3 py-1 rounded-xl bg-slate-200 text-slate-700 font-display font-bold text-xs">
                  Terkunci Gembok Sihir
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Lengkapi 8 resep bentuk di kuali untuk memecahkan gembok!
                </p>
              </div>
            )}
          </div>

          {/* Action Button: "RAYAKAN KEMENANGAN EKSPEDISI!" */}
          <div className="w-full">
            {isRecipeComplete ? (
              <button
                type="button"
                onClick={handleOpenCelebrationModal}
                className="btn-3d w-full py-3 px-4 rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-display text-sm sm:text-base font-black tracking-wide flex items-center justify-center gap-2 shadow-[0_5px_0_#B45309] cursor-pointer border-2 border-amber-200 animate-pop-in"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>RAYAKAN KEMENANGAN EKSPEDISI!</span>
              </button>
            ) : (
              <div className="py-2 px-3 rounded-xl bg-slate-200/80 text-slate-600 font-display font-bold text-xs">
                {TOTAL_REQUIRED_INGREDIENTS - totalBrewed} Bahan Bentuk Tersisa
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. BOTTOM SECTION — "KANTONG BAHAN" (PROVEN INGREDIENT CARDS) */}
      <div className="rounded-[28px] bg-white border-3 border-amber-400 shadow-[0_6px_0_#F59E0B] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b-2 border-slate-100">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
              <span>Kantong Bahan Temuan Tim</span>
              <span className="text-xs font-semibold text-slate-500">
                ({pouchCards.length} Kartu Tersedia)
              </span>
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl">
              Hanya Kartu Lolos Misi 2 (Terbukti)
            </span>
          </div>
        </div>

        {/* Empty State vs Card Grid */}
        {pouchCards.length === 0 ? (
          <div className="rounded-3xl border-3 border-dashed border-emerald-300 bg-emerald-50/80 p-6 text-center animate-pop-in">
            {isRecipeComplete ? (
              <>
                <p className="font-display text-base sm:text-lg font-bold text-emerald-950">
                  Luar Biasa! Semua 8 Bahan Resep Telah Lengkap di Kuali!
                </p>
                <p className="text-xs sm:text-sm font-medium text-emerald-800 mt-1">
                  Ketuk tombol <strong>"Rayakan Kemenangan Ekspedisi!"</strong> di Peti Harta Karun untuk merayakan kemenangan tim!
                </p>
              </>
            ) : provenDiscoveries.length === 0 ? (
              <>
                <p className="font-display text-base sm:text-lg font-bold text-slate-800">
                  Belum Ada Kartu yang Siap Digunakan
                </p>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1 max-w-md mx-auto">
                  Siswa perlu memotret benda sekolah lalu membuktikan sisi & titik sudutnya di <strong>Misi 2: Buktikan!</strong> terlebih dahulu.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-base sm:text-lg font-bold text-amber-950">
                  Seluruh Kartu Terbukti Telah Masuk ke Kuali
                </p>
                <p className="text-xs sm:text-sm font-medium text-amber-800 mt-1 max-w-md mx-auto">
                  Jika masih membutuhkan bentuk tertentu (misal: Segitiga), silakan potret benda baru di sekolah lalu buktikan di Misi 2!
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pouchCards.map((disc, idx) => {
              const shape = getCardShape(disc);
              const shapeDef = SHAPE_DEFINITIONS[shape];
              const drag = activeDrags[disc.id];
              const isBeingDragged = !!drag && drag.hasMoved;
              const isReturning = returningCardId === disc.id;

              const dragTransformStyle: React.CSSProperties = {
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                ...(isBeingDragged
                  ? {
                      transform: `translate3d(${drag.dx}px, ${drag.dy}px, 0) scale(1.08) rotate(2deg)`,
                      zIndex: 60,
                      transition: 'none',
                    }
                  : undefined),
              };

              return (
                <div
                  key={`m3-pouch-${disc.id}`}
                  onPointerDown={(e) => handleCardPointerDown(e, disc)}
                  onPointerMove={(e) => handleCardPointerMove(e, disc)}
                  onPointerUp={(e) => handleCardPointerUpOrCancel(e, disc, false)}
                  onPointerCancel={(e) => handleCardPointerUpOrCancel(e, disc, true)}
                  onLostPointerCapture={(e) => handleCardLostPointerCapture(e, disc)}
                  style={dragTransformStyle}
                  className={`pid-draggable-card touch-none select-none cursor-grab active:cursor-grabbing rounded-2xl border-3 p-2.5 transition-shadow relative flex flex-col justify-between ${
                    isReturning ? 'card-spring-return' : ''
                  } ${
                    isBeingDragged
                      ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-300 shadow-2xl'
                      : 'border-slate-200 bg-white hover:border-amber-400 hover:shadow-md'
                  }`}
                  title={`Ketuk atau seret "${disc.objectName}" ke kuali ajaib!`}
                >
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-2 border border-slate-100 pointer-events-none select-none">
                    <GameAssetImage
                      src={disc.photoUrl}
                      alt={disc.objectName}
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />

                    {/* Shape Tag */}
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-950/80 text-white font-display font-bold text-[9px]">
                      {shapeDef.symbol} {shapeDef.name}
                    </span>

                    {/* Proven Status */}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-display font-bold text-[9px] shadow-xs flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Lolos
                    </span>
                  </div>

                  <div className="pointer-events-none select-none text-center">
                    <p className="font-display text-xs font-bold text-slate-900 truncate">
                      {disc.objectName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {disc.studentName}
                    </p>
                  </div>

                  {/* Touch Helper Button */}
                  <div className="mt-2 pt-1 border-t border-slate-100">
                    <span className="w-full py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-display font-bold text-[11px] block text-center shadow-2xs">
                      Sentuh Masuk
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. FULL-SCREEN CAMP CELEBRATION MODAL */}
      {isShowingCampCelebration && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-pop-in"
          onClick={() => setIsShowingCampCelebration(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-[32px] bg-gradient-to-b from-amber-50 via-white to-amber-100 border-4 border-amber-400 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsShowingCampCelebration(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer shadow-xs"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Glowing Chest Visual */}
            <div className="relative mb-3 w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden border-4 border-amber-200 shadow-2xl">
              <GameAssetImage
                src={GAME_ASSETS.treasureChest}
                alt="Peti Harta Karun Juara"
                className="w-full h-full object-cover animate-bounce-gentle"
              />
            </div>

            <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-950 tracking-tight">
              SELAMAT KEMAH {group.name.toUpperCase()}!
            </h2>
            <p className="text-sm sm:text-base font-bold text-amber-950 mt-1 max-w-md">
              Kalian berhasil meracik 8 ramuan bangun datar seimbang di kuali ajaib dan membuka peti harta karun ekspedisi!
            </p>

            <div className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-slate-950 text-amber-300 font-display font-black text-lg shadow-lg">
              <span>+50 XP BINTANG EKSPEDISI</span>
            </div>

            {/* Gallery of 8 Brewed Treasures */}
            <div className="w-full mt-5">
              <div className="text-xs font-bold text-amber-950 mb-2 uppercase tracking-wider">
                8 Benda Resep Terpilih:
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-w-lg mx-auto">
                {cauldronDiscoveries.slice(0, 8).map((disc) => (
                  <div
                    key={disc.id}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-white shadow-md bg-white"
                    title={disc.objectName}
                  >
                    <GameAssetImage
                      src={disc.photoUrl}
                      alt={disc.objectName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-3 border-t-2 border-amber-300/60 flex items-center justify-between w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  playMagicBoomSound();
                  try {
                    confetti({
                      particleCount: 110,
                      spread: 100,
                      origin: { x: campSide === 'left' ? 0.3 : 0.7, y: 0.5 },
                    });
                  } catch {
                    // ignore
                  }
                }}
                className="btn-3d px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 text-slate-900 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_3px_0_#CBD5E1] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>Rayakan Lagi</span>
              </button>

              <button
                type="button"
                onClick={() => setIsShowingCampCelebration(false)}
                className="btn-3d px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_3px_0_#1E293B] cursor-pointer"
              >
                <span>Kembali ke Papan Kemah</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Discovery Modal */}
      {selectedInspectDisc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-pop-in"
          onClick={() => setSelectedInspectDisc(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white border-4 border-amber-400 p-5 shadow-2xl flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <span>Benda Hasil Ekspedisi</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedInspectDisc(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <GameAssetImage
                src={selectedInspectDisc.photoUrl}
                alt={selectedInspectDisc.objectName}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {selectedInspectDisc.objectName}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Ditemukan oleh: <strong>{selectedInspectDisc.studentName}</strong>
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 text-amber-950 text-xs font-bold">
                <span>
                  Bentuk:{' '}
                  {
                    SHAPE_DEFINITIONS[getCardShape(selectedInspectDisc)].name
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
