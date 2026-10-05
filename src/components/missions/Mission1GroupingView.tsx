import React, { useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Group,
  Discovery,
  ShapeType,
  SHAPE_DEFINITIONS,
  SHAPE_LIST,
  AnnotationMarker,
} from '../../types/game.ts';
import { ShapeMascot3D, GameAssetImage } from '../ShapeMascot3D.tsx';
import {
  playClickSound,
  playShapeLockSound,
  playTryAgainSound,
} from '../../utils/sound.ts';
import { Sparkles, RotateCcw } from 'lucide-react';
import {
  evaluateShapeAttempt,
  loadSavedGameState,
  saveGameState,
} from '../../utils/gameStore.ts';
import { supabase, isSupabaseConfigured } from '../../supabaseClient.ts';

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
  hoveredShape: ShapeType | null;
}

export interface Mission1GroupingViewProps {
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

export const Mission1GroupingView: React.FC<Mission1GroupingViewProps> = ({
  campSide,
  sessionId,
  isPlaying,
  group,
  groupDiscoveries,
  guideCharacter,
  onAttemptSubmitted,
  onSetGuideMessage,
}) => {
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState<number | null>(
    null
  );
  const [stagedPlacement, setStagedPlacement] = useState<{
    discoveryId: number;
    shape: ShapeType;
  } | null>(null);

  // Multi-Touch Real-Time Drag Tracking: Map of discoveryId -> ActiveCardDrag
  // Allows multiple students across groups or within the same group to drag cards simultaneously
  const [activeDrags, setActiveDrags] = useState<Record<number, ActiveCardDrag>>({});
  const [returningCardId, setReturningCardId] = useState<number | null>(null);
  const [shakeCardId, setShakeCardId] = useState<number | null>(null);
  const [sparkleZoneShape, setSparkleZoneShape] = useState<ShapeType | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  // Drop zones strictly bounded to this group's shape portals
  const dropZoneRefs = useRef<Record<ShapeType, HTMLDivElement | null>>({
    lingkaran: null,
    segitiga: null,
    persegi: null,
    persegi_panjang: null,
  });

  const isCardAssigned = (d: Discovery) => {
    return Boolean(d.island || d.classifiedShape || d.targetShape);
  };

  const unlockedDiscoveries = groupDiscoveries.filter((d) => !isCardAssigned(d));
  const lockedDiscoveries = groupDiscoveries.filter((d) => isCardAssigned(d));

  // Total XP accumulation for this group in Mission 1 with fallback to 10
  const totalGroupXp = groupDiscoveries.reduce(
    (sum, d) => sum + (typeof d.xp === 'number' && d.xp > 0 ? d.xp : (Number(d.xp) || 10)),
    0
  );

  const activeDiscovery =
    unlockedDiscoveries.find((d) => stagedPlacement?.discoveryId === d.id) ||
    unlockedDiscoveries.find((d) => selectedDiscoveryId === d.id) ||
    unlockedDiscoveries[0] ||
    null;

  /**
   * Hit-test pointer coordinates and dragged card center against THIS GROUP's 4 shape portals.
   * Multi-touch isolated: cards from Group 1 strictly hit Group 1 portals; cards from Group 2 hit Group 2 portals.
   */
  const detectArenaDropZone = useCallback(
    (
      pointerX: number,
      pointerY: number,
      cardCenterX: number,
      cardCenterY: number
    ): ShapeType | null => {
      // 1. Direct hit-test using elementFromPoint for ultra-responsive multi-touch dropping
      if (typeof document !== 'undefined') {
        const targetElement = document.elementFromPoint(pointerX, pointerY);
        const islandNode = targetElement?.closest<HTMLElement>('[data-shape-island]');
        if (islandNode) {
          const islandGroupId = islandNode.getAttribute('data-group-id');
          const islandShape = islandNode.getAttribute('data-shape-island') as ShapeType;
          if (islandGroupId === String(group.id) && islandShape && SHAPE_DEFINITIONS[islandShape]) {
            return islandShape;
          }
        }
      }

      // 2. Fallback: Geometrical bounding-box proximity with touch tolerance
      const tolerance = 28;
      let bestMatch: ShapeType | null = null;
      let bestDistance = Infinity;

      for (const shapeDef of SHAPE_LIST) {
        const el = dropZoneRefs.current[shapeDef.id];
        if (!el) continue;

        // Strict verification: island element must belong to this specific camp/board
        const gid = el.getAttribute('data-group-id');
        if (gid && gid !== String(group.id)) continue;

        const rect = el.getBoundingClientRect();

        const pointerInside =
          pointerX >= rect.left - tolerance &&
          pointerX <= rect.right + tolerance &&
          pointerY >= rect.top - tolerance &&
          pointerY <= rect.bottom + tolerance;

        const centerInside =
          cardCenterX >= rect.left - tolerance &&
          cardCenterX <= rect.right + tolerance &&
          cardCenterY >= rect.top - tolerance &&
          cardCenterY <= rect.bottom + tolerance;

        if (pointerInside || centerInside) {
          const zoneCenterX = rect.left + rect.width / 2;
          const zoneCenterY = rect.top + rect.height / 2;
          const dist = Math.hypot(
            cardCenterX - zoneCenterX,
            cardCenterY - zoneCenterY
          );
          if (dist < bestDistance) {
            bestDistance = dist;
            bestMatch = shapeDef.id;
          }
        }
      }

      return bestMatch;
    },
    [group.id]
  );

  const submitShapeCheck = useCallback(
    async (
      disc: Discovery,
      targetShape: ShapeType
    ) => {
      if (submitting || !isPlaying) return;
      setSubmitting(true);

      const targetShapeDef = SHAPE_DEFINITIONS[targetShape];

      try {
        const currentSavedState = loadSavedGameState();

        // 1. Build a complete, non-destructive list of all discoveries
        const discMap = new Map<number, Discovery>();
        (currentSavedState.discoveries || []).forEach((d) => discMap.set(d.id, d));
        (groupDiscoveries || []).forEach((d) => discMap.set(d.id, d));

        // 2. Update the target dropped discovery to be grouped into this island with Terbukti status
        const currentDisc = discMap.get(disc.id) || disc;
        discMap.set(disc.id, {
          ...currentDisc,
          island: targetShape,
          targetShape: targetShape,
          classifiedShape: targetShape,
          isLocked: true,
          isProven: true,
          traitsVerified: true,
          xp: typeof currentDisc.xp === 'number' && currentDisc.xp > 0 ? currentDisc.xp : 10,
        });

        const updatedDiscoveries = Array.from(discMap.values());

        // 3. Update group score: add +10 XP
        const updatedScores = currentSavedState.scores.map((score) => {
          if (score.groupId === group.id) {
            const newAttempts = score.attemptCount + 1;
            const newCorrect = score.correctCount + 1;
            const newXp = score.xp + 10;
            const newAccuracy = Math.round((newCorrect / Math.max(1, newAttempts)) * 100);

            return {
              ...score,
              xp: newXp,
              attemptCount: newAttempts,
              correctCount: newCorrect,
              accuracy: newAccuracy,
              updatedAt: new Date().toISOString(),
            };
          }
          return score;
        });

        const newAttempt: GameAttempt = {
          id: Date.now() + Math.floor(Math.random() * 500),
          sessionId: currentSavedState.session.id,
          groupId: group.id,
          discoveryId: disc.id,
          selectedShape: targetShape,
          isCorrect: true,
          levelAtAttempt: currentSavedState.session.currentLevel,
          pointsAwarded: 10,
          bonusAwarded: 0,
          reasonText: `Benda dimasukkan ke Pulau ${targetShapeDef.name} dan terbukti cocok!`,
          createdAt: new Date().toISOString(),
        };

        const nextState: FullSessionState = {
          ...currentSavedState,
          discoveries: updatedDiscoveries,
          scores: updatedScores,
          attempts: [newAttempt, ...(currentSavedState.attempts || [])],
        };

        saveGameState(nextState);

        playShapeLockSound();
        setSparkleZoneShape(targetShape);
        setTimeout(() => setSparkleZoneShape(null), 1400);

        try {
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { x: campSide === 'left' ? 0.28 : 0.72, y: 0.6 },
          });
        } catch {
          // ignore confetti error
        }

        // 4. Non-blocking asynchronous sync to Supabase without triggering refetch/reset
        if (isSupabaseConfigured) {
          supabase
            .from('kartu_temuan')
            .update({ is_proven: true, real_shape: targetShape })
            .eq('id', disc.id)
            .then(() => {})
            .catch((dbErr) => {
              console.warn('Supabase update is_proven notice:', dbErr);
            });
        }

        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'celebrating',
            text: `HEBAT! "${disc.objectName || (disc as any).nama_benda || 'Benda'}" langsung masuk ke Pulau ${targetShapeDef.name} dan berstatus Terbukti! (+10 XP)`,
            pointsEarned: 10,
          });
        }

        setStagedPlacement(null);
        setSelectedDiscoveryId(null);
        onAttemptSubmitted(nextState);
      } catch (err: any) {
        console.error('Failed to submit shape check:', err);
        if (onSetGuideMessage) {
          onSetGuideMessage({
            mood: 'hint',
            text: err.message || 'Yuk periksa lagi pilihanmu!',
          });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      isPlaying,
      sessionId,
      group.id,
      campSide,
      groupDiscoveries,
      onSetGuideMessage,
      guideCharacter,
      onAttemptSubmitted,
    ]
  );

  // Multi-Touch Pointer Event Handlers for Drag & Drop
  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery
  ) => {
    if (!isPlaying || submitting) return;

    // Multi-touch: acquire pointer capture on currentTarget (the card element itself)
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const cardRect = e.currentTarget.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;

    setSelectedDiscoveryId(disc.id);
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
        hoveredShape: null,
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
    const hasMoved = drag.hasMoved || Math.hypot(dx, dy) > 6;

    const currentCardCenterX = drag.cardCenterX + dx;
    const currentCardCenterY = drag.cardCenterY + dy;

    const hoveredShape = hasMoved
      ? detectArenaDropZone(
          e.clientX,
          e.clientY,
          currentCardCenterX,
          currentCardCenterY
        )
      : null;

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
          hoveredShape,
        },
      };
    });
  };

  const handleCardPointerUpOrCancel = (
    e: React.PointerEvent<HTMLDivElement>,
    disc: Discovery,
    isCancel = false
  ) => {
    const currentDrag = activeDrags[disc.id];
    if (!currentDrag || currentDrag.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    // Clean this card from active multi-touch state
    setActiveDrags((prev) => {
      const next = { ...prev };
      delete next[disc.id];
      return next;
    });

    if (isCancel) return;

    if (currentDrag.hasMoved) {
      const dropShape = detectArenaDropZone(
        e.clientX,
        e.clientY,
        currentDrag.cardCenterX + currentDrag.dx,
        currentDrag.cardCenterY + currentDrag.dy
      );

      if (dropShape) {
        submitShapeCheck(disc, dropShape);
      } else {
        setReturningCardId(disc.id);
        setTimeout(() => setReturningCardId(null), 450);
      }
    } else {
      playClickSound();
      setSelectedDiscoveryId(disc.id);
      if (onSetGuideMessage) {
        onSetGuideMessage({
          mood: 'cheerful',
          text: `Kamu memilih "${disc.objectName}". Sekarang sentuh pulau bentuk yang cocok!`,
        });
      }
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
  };

  const handleShapeZoneTap = (shape: ShapeType) => {
    if (!activeDiscovery || !isPlaying || submitting) return;
    playClickSound();
    setStagedPlacement({ discoveryId: activeDiscovery.id, shape });
    submitShapeCheck(activeDiscovery, shape);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Misi 1 Banner */}
      <div className="rounded-2xl border-2 border-sky-400 bg-sky-50/90 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-sky-200 border border-sky-400 flex items-center justify-center font-display font-black text-sky-900 text-sm shrink-0">
            M1
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold text-sky-950 truncate">
              Misi 1: Kelompokkan Bentuk ke Pulau!
            </h3>
            <p className="text-xs text-sky-800 truncate">
              Sentuh & seret kartu foto Temuanmu ke salah satu dari 4 Pulau Bentuk.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-xl bg-sky-200/80 text-sky-900 font-display font-bold text-xs shrink-0 whitespace-nowrap">
          Seret & Lepas
        </span>
      </div>

      {/* Banner Akumulasi XP Misi 1 */}
      <div className="flex items-center justify-between bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 rounded-2xl px-4 py-2.5 border-2 border-amber-500 shadow-sm shadow-amber-200/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/30 border border-amber-600 flex items-center justify-center text-lg">
            ⭐
          </div>
          <div>
            <span className="font-display font-black text-xs sm:text-sm text-slate-950 block leading-tight tracking-wide">
              AKUMULASI XP KELOMPOK
            </span>
            <span className="text-[11px] font-bold text-amber-950">
              {groupDiscoveries.length} Kartu Temuan Terkumpul
            </span>
          </div>
        </div>
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-300 font-display font-black text-sm sm:text-base border border-amber-400/50 shadow-inner flex items-center gap-1.5 animate-pop-in">
          <span>⭐</span>
          <span>+{totalGroupXp} XP</span>
        </div>
      </div>

      {/* Petunjuk Lokasi Pencarian Benda Sekolah */}
      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
        <div className="font-bold text-emerald-950">
          Petunjuk Lokasi Pencarian:
        </div>
        <div className="flex items-center gap-2 flex-wrap font-semibold text-emerald-900">
          <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs">
            Ruang Kelas (jam, buku, ubin)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs">
            Taman (pot, dedaunan, rambu)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs">
            Lapangan (roda, cone, tiang)
          </span>
        </div>
      </div>

      {/* 1. COLLECTIBLE PHOTO CARDS ("TEMUANMU") */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Temuanmu</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-600">
              ({unlockedDiscoveries.length} Kartu Siap Dikelompokkan)
            </span>
          </h3>
          <span className="font-display text-xs font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-lg">
            Seret ke Pulau Bentuk
          </span>
        </div>

        {unlockedDiscoveries.length === 0 ? (
          <div className="rounded-3xl border-3 border-dashed border-emerald-300 bg-emerald-50/80 p-5 text-center animate-pop-in">
            <p className="font-display text-base sm:text-lg font-bold text-emerald-950">
              Luar Biasa! Semua Kartu Sudah Berhasil Dikelompokkan!
            </p>
            <p className="text-xs sm:text-sm font-medium text-emerald-800 mt-1">
              Potret benda baru dari HP siswa untuk menambah kartu, atau beralih ke <strong>Misi 2: Buktikan!</strong>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 relative">
            {unlockedDiscoveries.map((disc, index) => {
              const drag = activeDrags[disc.id];
              const isBeingDragged = !!drag && drag.hasMoved;
              const isSelected = activeDiscovery?.id === disc.id;
              const isStaged = stagedPlacement?.discoveryId === disc.id;
              const isReturning = returningCardId === disc.id;
              const isShaking = shakeCardId === disc.id;
              const cardXp = typeof disc.xp === 'number' && disc.xp > 0 ? disc.xp : (Number(disc.xp) || 10);

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
                  key={`m1-unlocked-${disc.id}`}
                  onPointerDown={(e) => handleCardPointerDown(e, disc)}
                  onPointerMove={(e) => handleCardPointerMove(e, disc)}
                  onPointerUp={(e) =>
                    handleCardPointerUpOrCancel(e, disc, false)
                  }
                  onPointerCancel={(e) =>
                    handleCardPointerUpOrCancel(e, disc, true)
                  }
                  onLostPointerCapture={(e) =>
                    handleCardLostPointerCapture(e, disc)
                  }
                  style={dragTransformStyle}
                  className={`pid-draggable-card touch-none select-none cursor-grab active:cursor-grabbing ${
                    isReturning ? 'card-spring-return' : ''
                  } ${
                    isShaking ? 'animate-gentle-shake' : ''
                  } rounded-3xl p-2.5 border-3 select-none relative ${
                    isBeingDragged
                      ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-300/90 shadow-[0_20px_35px_rgba(15,23,42,0.35)]'
                      : isStaged
                      ? 'scale-103 border-amber-500 bg-amber-50 ring-4 ring-amber-300/60 shadow-[0_6px_0_#F59E0B]'
                      : isSelected
                      ? 'border-sky-500 bg-white ring-4 ring-sky-300/50 shadow-[0_6px_0_#0284C7]'
                      : 'border-white bg-white shadow-[0_5px_0_#CBD5E1] hover:-translate-y-0.5 transition-transform'
                  }`}
                >
                  <div className="pointer-events-none select-none relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 mb-2 border border-slate-100">
                    <GameAssetImage
                      src={disc.photoUrl}
                      alt={disc.objectName}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />

                    {/* Lencana XP Emas di Pojok Kartu */}
                    <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-slate-950 border border-amber-500 font-display font-black text-[10px] shadow-sm flex items-center gap-0.5">
                      <span>⭐</span>
                      <span>+{cardXp} XP</span>
                    </div>
                  </div>

                    <div className="pointer-events-none select-none px-1 text-center">
                      <p className="font-display text-sm font-bold text-slate-900 truncate">
                        {disc.objectName}
                      </p>
                      <p className="text-xs font-bold text-sky-700 truncate mt-0.5 flex items-center justify-center gap-1">
                        <span>👤</span>
                        <span>
                          {disc.studentName || (disc as any).penemu || (disc as any).student_name || (disc as any).nama || 'Tanpa Nama'}
                        </span>
                      </p>
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. FOUR PLAYFUL SHAPE PORTALS / ISLANDS (DROP ZONES) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
            4 Pulau Bentuk (Lepaskan Kartu di Sini)
          </h3>
          {stagedPlacement && (
            <button
              type="button"
              onClick={() => setStagedPlacement(null)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ganti Pilihan</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {SHAPE_LIST.map((shapeDef) => {
            const isDropHovered = Object.values(activeDrags).some(
              (d) => d.hoveredShape === shapeDef.id
            );
            const isStagedHere = stagedPlacement?.shape === shapeDef.id;
            const isSparkling = sparkleZoneShape === shapeDef.id;
            const lockedInThisZone = groupDiscoveries.filter((d) => {
              const assigned = (d.island || d.classifiedShape || d.targetShape || '')
                .toString()
                .toLowerCase()
                .trim();
              if (assigned === shapeDef.id.toLowerCase().trim()) return true;
              if (d.isLocked && (d.realShape === shapeDef.id || d.expectedShape === shapeDef.id)) return true;
              return false;
            });

            return (
              <div
                key={shapeDef.id}
                data-group-id={group.id}
                data-shape-island={shapeDef.id}
                ref={(el) => {
                  dropZoneRefs.current[shapeDef.id] = el;
                }}
                onClick={() => handleShapeZoneTap(shapeDef.id)}
                className={`rounded-[24px] bg-gradient-to-b ${shapeDef.portalBg} border-3 transition-transform duration-150 ${
                  isDropHovered
                    ? 'border-amber-400 ring-4 ring-amber-300 shadow-[0_10px_24px_rgba(245,158,11,0.35)] scale-[1.04]'
                    : isSparkling
                    ? 'border-emerald-400 ring-4 ring-emerald-300 shadow-[0_8px_20px_rgba(16,185,129,0.35)] scale-[1.03]'
                    : isStagedHere
                    ? 'border-amber-500 ring-4 ring-amber-300/70 shadow-[0_7px_0_#F59E0B] scale-[1.02]'
                    : `${shapeDef.portalBorder} ${shapeDef.portalShadow}`
                } p-3 sm:p-3.5 cursor-pointer flex flex-col justify-between min-h-[168px] select-none`}
              >
                {/* Portal Island Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShapeMascot3D shape={shapeDef.id} size={46} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-6 h-6 rounded-lg ${shapeDef.portalRing} font-display font-bold text-sm flex items-center justify-center shrink-0`}
                        >
                          {shapeDef.symbol}
                        </span>
                        <h4
                          className={`font-display text-base sm:text-lg font-bold tracking-wide truncate ${shapeDef.textClass}`}
                        >
                          {shapeDef.upperName}
                        </h4>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                        {shapeDef.shortRule}
                      </p>
                    </div>
                  </div>

                  {lockedInThisZone.length > 0 && (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-display font-black text-xs shrink-0 shadow-xs flex items-center gap-1">
                      <span>⭐</span>
                      <span>{lockedInThisZone.length} Benda</span>
                    </span>
                  )}
                </div>

                {/* Drop Target Feedback Area / Mini Photo Cards Inside Island */}
                {isDropHovered ? (
                  <div className="mt-2 rounded-2xl border-2 border-amber-500 bg-amber-100/95 py-3 px-3 text-center font-display text-sm font-bold text-amber-950 animate-pop-in">
                    Lepaskan Kartu di Pulau {shapeDef.name}!
                  </div>
                ) : isSparkling ? (
                  <div className="mt-2 rounded-2xl border-2 border-emerald-500 bg-emerald-100 py-3 px-3 text-center font-display text-sm font-bold text-emerald-950 animate-pop-in">
                    TEPAT! +10 XP Berhasil Dikumpulkan!
                  </div>
                ) : isStagedHere && activeDiscovery ? (
                  <div className="mt-2 p-2 rounded-2xl bg-amber-100/90 border-2 border-amber-400 flex items-center gap-2.5 animate-pop-in">
                    <GameAssetImage
                      src={activeDiscovery.photoUrl}
                      alt={activeDiscovery.objectName}
                      className="w-11 h-11 rounded-xl object-cover shrink-0 border-2 border-white shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="font-display text-sm font-bold text-slate-900 truncate">
                        {activeDiscovery.objectName}
                      </div>
                      <div className="text-xs font-bold text-amber-800">
                        Memeriksa jawaban...
                      </div>
                    </div>
                  </div>
                ) : lockedInThisZone.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {/* Mini Card Grid of Settled Photos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[210px] overflow-y-auto p-2 rounded-2xl bg-white/90 border border-emerald-200 shadow-inner scrollbar-thin">
                      {lockedInThisZone.map((locked, idx) => {
                        const lockedXp =
                          typeof locked.xp === 'number' && locked.xp > 0
                            ? locked.xp
                            : (Number(locked.xp) || 10);
                        return (
                          <div
                            key={`island-item-${locked.id || idx}-${idx}`}
                            className="relative rounded-2xl bg-white border-2 border-emerald-400 p-1.5 shadow-xs hover:shadow-md transition-all flex flex-col gap-1 select-none"
                          >
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-emerald-100">
                              <GameAssetImage
                                src={locked.photoUrl || (locked as any).image_url || (locked as any).imageUrl || ''}
                                alt={locked.objectName || (locked as any).nama_benda || 'Benda Temuan'}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-display font-black text-[9px] shadow-xs">
                                ⭐+{lockedXp}
                              </span>
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-lg bg-emerald-600 text-white font-display font-black text-[8px] shadow-xs flex items-center gap-0.5">
                                ✅ Terbukti
                              </span>
                            </div>
                            <div className="text-center px-0.5">
                              <p
                                className="font-display text-[11px] font-bold text-slate-900 truncate leading-tight"
                                title={locked.objectName || (locked as any).nama_benda || 'Benda Temuan'}
                              >
                                {locked.objectName || (locked as any).nama_benda || 'Benda Temuan'}
                              </p>
                              <p className="text-[9px] font-semibold text-sky-700 truncate mt-0.5">
                                {locked.studentName || (locked as any).penemu || (locked as any).student_name || (locked as any).nama || 'Tanpa Nama'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-display font-bold text-emerald-950 px-1 pt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{lockedInThisZone.length} Benda Terbukti & Terkunci</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">+ Tambah lagi</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/75 py-3 px-3 text-center font-display text-xs font-bold text-slate-500">
                    Seret Kartu ke Pulau {shapeDef.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
