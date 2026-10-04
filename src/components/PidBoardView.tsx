import React, { useState, useEffect } from 'react';
import {
  Clock,
  LayoutGrid,
  Maximize2,
  Map,
  Trophy,
} from 'lucide-react';
import {
  FullSessionState,
  Group,
  formatCampDisplayName,
} from '../types/game.ts';
import { PidArenaPanel } from './PidArenaPanel.tsx';
import { TeamCampBadge, XpStarsDisplay } from './GameAssets3D.tsx';
import { playClickSound } from '../utils/sound.ts';

interface PidBoardViewProps {
  state: FullSessionState;
  remainingSeconds: number;
  onStateChange: (newState: FullSessionState) => void;
  onNavigateUploader: () => void;
  onOpenMissionModal: () => void;
  onOpenLeaderboard: () => void;
}

export const PidBoardView: React.FC<PidBoardViewProps> = ({
  state,
  remainingSeconds,
  onStateChange,
  onOpenMissionModal,
  onOpenLeaderboard,
}) => {
  const { session, groups, discoveries, scores } = state;

  const sortedGroups = [...groups].sort((a, b) => a.arenaSlot - b.arenaSlot);

  // Detect whether current client is on mobile/tablet (< 1024px)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  // Track layout mode: 'grid' (Mode Semua Kelompok) or 'focus' (Mode Fokus Kelompok)
  // Auto-default to 'focus' (Single Group View) on mobile/tablet devices
  const [layoutMode, setLayoutMode] = useState<'grid' | 'focus'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024 ? 'focus' : 'grid';
  });

  // Focused Group ID for Focus / Single Group Mode
  const [focusedGroupId, setFocusedGroupId] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shape_hunter_student_group_id');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(parsed) && groups.some((g) => g.id === parsed)) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return sortedGroups[0]?.id || 1;
  });

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileScreen(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync focused group if groups change and current focusedGroupId is invalid
  useEffect(() => {
    if (!sortedGroups.some((g) => g.id === focusedGroupId) && sortedGroups.length > 0) {
      setFocusedGroupId(sortedGroups[0].id);
    }
  }, [sortedGroups, focusedGroupId]);

  const formatTimer = (sec: number) => {
    const safe = Math.max(0, sec);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isPlaying = session.status === 'playing';

  const missionTitleDisplay =
    session.currentLevel === 1
      ? 'Misi 1 — Kelompokkan!'
      : session.currentLevel === 2
      ? 'Misi 2 — Buktikan!'
      : 'Misi 3 — Kuali Ramuan Ajaib';

  // Dynamic CSS Grid class based on group count:
  // - 1 group: 1 column
  // - 2 groups: 2 columns (Split screen 50-50)
  // - 3 or 4 groups: 2x2 Grid (4 Kuadran)
  // - 5 or 6+ groups: 3 columns (2 rows) with smooth vertical scroll
  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1 max-w-4xl mx-auto';
    if (count === 2) return 'grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5'; // Split Screen 50-50
    if (count <= 4) return 'grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5'; // Grid 2x2 (4 Kuadran)
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'; // Grid 3 Kolom (2 Baris)
  };

  const activeFocusGroup =
    sortedGroups.find((g) => g.id === focusedGroupId) || sortedGroups[0];
  const activeFocusScore = scores.find((s) => s.groupId === activeFocusGroup?.id);

  // If on mobile/tablet screen, enforce Single Group View for student device optimization
  const effectiveLayoutMode = isMobileScreen ? 'focus' : layoutMode;

  return (
    <div className="relative z-10 max-w-[1560px] mx-auto px-3 sm:px-5 py-3 flex flex-col gap-3.5">
      {/* 1. DASBOR ARENA GURU (PID) — CLEAN ADVENTURE GAME HUD BAR */}
      <div className="rounded-[24px] bg-slate-900/90 backdrop-blur-md border-3 border-amber-400/80 shadow-[0_6px_0_#0F172A] px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-3">
        {/* Left: Dasbor Arena Guru Title & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
              Dasbor Arena Guru (PID)
            </span>
            <span className="text-xs text-slate-300 font-bold hidden sm:inline">
              · {sortedGroups.length} Kemah Bertanding
            </span>
          </div>
        </div>

        {/* Center: Mission Title, Map, Leaderboard, & Timer */}
        <div className="flex flex-wrap items-center gap-2 mx-auto">
          {/* Active Mission Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-400 text-slate-950 font-display font-black text-xs sm:text-sm shadow-[0_3px_0_#B45309]">
            <span>{missionTitleDisplay}</span>
          </div>

          {/* Return to Mission Map Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onOpenMissionModal();
            }}
            className="btn-3d px-3 py-1.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-display text-xs sm:text-sm font-bold shadow-[0_3px_0_#0284C7] flex items-center gap-1.5 cursor-pointer"
            title="Buka Peta Misi untuk Memilih Level Lain"
          >
            <Map className="w-4 h-4 text-amber-300" />
            <span>Peta Misi</span>
          </button>

          {/* Leaderboard & Badges Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onOpenLeaderboard();
            }}
            className="btn-3d px-3 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xs sm:text-sm font-bold shadow-[0_3px_0_#B45309] flex items-center gap-1.5 cursor-pointer"
            title="Buka Papan Skor & Lencana Kemenangan"
          >
            <Trophy className="w-4 h-4 text-slate-950" />
            <span>Papan Skor & Lencana</span>
          </button>

          {/* Adventure Timer Pill */}
          <div
            title="Waktu Petualangan Tersisa"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-800 border border-slate-700 text-amber-300 font-display font-bold text-xs sm:text-sm tabular-nums"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>
        </div>

        {/* Right: Layout Mode Switcher (Semua Kelompok Grid vs Fokus Kelompok) */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setLayoutMode('grid');
              }}
              className={`px-3 py-1.5 rounded-xl font-display text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                effectiveLayoutMode === 'grid'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Menampilkan seluruh kelompok dalam format grid 2x2 / 2x3"
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Grid Semua Kemah</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                setLayoutMode('focus');
              }}
              className={`px-3 py-1.5 rounded-xl font-display text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                effectiveLayoutMode === 'focus'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Menampilkan Tab Pilihan Kelompok di atas untuk memperbesar kelompok pilihan"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Fokus Kemah</span>
            </button>
          </div>
        </div>

      {/* 2. GROUP SELECTOR TABS (WHEN IN FOCUS MODE OR OPTIONAL QUICK NAV) */}
      {effectiveLayoutMode === 'focus' && sortedGroups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none px-1">
          <span className="text-xs font-display font-bold text-slate-600 uppercase tracking-wider shrink-0 mr-1">
            Pilih Kemah:
          </span>
          {sortedGroups.map((grp) => {
            const isSelected = grp.id === focusedGroupId;
            const sc = scores.find((s) => s.groupId === grp.id);
            const xp = sc?.xp ?? 0;
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => {
                  playClickSound();
                  setFocusedGroupId(grp.id);
                  try {
                    localStorage.setItem('shape_hunter_student_group_id', String(grp.id));
                  } catch {
                    // ignore
                  }
                }}
                className={`btn-3d px-3.5 py-2 rounded-2xl border-2 flex items-center gap-2.5 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-[0_3px_0_#B45309] scale-102'
                    : 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white shadow-xs'
                }`}
              >
                <TeamCampBadge color={grp.color} size={28} />
                <span className="font-display font-bold text-xs sm:text-sm whitespace-nowrap">
                  {formatCampDisplayName(grp.name)}
                </span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {xp} XP
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. ARENA CONTENT CONTAINER */}
      {sortedGroups.length === 0 ? (
        <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-white/95 border-4 border-amber-400 text-center">
          <p className="font-display font-bold text-slate-800">
            Belum ada kelompok yang terdaftar dalam sesi ini.
          </p>
        </div>
      ) : effectiveLayoutMode === 'focus' ? (
        /* SINGLE GROUP FOCUS MODE (Full Width & Spacious for Grade 2 Students / Touch PID) */
        <div className="w-full max-w-5xl mx-auto animate-fade-in">
          {activeFocusGroup && (
            <PidArenaPanel
              key={`arena-focus-${activeFocusGroup.id}`}
              campSide="left"
              sessionId={session.id}
              currentLevel={session.currentLevel}
              missionTitle={session.missionTitle}
              missionTargetShape={session.missionTargetShape}
              missionTargetCount={session.missionTargetCount}
              isPlaying={isPlaying}
              group={activeFocusGroup}
              score={activeFocusScore}
              groupDiscoveries={discoveries.filter(
                (d) => d.groupId === activeFocusGroup.id
              )}
              onAttemptSubmitted={onStateChange}
              isFocusMode={true}
            />
          )}
        </div>
      ) : (
        /* RESPONSIVE CSS GRID: 1-2 (Split Screen), 2x2 (3-4 groups), or 3-columns (5-6+ groups) */
        <div
          className={`grid ${getGridClass(
            sortedGroups.length
          )} scroll-smooth animate-fade-in ${
            sortedGroups.length >= 5 ? 'max-h-[82vh] overflow-y-auto pr-1' : ''
          }`}
        >
          {sortedGroups.map((grp, index) => {
            const grpScore = scores.find((s) => s.groupId === grp.id);
            const grpDiscoveries = discoveries.filter((d) => d.groupId === grp.id);
            const side = index % 2 === 0 ? 'left' : 'right';

            return (
              <PidArenaPanel
                key={`arena-grid-${grp.id}`}
                campSide={side}
                sessionId={session.id}
                currentLevel={session.currentLevel}
                missionTitle={session.missionTitle}
                missionTargetShape={session.missionTargetShape}
                missionTargetCount={session.missionTargetCount}
                isPlaying={isPlaying}
                group={grp}
                score={grpScore}
                groupDiscoveries={grpDiscoveries}
                onAttemptSubmitted={onStateChange}
                isFocusMode={false}
                onFocusGroup={() => {
                  setFocusedGroupId(grp.id);
                  setLayoutMode('focus');
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
