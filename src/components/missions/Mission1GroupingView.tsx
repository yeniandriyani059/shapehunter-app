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

  const unlockedDiscoveries = groupDiscoveries.filter((d) => !d.isLocked);
  const lockedDiscoveries = groupDiscoveries.filter((d) => d.isLocked);

  const activeDiscovery =
    unlockedDiscoveries.find((d) => stagedPlacement?.discoveryId === d.id) ||
    unlockedDiscoveries.find((d) => selectedDiscoveryId === d.id) ||
    unlockedDiscoveries[0] ||
    null;

  /**
   * Hit-test pointer coordinates and dragged card center against THIS GROUP's 4 shape portals.
   * Cross-camp drop is strictly blocked (cards from Group 1 cannot drop into Group 2's portals).
   */
  const detectArenaDropZone = useCallback(
    (
      pointerX: number,
      pointerY: number,
      cardCenterX: number,
      cardCenterY: number
    ): ShapeType | null => {
      const tolerance = 22;
      let bestMatch: ShapeType | null = null;
      let bestDistance = Infinity;

      for (const shapeDef of SHAPE_LIST) {
        const el = dropZoneRefs.current[shapeDef.id];
        if (!el) continue;

        // Double verification: island element must belong to this camp
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
      targetShape: ShapeType,
      customAnnotations: AnnotationMarker[] = [],
      customTrait: string = ''
    ) => {
      if (submitting || !isPlaying) return;
      setSubmitting(true);

      const targetShapeDef = SHAPE_DEFINITIONS[targetShape];

      try {
        const response = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            groupId: group.id,
            discoveryId: disc.id,
            selectedShape: targetShape,
            levelAtAttempt: 1,
            annotationsJson: JSON.stringify(customAnnotations),
            traitsVerified: false,
            reasonText: customTrait || null,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Coba periksa lagi ya!');
        }

        if (data.result.isCorrect) {
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

          const totalEarned =
            data.result.pointsAwarded + (data.result.bonusAwarded || 0);

          if (onSetGuideMessage) {
            onSetGuideMessage({
              mood: 'celebrating',
              text: `HEBAT! "${disc.objectName}" cocok di Pulau ${targetShapeDef.name}!`,
              pointsEarned: totalEarned,
            });
          }

          setStagedPlacement(null);
          setSelectedDiscoveryId(null);
        } else {
          playTryAgainSound();
          setStagedPlacement(null);
          setReturningCardId(disc.id);
          setShakeCardId(disc.id);
          setTimeout(() => {
            setReturningCardId(null);
            setShakeCardId(null);
          }, 650);

          if (onSetGuideMessage) {
            onSetGuideMessage({
              mood: 'hint',
              text: `Ups! Benda ini belum cocok dengan pulau ini. Coba amati lagi bentuk tepi dan pojoknya ya!`,
            });
          }
        }

        if (data.state) {
          onAttemptSubmitted(data.state);
        }
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
                  key={`m1-unlocked-${disc.id || index}-${index}`}
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
                  </div>

                  <div className="pointer-events-none select-none px-1 text-center">
                    <p className="font-display text-sm font-bold text-slate-900 truncate">
                      {disc.objectName}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                      {disc.studentName}
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
            const lockedInThisZone = lockedDiscoveries.filter(
              (d) => d.classifiedShape === shapeDef.id
            );

            return (
              <div
                key={shapeDef.id}
                data-group-id={group.id}
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
                } p-3.5 cursor-pointer flex flex-col justify-between min-h-[156px] select-none`}
              >
                {/* Portal Island Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShapeMascot3D shape={shapeDef.id} size={48} />
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
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white font-display font-bold text-xs shrink-0 shadow-xs">
                      {lockedInThisZone.length} Benda
                    </span>
                  )}
                </div>

                {/* Drop Target Feedback Area */}
                {isDropHovered ? (
                  <div className="mt-2.5 rounded-2xl border-2 border-amber-500 bg-amber-100/95 py-3 px-3 text-center font-display text-sm font-bold text-amber-950 animate-pop-in">
                    Lepaskan Kartu di Pulau {shapeDef.name}!
                  </div>
                ) : isSparkling ? (
                  <div className="mt-2.5 rounded-2xl border-2 border-emerald-500 bg-emerald-100 py-3 px-3 text-center font-display text-sm font-bold text-emerald-950 animate-pop-in">
                    TEPAT! +10 XP Terbuka!
                  </div>
                ) : isStagedHere && activeDiscovery ? (
                  <div className="mt-2.5 p-2 rounded-2xl bg-amber-100/90 border-2 border-amber-400 flex items-center gap-2.5 animate-pop-in">
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
                  <div className="mt-2.5 flex items-center gap-2 overflow-x-auto py-0.5">
                    {lockedInThisZone.slice(0, 4).map((locked, idx) => (
                      <div
                        key={`m1-locked-${locked.id || idx}-${idx}`}
                        className={`relative w-10 h-10 rounded-xl overflow-hidden border-2 ${
                          locked.traitsVerified
                            ? 'border-amber-400 ring-2 ring-amber-300/80 shadow-sm'
                            : 'border-emerald-400 shadow-xs'
                        } shrink-0`}
                        title={locked.objectName}
                      >
                        <GameAssetImage
                          src={locked.photoUrl}
                          alt={locked.objectName}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 ${
                            locked.traitsVerified
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : 'bg-emerald-500 text-white font-bold'
                          } text-[9px] px-0.5 rounded-tl`}
                        >
                          {locked.traitsVerified ? 'P' : 'L'}
                        </span>
                      </div>
                    ))}
                    <span className="text-xs font-display font-bold text-emerald-800 ml-1">
                      {lockedInThisZone.length} Benda Terbuka
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/75 py-2.5 px-3 text-center font-display text-xs font-bold text-slate-600">
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
