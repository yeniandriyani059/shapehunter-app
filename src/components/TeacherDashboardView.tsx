import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Trophy,
  Clock,
  Camera,
  Target,
  LogIn,
  LogOut,
  CheckCircle2,
  Award,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  FullSessionState,
  SHAPE_DEFINITIONS,
  SHAPE_LIST,
  ShapeType,
  GAME_ASSETS,
} from '../types/game.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { GameAssetImage, ShapeMascot3D } from './ShapeMascot3D.tsx';
import { playClickSound } from '../utils/sound.ts';
import { saveGameState, resetGameSession } from '../utils/gameStore.ts';
import {
  updateDiscoveryShapeInSupabase,
  resetKartuTemuanInSupabase,
} from '../supabaseClient.ts';

interface TeacherDashboardViewProps {
  state: FullSessionState;
  remainingSeconds: number;
  onStateChange: (newState: FullSessionState) => void;
  onSwitchToPid: () => void;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  state,
  remainingSeconds,
  onStateChange,
  onSwitchToPid,
}) => {
  const { user, idToken, signInTeacher, signOutTeacher } = useAuth();
  const { session, groups, discoveries, scores, attempts } = state;

  // New Session Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('Eksplorasi Bangun Datar Kelas 2');
  const [groupCount, setGroupCount] = useState<number>(2);
  const [groupNames, setGroupNames] = useState<string[]>([
    'Kelompok 1 · Harimau Biru',
    'Kelompok 2 · Elang Hijau',
    'Kelompok 3 · Kancil Emas',
    'Kelompok 4 · Garuda Merah',
  ]);
  const [timerMinutes, setTimerMinutes] = useState<number>(10);
  const [missionTitleInput, setMissionTitleInput] = useState(
    session.missionTitle
  );
  const [missionTargetShape, setMissionTargetShape] = useState(
    session.missionTargetShape
  );
  const [missionTargetCount, setMissionTargetCount] = useState(
    session.missionTargetCount
  );
  const [busy, setBusy] = useState(false);

  // Group Name Editing State
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [savingGroupId, setSavingGroupId] = useState<number | null>(null);

  const startEditingGroup = (groupId: number, currentName: string) => {
    playClickSound();
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  };

  const cancelEditingGroup = () => {
    playClickSound();
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleSaveGroupName = async (groupId: number) => {
    const trimmed = editingGroupName.trim();
    if (!trimmed) return;
    playClickSound();
    setSavingGroupId(groupId);
    try {
      const updatedGroups = groups.map((g) =>
        g.id === groupId ? { ...g, name: trimmed } : g
      );
      const newState: FullSessionState = {
        ...state,
        groups: updatedGroups,
      };
      saveGameState(newState);
      onStateChange(newState);
      setEditingGroupId(null);
      setEditingGroupName('');
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah nama kelompok');
    } finally {
      setSavingGroupId(null);
    }
  };

  // Discovery Shape Correction State
  const [savingDiscId, setSavingDiscId] = useState<number | null>(null);

  const handleUpdateDiscoveryShape = async (
    discoveryId: number,
    newRealShape: ShapeType
  ) => {
    playClickSound();
    setSavingDiscId(discoveryId);
    try {
      await updateDiscoveryShapeInSupabase(discoveryId, newRealShape);
      const updatedDiscoveries = discoveries.map((d) =>
        d.id === discoveryId
          ? {
              ...d,
              realShape: newRealShape,
              expectedShape: newRealShape,
            }
          : d
      );
      const newState: FullSessionState = {
        ...state,
        discoveries: updatedDiscoveries,
      };
      saveGameState(newState);
      onStateChange(newState);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah bentuk benda');
    } finally {
      setSavingDiscId(null);
    }
  };

  const handleUpdateSettings = async (updates: Record<string, any>) => {
    playClickSound();
    setBusy(true);
    try {
      const newState: FullSessionState = {
        ...state,
        session: {
          ...state.session,
          ...updates,
        },
      };
      saveGameState(newState);
      onStateChange(newState);
    } finally {
      setBusy(false);
    }
  };

  const handleResetSession = async () => {
    playClickSound();
    setBusy(true);
    try {
      await resetKartuTemuanInSupabase();
      const fresh = resetGameSession();
      onStateChange(fresh);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setBusy(true);

    const colors = ['blue', 'emerald', 'amber', 'rose'];
    const mascots = ['kapten_geo', 'putri_prisma', 'kapten_geo', 'putri_prisma'];

    const newGroups = Array.from({ length: groupCount }).map((_, idx) => ({
      id: Date.now() + idx,
      sessionId: 1,
      name: groupNames[idx]?.trim() || `Kelompok ${idx + 1}`,
      color: colors[idx % colors.length],
      mascot: mascots[idx % mascots.length],
      arenaSlot: idx + 1,
      createdAt: new Date().toISOString(),
    }));

    const newState: FullSessionState = {
      ...state,
      session: {
        ...state.session,
        title: newTitle,
        timerDurationSeconds: timerMinutes * 60,
        timerRemainingSeconds: timerMinutes * 60,
        missionTitle: missionTitleInput,
        missionTargetShape: missionTargetShape as ShapeType,
        missionTargetCount: missionTargetCount,
      },
      groups: newGroups,
      discoveries: [],
      scores: newGroups.map((g) => ({
        id: Date.now() + g.id,
        sessionId: 1,
        groupId: g.id,
        xp: 0,
        totalDiscoveries: 0,
        correctCount: 0,
        attemptCount: 0,
        bonusPoints: 0,
        accuracy: 0,
        updatedAt: new Date().toISOString(),
      })),
      attempts: [],
    };

    onStateChange(newState);
    setShowCreateForm(false);
    setBusy(false);
  };

  // Rank groups by XP + Accuracy
  const rankedGroups = groups
    .map((g) => {
      const sc = scores.find((s) => s.groupId === g.id);
      return {
        group: g,
        xp: sc?.xp ?? 0,
        accuracy: sc?.accuracy ?? 0,
        correctCount: sc?.correctCount ?? 0,
        attemptCount: sc?.attemptCount ?? 0,
        totalDiscoveries: sc?.totalDiscoveries ?? 0,
        bonusPoints: sc?.bonusPoints ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      return b.accuracy - a.accuracy;
    });

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Top Teacher Control Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
            <GameAssetImage
              src={GAME_ASSETS.kaptenGeo}
              alt="Dashboard Guru"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>DASHBOARD GURU</span>
              <span aria-hidden="true">·</span>
              <span>Kode Sesi Aktif:</span>
              <strong className="font-mono text-sm text-slate-900">
                {session.code}
              </strong>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {session.title}
            </h1>
          </div>
        </div>

        {/* Teacher Auth & Session Creation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2 text-xs text-slate-600 mr-2">
              <span>Guru: {user.displayName || user.email}</span>
              <button
                type="button"
                onClick={signOutTeacher}
                className="text-rose-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signInTeacher}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4 text-sky-600" />
              <span>Login Google Guru</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Sesi Permainan Baru</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToPid}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
          >
            Buka Arena PID Kelas
          </button>
        </div>
      </div>

      {/* Create New Session Drawer */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSession}
          className="rounded-2xl bg-amber-50/70 border border-amber-300 p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Buat Sesi Permainan Baru & Atur Kelompok
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs font-semibold text-slate-600 underline"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Sesi Pembelajaran
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Kelompok (2 s/d 4 Kelompok)
              </label>
              <select
                value={groupCount}
                onChange={(e) => setGroupCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-semibold"
              >
                <option value={2}>2 Kelompok (Split Screen Kiri & Kanan)</option>
                <option value={3}>3 Kelompok</option>
                <option value={4}>4 Kelompok</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Durasi Timer (Menit)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono"
              />
            </div>
          </div>

          {/* Group Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: groupCount }).map((_, idx) => (
              <div key={idx}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Kelompok {idx + 1}
                </label>
                <input
                  type="text"
                  required
                  value={groupNames[idx] || ''}
                  onChange={(e) => {
                    const next = [...groupNames];
                    next[idx] = e.target.value;
                    setGroupNames(next);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              Simpan & Mulai Sesi Baru
            </button>
          </div>
        </form>
      )}

      {/* Control Grid: Game Controls + Mission Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Live Session Controls (Start, Pause, Reset, Timer, Level) */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Kontrol Permainan & Timer Kelas</span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleUpdateSettings({
                  status: session.status === 'playing' ? 'paused' : 'playing',
                  timerRemainingSeconds: remainingSeconds,
                })
              }
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                session.status === 'playing'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {session.status === 'playing' ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Permainan</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Mulai Permainan</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleResetSession}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Skor & Kunci Bentuk</span>
            </button>

            <div className="flex items-center gap-1.5 ml-auto">
              {[300, 600, 900].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({
                      timerDurationSeconds: sec,
                      timerRemainingSeconds: sec,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono font-semibold text-slate-700"
                >
                  {sec / 60}m
                </button>
              ))}
            </div>
          </div>

          {/* Level Selector */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">
              Pilih Level Tantangan Aktif di PID:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  lvl: 1,
                  title: 'Level 1: Sort It!',
                  desc: 'Drag foto ke bangun datar',
                },
                {
                  lvl: 2,
                  title: 'Level 2: Prove It!',
                  desc: 'Tandai sudut/sisi & alasan bentuk',
                },
                {
                  lvl: 3,
                  title: 'Level 3: Mission!',
                  desc: 'Misi perburuan benda khusus guru',
                },
              ].map((item) => (
                <button
                  key={item.lvl}
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({ currentLevel: item.lvl })
                  }
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    session.currentLevel === item.lvl
                      ? 'border-sky-600 bg-sky-50/90 text-sky-950'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{item.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Level 3 Shape Hunter Mission Setter */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" />
            <span>Pengaturan Misi Level 3 (Shape Hunter Mission)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Instruksi Misi Guru untuk Siswa
              </label>
              <input
                type="text"
                value={missionTitleInput}
                onChange={(e) => setMissionTitleInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Bentuk Fokus
              </label>
              <select
                value={missionTargetShape}
                onChange={(e) => setMissionTargetShape(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="all">Semua Bangun Datar</option>
                <option value="lingkaran">Fokus: Lingkaran</option>
                <option value="segitiga">Fokus: Segitiga</option>
                <option value="persegi">Fokus: Persegi</option>
                <option value="persegi_panjang">Fokus: Persegi Panjang</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Target Jumlah Benda Terkunci:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={missionTargetCount}
                onChange={(e) => setMissionTargetCount(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-center"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                handleUpdateSettings({
                  missionTitle: missionTitleInput,
                  missionTargetShape,
                  missionTargetCount,
                  currentLevel: 3,
                })
              }
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Aktifkan Misi ke Papan PID
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard & Assessment Table (Accuracy + XP) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Hasil & Akurasi Kelompok (Realtime)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Skor utama berasal dari ketepatan pengelompokan (+10 XP), alasan/ciri bentuk (+Bonus), dan eksplorasi (+2 XP).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                <th className="py-2.5 px-3">Peringkat</th>
                <th className="py-2.5 px-3">Nama Kelompok</th>
                <th className="py-2.5 px-3 text-right">Total Temuan Foto</th>
                <th className="py-2.5 px-3 text-right">Jawaban Benar</th>
                <th className="py-2.5 px-3 text-right">Akurasi</th>
                <th className="py-2.5 px-3 text-right">Bonus Ciri & Eksplorasi</th>
                <th className="py-2.5 px-3 text-right">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-sm font-mono tabular-nums">
              {rankedGroups.map((row, idx) => (
                <tr key={row.group.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-bold text-slate-800">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-3 font-sans font-bold text-slate-900">
                    {editingGroupId === row.group.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveGroupName(row.group.id);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          required
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="px-2.5 py-1 text-xs sm:text-sm font-bold rounded-lg border-2 border-sky-400 bg-white text-slate-900 focus:outline-hidden min-w-[180px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEditingGroup();
                          }}
                        />
                        <button
                          type="submit"
                          disabled={savingGroupId === row.group.id}
                          title="Simpan"
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Simpan</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingGroup}
                          title="Batal"
                          className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Batal</span>
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{row.group.name}</span>
                        <button
                          type="button"
                          title="Ubah Nama Kelompok"
                          onClick={() =>
                            startEditingGroup(row.group.id, row.group.name)
                          }
                          className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {row.totalDiscoveries}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                    {row.correctCount} / {row.attemptCount}
                  </td>
                  <td className="py-3 px-3 text-right font-bold">
                    {row.accuracy}%
                  </td>
                  <td className="py-3 px-3 text-right text-amber-700">
                    +{row.bonusPoints} XP
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-sky-700 text-base">
                    {row.xp} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-Time Incoming Student Photos Feed */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-600" />
            <span>
              Galeri Foto Masuk Realtime ({discoveries.length} Temuan Siswa)
            </span>
          </h2>
          <span className="text-xs text-slate-500">
            Menampilkan seluruh foto yang dikirim dari HP siswa beserta status pengelompokan
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {discoveries.map((disc) => {
            const grp = groups.find((g) => g.id === disc.groupId);
            const shapeDef =
              SHAPE_DEFINITIONS[disc.expectedShape as ShapeType] ||
              SHAPE_DEFINITIONS.lingkaran;
            return (
              <div
                key={disc.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-200 mb-2">
                    <GameAssetImage
                      src={disc.photoUrl}
                      alt={disc.objectName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {disc.objectName}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {grp?.name} · {disc.studentName}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {shapeDef.name}
                  </span>
                  <span
                    className={`font-bold ${
                      disc.isLocked ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {disc.isLocked ? '✓ Terkunci' : 'Antrean'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
