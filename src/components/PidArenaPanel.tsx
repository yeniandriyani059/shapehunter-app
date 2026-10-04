import React, { useState } from 'react';
import {
  Pencil,
  Check,
  X,
  Maximize2,
} from 'lucide-react';
import {
  Discovery,
  Group,
  GroupScore,
  formatCampDisplayName,
  MISSION_LEVELS,
} from '../types/game.ts';
import {
  CharacterGuide,
  XpStarsDisplay,
  TeamCampBadge,
} from './GameAssets3D.tsx';
import { ProveModal } from './ProveModal.tsx';
import { playClickSound } from '../utils/sound.ts';
import { Mission1GroupingView } from './missions/Mission1GroupingView.tsx';
import { Mission2DetectiveView } from './missions/Mission2DetectiveView.tsx';
import { Mission3TreasureMapView } from './missions/Mission3TreasureMapView.tsx';

interface PidArenaPanelProps {
  campSide: 'left' | 'right';
  sessionId: number;
  currentLevel: number;
  missionTitle: string;
  missionTargetShape: string;
  missionTargetCount: number;
  isPlaying: boolean;
  group: Group;
  score: GroupScore | undefined;
  groupDiscoveries: Discovery[];
  onAttemptSubmitted: (newState: any) => void;
  onFocusGroup?: () => void;
  isFocusMode?: boolean;
}

const CAMP_THEMES: Record<
  string,
  {
    campGradient: string;
    campBorder: string;
    campShadow: string;
    bannerBg: string;
    dotColor: string;
    badgeBg: string;
  }
> = {
  blue: {
    campGradient: 'from-sky-50/95 via-white/95 to-sky-100/90',
    campBorder: 'border-sky-400',
    campShadow: 'shadow-[0_10px_0_#38BDF8]',
    bannerBg: 'bg-gradient-to-r from-sky-600 via-blue-600 to-sky-500',
    dotColor: 'bg-sky-400',
    badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
  },
  emerald: {
    campGradient: 'from-emerald-50/95 via-white/95 to-emerald-100/90',
    campBorder: 'border-emerald-400',
    campShadow: 'shadow-[0_10px_0_#34D399]',
    bannerBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500',
    dotColor: 'bg-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  amber: {
    campGradient: 'from-amber-50/95 via-white/95 to-amber-100/90',
    campBorder: 'border-amber-400',
    campShadow: 'shadow-[0_10px_0_#FBBF24]',
    bannerBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  rose: {
    campGradient: 'from-rose-50/95 via-white/95 to-rose-100/90',
    campBorder: 'border-rose-400',
    campShadow: 'shadow-[0_10px_0_#FB7185]',
    bannerBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500',
    dotColor: 'bg-rose-400',
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
  },
};

export const PidArenaPanel: React.FC<PidArenaPanelProps> = ({
  campSide,
  sessionId,
  currentLevel,
  missionTitle,
  missionTargetShape,
  missionTargetCount,
  isPlaying,
  group,
  score,
  groupDiscoveries,
  onAttemptSubmitted,
  onFocusGroup,
  isFocusMode = false,
}) => {
  const theme = CAMP_THEMES[group.color] || CAMP_THEMES.blue;
  const campName = formatCampDisplayName(group.name);
  const guideCharacter = campSide === 'left' ? 'raka' : 'luna';
  const missionInfo = MISSION_LEVELS[currentLevel] || MISSION_LEVELS[1];

  // Mission 2 Prove Modal State (optional fallback if triggered)
  const [provingDiscovery, setProvingDiscovery] = useState<Discovery | null>(
    null
  );

  // Group Camp Name Editing
  const [isEditingCampName, setIsEditingCampName] = useState(false);
  const [tempCampName, setTempCampName] = useState(group.name);
  const [isSavingCampName, setIsSavingCampName] = useState(false);

  React.useEffect(() => {
    if (!isEditingCampName) {
      setTempCampName(group.name);
    }
  }, [group.name, isEditingCampName]);

  const handleSaveCampName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tempCampName.trim();
    if (!trimmed) return;
    playClickSound();
    setIsSavingCampName(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          onAttemptSubmitted(data.state);
        }
        setIsEditingCampName(false);
      }
    } catch (err) {
      console.error('Failed to update group name:', err);
    } finally {
      setIsSavingCampName(false);
    }
  };

  const [guideState, setGuideState] = useState<{
    mood: 'cheerful' | 'celebrating' | 'hint';
    text: string;
    pointsEarned?: number;
  } | null>(null);

  const lockedDiscoveries = groupDiscoveries.filter((d) => d.isLocked);
  const xp = score?.xp ?? 0;
  const accuracy = score?.accuracy ?? 0;
  const totalCount = groupDiscoveries.length;
  const unlockedRatio =
    totalCount > 0 ? Math.round((lockedDiscoveries.length / totalCount) * 100) : 0;

  const missionMatchingCount =
    missionTargetShape === 'all'
      ? groupDiscoveries.length
      : groupDiscoveries.filter(
          (d) =>
            d.classifiedShape === missionTargetShape ||
            d.expectedShape === missionTargetShape
        ).length;

  const defaultMessage =
    guideCharacter === 'luna'
      ? missionInfo.lunaQuote
      : missionInfo.rakaQuote;

  return (
    <section
      className={`relative flex flex-col rounded-[28px] bg-gradient-to-b ${theme.campGradient} border-4 ${theme.campBorder} ${theme.campShadow} overflow-visible backdrop-blur-xs`}
      aria-label={`Kemah ${campName}`}
    >
      {/* 1. ADVENTURE CAMP BANNER */}
      <div
        className={`${theme.bannerBg} text-white px-5 py-3.5 rounded-t-[24px] flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <TeamCampBadge color={group.color} size={48} />
          <div className="min-w-0 flex-1">
            {isEditingCampName ? (
              <form
                onSubmit={handleSaveCampName}
                className="flex items-center gap-2 flex-wrap mb-1"
              >
                <input
                  type="text"
                  required
                  value={tempCampName}
                  onChange={(e) => setTempCampName(e.target.value)}
                  className="px-3 py-1 rounded-xl text-slate-900 font-display font-bold text-base sm:text-lg bg-white border-2 border-amber-300 shadow-inner focus:outline-hidden min-w-[150px] max-w-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingCampName(false);
                      setTempCampName(group.name);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isSavingCampName}
                  title="Simpan Nama Kelompok"
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
                <button
                  type="button"
                  title="Batal"
                  onClick={() => {
                    playClickSound();
                    setIsEditingCampName(false);
                    setTempCampName(group.name);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-display font-bold text-xs flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full ${theme.dotColor} shrink-0`} />
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wide truncate drop-shadow-xs">
                  {campName}
                </h2>
                <button
                  type="button"
                  title="Ubah Nama Kelompok"
                  onClick={() => {
                    playClickSound();
                    setTempCampName(group.name);
                    setIsEditingCampName(true);
                  }}
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {onFocusGroup && !isFocusMode && (
                  <button
                    type="button"
                    title="Perbesar / Fokuskan Kelompok Ini"
                    onClick={() => {
                      playClickSound();
                      onFocusGroup();
                    }}
                    className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90">
              <span>Ketepatan: {accuracy}%</span>
              <span aria-hidden="true">·</span>
              <span>
                {currentLevel === 3
                  ? `Target: ${missionMatchingCount}/${missionTargetCount}`
                  : `Terbuka: ${lockedDiscoveries.length}/${totalCount}`}
              </span>
            </div>
          </div>
        </div>

        {/* XP Stars & Flying Reward Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {guideState?.pointsEarned ? (
            <span className="animate-pop-in px-3 py-1 rounded-2xl bg-amber-300 text-slate-950 font-display font-bold text-base shadow-sm">
              +{guideState.pointsEarned} XP!
            </span>
          ) : null}
          <XpStarsDisplay xp={xp} size="md" />
        </div>
      </div>

      {/* 2. PERJALANAN MISI (Visual Adventure Trail + Character Guide) */}
      <div className="px-5 pt-3.5 pb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 bg-white/85 rounded-2xl px-4 py-2 border-2 border-slate-200/80">
          <span className="font-display font-bold text-sm text-slate-800 whitespace-nowrap">
            {currentLevel === 1
              ? 'Misi 1 — Kelompokkan!'
              : currentLevel === 2
              ? 'Misi 2 — Buktikan!'
              : 'Misi 3 — Kuali Ramuan Ajaib'}
          </span>
          <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-transform duration-300 origin-left"
              style={{
                transform: `scaleX(${Math.max(
                  0.06,
                  currentLevel === 3
                    ? Math.min(1, missionMatchingCount / Math.max(1, missionTargetCount))
                    : unlockedRatio / 100
                )})`,
              }}
            />
          </div>
          <span className="font-display font-bold text-sm text-emerald-700 whitespace-nowrap">
            {currentLevel === 3
              ? `${Math.min(8, lockedDiscoveries.length)}/8 Benda Valid`
              : `${lockedDiscoveries.length}/${totalCount} Terbuka!`}
          </span>
        </div>

        {/* Recurring 3D Chibi Guide (Raka or Luna) */}
        <CharacterGuide
          character={guideCharacter}
          mood={guideState?.mood || 'cheerful'}
          message={guideState?.text || defaultMessage}
          compact
        />
      </div>

      {/* 3. DEDICATED VISUAL LAYOUTS BASED ON ACTIVE MISSION (1, 2, or 3) */}
      <div className="relative px-5 py-3 flex-1 flex flex-col">
        {currentLevel === 1 && (
          <Mission1GroupingView
            campSide={campSide}
            sessionId={sessionId}
            isPlaying={isPlaying}
            group={group}
            groupDiscoveries={groupDiscoveries}
            guideCharacter={guideCharacter}
            onAttemptSubmitted={onAttemptSubmitted}
            onSetGuideMessage={setGuideState}
          />
        )}

        {currentLevel === 2 && (
          <Mission2DetectiveView
            campSide={campSide}
            sessionId={sessionId}
            isPlaying={isPlaying}
            group={group}
            groupDiscoveries={groupDiscoveries}
            guideCharacter={guideCharacter}
            onAttemptSubmitted={onAttemptSubmitted}
            onSetGuideMessage={setGuideState}
          />
        )}

        {currentLevel === 3 && (
          <Mission3TreasureMapView
            campSide={campSide}
            sessionId={sessionId}
            isPlaying={isPlaying}
            group={group}
            score={score}
            groupDiscoveries={groupDiscoveries}
            missionTitle={missionTitle}
            missionTargetShape={missionTargetShape}
            missionTargetCount={missionTargetCount}
            guideCharacter={guideCharacter}
            onAttemptSubmitted={onAttemptSubmitted}
            onSetGuideMessage={setGuideState}
          />
        )}
      </div>

      {/* ProveModal Pop-Up for optional external triggers */}
      {provingDiscovery && (
        <ProveModal
          isOpen={!!provingDiscovery}
          onClose={() => setProvingDiscovery(null)}
          discovery={provingDiscovery}
          sessionId={sessionId}
          groupId={group.id}
          guideCharacter={guideCharacter}
          onProvedSuccess={(newState) => {
            onAttemptSubmitted(newState);
            const updated = newState.discoveries?.find(
              (d: Discovery) => d.id === provingDiscovery.id
            );
            if (updated) {
              setProvingDiscovery(updated);
            }
          }}
        />
      )}
    </section>
  );
};
