import React, { useEffect } from 'react';
import {
  Trophy,
  X,
  Award,
  CheckCircle2,
  Target,
  Sparkles,
  Compass,
  Search,
  Shield,
  Star,
} from 'lucide-react';
import {
  FullSessionState,
  Group,
  GroupScore,
  Discovery,
  formatCampDisplayName,
  ShapeType,
} from '../types/game.ts';
import { TeamCampBadge, XpStarsDisplay } from './GameAssets3D.tsx';
import { playClickSound } from '../utils/sound.ts';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FullSessionState;
}

interface AchievementBadge {
  id: string;
  name: string;
  desc: string;
  isUnlocked: boolean;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { session, groups, scores, discoveries } = state;
  const activeGroupCount = Math.min(Math.max(session.activeGroupCount || 2, 2), groups.length);
  const activeGroups = groups.slice(0, activeGroupCount);

  // Calculate badges for a group
  const getGroupBadges = (group: Group, score?: GroupScore): AchievementBadge[] => {
    const groupDisc = discoveries.filter((d) => d.groupId === group.id);
    const lockedCount = groupDisc.filter((d) => d.isLocked || d.classifiedShape).length;
    const provenCount = groupDisc.filter((d) => d.traitsVerified || d.isProven).length;
    const verifiedFull = groupDisc.filter(
      (d) => (d.traitsVerified || d.isProven) && (d.isLocked || d.classifiedShape)
    ).length;
    const accuracy = score?.accuracy ?? 0;
    const attempts = score?.attemptCount ?? 0;

    // Unique shape types found
    const shapeSet = new Set<string>();
    groupDisc.forEach((d) => {
      const s = d.realShape || d.classifiedShape || d.expectedShape;
      if (s) shapeSet.add(s);
    });

    return [
      {
        id: 'explorer',
        name: 'Penjelajah Bentuk',
        desc: 'Potret minimal 1 benda nyata',
        isUnlocked: groupDisc.length >= 1,
        icon: Compass,
        colorClass: 'bg-sky-100 text-sky-800 border-sky-300',
      },
      {
        id: 'grouper',
        name: 'Pengelompok Andal',
        desc: 'Minimal 2 benda lolos Misi 1',
        isUnlocked: lockedCount >= 2,
        icon: Target,
        colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      },
      {
        id: 'detective',
        name: 'Detektif Cermat',
        desc: 'Minimal 2 benda terbukti sisi & sudut',
        isUnlocked: provenCount >= 2,
        icon: Search,
        colorClass: 'bg-amber-100 text-amber-900 border-amber-300',
      },
      {
        id: 'accuracy',
        name: 'Pakar Ketepatan',
        desc: 'Ketepatan di atas 80%',
        isUnlocked: accuracy >= 80 && attempts >= 2,
        icon: CheckCircle2,
        colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      },
      {
        id: 'master',
        name: 'Kolektor 3 Bentuk',
        desc: 'Temukan minimal 3 bangun datar berbeda',
        isUnlocked: shapeSet.size >= 3,
        icon: Award,
        colorClass: 'bg-purple-100 text-purple-800 border-purple-300',
      },
      {
        id: 'champion',
        name: 'Juara Ekspedisi',
        desc: 'Lolos validasi 8 benda penuh',
        isUnlocked: verifiedFull >= 8,
        icon: Trophy,
        colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
      },
    ];
  };

  // Sort groups by XP (desc), then accuracy (desc), then correct count (desc)
  const sortedGroups = [...activeGroups].sort((a, b) => {
    const scoreA = scores.find((s) => s.groupId === a.id);
    const scoreB = scores.find((s) => s.groupId === b.id);
    const xpA = scoreA?.xp ?? 0;
    const xpB = scoreB?.xp ?? 0;
    if (xpB !== xpA) return xpB - xpA;

    const accA = scoreA?.accuracy ?? 0;
    const accB = scoreB?.accuracy ?? 0;
    if (accB !== accA) return accB - accA;

    const corA = scoreA?.correctCount ?? 0;
    const corB = scoreB?.correctCount ?? 0;
    return corB - corA;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white border-4 border-amber-400 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 border-b-2 border-amber-500 flex items-center justify-between text-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-300 flex items-center justify-center text-lg shadow-xs shrink-0">
              <Trophy className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <h2 className="font-display font-black text-lg sm:text-xl text-slate-950">
                Papan Skor Kemenangan Kemah
              </h2>
              <p className="text-xs font-semibold text-amber-950">
                Peringkat klasemen juara dan lencana pencapaian kelompok
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="p-2 rounded-2xl bg-white/80 hover:bg-white text-slate-800 border border-amber-500 transition-colors cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Leaderboard Cards */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          {sortedGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-semibold">
              Belum ada data kelompok yang aktif.
            </div>
          ) : (
            sortedGroups.map((grp, index) => {
              const rank = index + 1;
              const sc = scores.find((s) => s.groupId === grp.id);
              const xp = sc?.xp ?? 0;
              const accuracy = sc?.accuracy ?? 0;
              const correct = sc?.correctCount ?? 0;
              const groupDisc = discoveries.filter((d) => d.groupId === grp.id);
              const verifiedCount = groupDisc.filter(
                (d) => (d.traitsVerified || d.isProven) && (d.isLocked || d.classifiedShape)
              ).length;
              const badges = getGroupBadges(grp, sc);
              const unlockedBadges = badges.filter((b) => b.isUnlocked);

              // Distinct ranking cards: Gold (1), Silver (2), Bronze (3), Neutral (4+)
              const rankTheme =
                rank === 1
                  ? {
                      containerClass:
                        'border-amber-400 bg-gradient-to-r from-amber-50/95 via-amber-100/40 to-white shadow-[0_6px_0_#F59E0B] ring-2 ring-amber-300/60',
                      badgeLabel: 'JUARA 1',
                      badgeBg: 'bg-amber-400 text-slate-950 border-amber-500',
                      rankNumBg: 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 shadow-sm border border-amber-300',
                    }
                  : rank === 2
                  ? {
                      containerClass:
                        'border-slate-300 bg-gradient-to-r from-slate-50 via-slate-100/50 to-white shadow-[0_6px_0_#CBD5E1]',
                      badgeLabel: 'JUARA 2',
                      badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
                      rankNumBg: 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900 shadow-sm border border-slate-300',
                    }
                  : rank === 3
                  ? {
                      containerClass:
                        'border-orange-300 bg-gradient-to-r from-orange-50/90 via-orange-100/40 to-white shadow-[0_6px_0_#FDBA74]',
                      badgeLabel: 'JUARA 3',
                      badgeBg: 'bg-orange-200 text-orange-950 border-orange-300',
                      rankNumBg: 'bg-gradient-to-b from-orange-300 to-orange-400 text-orange-950 shadow-sm border border-orange-300',
                    }
                  : {
                      containerClass:
                        'border-slate-200 bg-white shadow-[0_4px_0_#E2E8F0]',
                      badgeLabel: `PERINGKAT ${rank}`,
                      badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
                      rankNumBg: 'bg-slate-100 text-slate-600 border border-slate-200',
                    };

              return (
                <div
                  key={grp.id}
                  className={`rounded-3xl border-3 p-4 sm:p-5 flex flex-col gap-3 transition-transform ${rankTheme.containerClass}`}
                >
                  {/* Top Row: Rank Number, Mascot Emblem, Group Name & Score */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Number Circle */}
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display font-black text-lg shrink-0 ${rankTheme.rankNumBg}`}
                      >
                        {rank}
                      </div>

                      {/* Camp Emblem */}
                      <TeamCampBadge color={grp.color} size={44} />

                      {/* Camp Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-black text-base sm:text-lg text-slate-900 truncate">
                            {formatCampDisplayName(grp.name)}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-lg font-display text-[10px] font-bold border ${rankTheme.badgeBg}`}
                          >
                            {rankTheme.badgeLabel}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">
                          {correct} Bentuk Terbuka · {verifiedCount}/8 Lolos Penuh
                        </div>
                      </div>
                    </div>

                    {/* Right Stats: XP & Ketepatan */}
                    <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                      <div className="text-right">
                        <div className="font-display font-black text-lg sm:text-xl text-amber-600 tabular-nums">
                          {xp} XP
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                          Ketepatan: {accuracy}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Lencana Pencapaian Kelompok */}
                  <div className="pt-2.5 border-t border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Lencana Pencapaian:</span>
                      <span className="text-slate-500 font-semibold normal-case">
                        {unlockedBadges.length} dari {badges.length} Terbuka
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {badges.map((b) => {
                        const Icon = b.icon;
                        if (!b.isUnlocked) {
                          return (
                            <div
                              key={b.id}
                              title={`${b.name}: ${b.desc} (Belum diraih)`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 text-slate-400 border border-slate-200 text-xs font-semibold grayscale opacity-60"
                            >
                              <Icon className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[120px]">{b.name}</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={b.id}
                            title={`${b.name}: ${b.desc}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold shadow-2xs ${b.colorClass} animate-pop-in`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[140px]">{b.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t-2 border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 shrink-0">
          <span>Poin dan lencana diperbarui secara langsung saat permainan berlangsung.</span>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="btn-3d px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-display font-bold text-xs shadow-[0_2px_0_#1E293B] cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
