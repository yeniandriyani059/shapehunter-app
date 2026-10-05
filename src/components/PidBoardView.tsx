import React, { useState, useEffect } from 'react';
import {
  Clock,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Map as MapIcon,
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
  const activeGroupCount = Math.min(Math.max(session.activeGroupCount || 2, 2), groups.length);
  const activeGroups = sortedGroups.slice(0, activeGroupCount);

  // Fullscreen state tracking
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false;
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    playClickSound();
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request notice:', err);
    }
  };

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

  // Strict group card isolation helper: maps cards to their specific camp
  const filterDiscoveriesForGroup = (allDiscoveries: Discovery[], grp: Group) => {
    return allDiscoveries.filter((d) => {
      // 1. Direct integer match
      if (d.groupId === grp.id) return true;
      if (typeof (d as any).kelompok_id === 'number' && (d as any).kelompok_id === grp.id) return true;
      if (String((d as any).kelompok_id) === String(grp.id)) return true;

      // 2. Team name matching (e.g. 'harimau_biru' / 'Harimau Biru' / 'Kelompok 1')
      const cardTeam = String((d as any).team || (d as any).kelompok || (d as any).groupName || '').toLowerCase().trim();
      const groupName = grp.name.toLowerCase().trim();
      if (cardTeam && (cardTeam === groupName || cardTeam.includes(groupName) || groupName.includes(cardTeam))) {
        return true;
      }
      if (cardTeam.includes('1') && grp.id === 1) return true;
      if (cardTeam.includes('2') && grp.id === 2) return true;
      if (cardTeam.includes('3') && grp.id === 3) return true;
      if (cardTeam.includes('4') && grp.id === 4) return true;

      return false;
    });
  };

  // Safe isolated attempt handler: merges group update without destroying or overwriting other groups' cards
  const handleGroupAttemptSubmitted = (newStateFromGroup: FullSessionState) => {
    // 1. Combine all discoveries, ensuring other groups' cards remain 100% intact
    const currentDiscoveriesMap: Record<number, Discovery> = {};
    (state.discoveries || []).forEach((d) => {
      if (d && typeof d.id === 'number') currentDiscoveriesMap[d.id] = d;
    });
    (newStateFromGroup.discoveries || []).forEach((d) => {
      if (d && typeof d.id === 'number') currentDiscoveriesMap[d.id] = d;
    });

    const mergedDiscoveries = Object.values(currentDiscoveriesMap);

    // 2. Merge scores: update only the submitting group's score
    const mergedScores = (state.scores || []).map((score) => {
      const updatedScore = newStateFromGroup.scores.find((s) => s.groupId === score.groupId);
      return updatedScore || score;
    });

    const mergedState: FullSessionState = {
      ...state,
      session: newStateFromGroup.session || state.session,
      discoveries: mergedDiscoveries,
      scores: mergedScores,
      attempts: [...(newStateFromGroup.attempts || []), ...(state.attempts || [])].slice(0, 100),
    };

    onStateChange(mergedState);
  };

  const activeFocusGroup =
    sortedGroups.find((g) => g.id === focusedGroupId) || sortedGroups[0];
  const activeFocusScore = scores.find((s) => s.groupId === activeFocusGroup?.id);
  const activeFocusDiscoveries = activeFocusGroup
    ? filterDiscoveriesForGroup(discoveries, activeFocusGroup)
    : [];

  // If on mobile/tablet screen, enforce Single Group View for student device optimization
  const effectiveLayoutMode = isMobileScreen ? 'focus' : layoutMode;

  return (
    <div className="relative z-10 max-w-[1560px] mx-auto px-3 sm:px-5 py-3 flex flex-col gap-3.5">
      {/* 1. ARENA PERMAINAN — CLEAN ADVENTURE GAME HUD BAR */}
      <div className="rounded-[24px] bg-slate-900/90 backdrop-blur-md border-3 border-amber-400/80 shadow-[0_6px_0_#0F172A] px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-3">
        {/* Left: Arena Permainan Title & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
              Arena Permainan
            </span>
            <span className="text-xs text-slate-300 font-bold hidden sm:inline">
              · {activeGroups.length} Kemah Bertanding
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
            <MapIcon className="w-4 h-4 text-amber-300" />
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

        {/* Right: Layout Mode Switcher & Layar Penuh (Full Screen) */}
        <div className="flex items-center gap-2">
          {/* Layar Penuh (Full Screen) Button */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className="btn-3d px-3 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-display text-xs sm:text-sm font-bold shadow-[0_3px_0_#4338CA] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={isFullscreen ? 'Keluar dari Layar Penuh' : 'Masuk ke Mode Layar Penuh (Full Screen)'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">Keluar Penuh</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-amber-300" />
                <span>Layar Penuh</span>
              </>
            )}
          </button>

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
      </div>

      {/* 2. GROUP SELECTOR TABS (WHEN IN FOCUS MODE OR OPTIONAL QUICK NAV) */}
      {effectiveLayoutMode === 'focus' && activeGroups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none px-1">
          <span className="text-xs font-display font-bold text-slate-600 uppercase tracking-wider shrink-0 mr-1">
            Pilih Kemah:
          </span>
          {activeGroups.map((grp) => {
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
      {activeGroups.length === 0 ? (
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
              groupDiscoveries={activeFocusDiscoveries}
              onAttemptSubmitted={handleGroupAttemptSubmitted}
              isFocusMode={true}
            />
          )}
        </div>
      ) : (
        /* RESPONSIVE CSS GRID: 1-2 (Split Screen), 2x2 (3-4 groups), or 3-columns (5-6+ groups) */
        <div
          className={`grid ${getGridClass(
            activeGroups.length
          )} scroll-smooth animate-fade-in ${
            activeGroups.length >= 5 ? 'max-h-[82vh] overflow-y-auto pr-1' : ''
          }`}
        >
          {activeGroups.map((grp, index) => {
            const grpScore = scores.find((s) => s.groupId === grp.id);
            const grpDiscoveries = filterDiscoveriesForGroup(discoveries, grp);
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
                onAttemptSubmitted={handleGroupAttemptSubmitted}
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
