import {
  FullSessionState,
  GameSession,
  Group,
  Discovery,
  GroupScore,
  GameAttempt,
  ShapeType,
  MISSION_LEVELS,
} from '../types/game.ts';
import {
  supabase,
  isSupabaseConfigured,
  uploadPhotoToSupabaseBucket,
  syncKartuTemuanToSupabase,
  fetchKartuTemuanFromSupabase,
} from '../supabaseClient.ts';

const STORAGE_KEY = 'shape_hunter_client_game_state_v2';

export const INITIAL_GROUPS: Group[] = [
  {
    id: 1,
    sessionId: 1,
    name: 'Kelompok 1 · Harimau Biru',
    color: 'blue',
    mascot: 'harimau',
    arenaSlot: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    sessionId: 1,
    name: 'Kelompok 2 · Elang Merah',
    color: 'rose',
    mascot: 'elang',
    arenaSlot: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    sessionId: 1,
    name: 'Kelompok 3 · Gajah Kuning',
    color: 'amber',
    mascot: 'gajah',
    arenaSlot: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    sessionId: 1,
    name: 'Kelompok 4 · Lumba-lumba Hijau',
    color: 'emerald',
    mascot: 'lumbalumba',
    arenaSlot: 4,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_DISCOVERIES: Discovery[] = [];

export function getDefaultGameState(): FullSessionState {
  const session: GameSession = {
    id: 1,
    code: 'SDN06',
    title: 'Shape Hunter SDN Karanggintung 06',
    teacherUid: 'teacher-yennia',
    status: 'playing',
    currentLevel: 1,
    timerDurationSeconds: 600,
    timerRemainingSeconds: 600,
    missionTitle: 'Misi 1 — Kelompokkan Bentuk!',
    missionTargetShape: 'lingkaran',
    missionTargetCount: 5,
    createdAt: new Date().toISOString(),
  };

  const scores: GroupScore[] = INITIAL_GROUPS.map((g) => ({
    id: g.id,
    sessionId: 1,
    groupId: g.id,
    xp: 0,
    totalDiscoveries: 0,
    correctCount: 0,
    attemptCount: 0,
    bonusPoints: 0,
    accuracy: 0,
    updatedAt: new Date().toISOString(),
  }));

  return {
    session,
    groups: INITIAL_GROUPS,
    discoveries: INITIAL_DISCOVERIES,
    scores,
    attempts: [],
  };
}

export function loadSavedGameState(): FullSessionState {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.session && parsed.groups && parsed.discoveries) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Could not read saved game state:', err);
    }
  }
  return getDefaultGameState();
}

export function saveGameState(state: FullSessionState): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Could not save game state to localStorage:', err);
    }
  }

  // Asynchronously sync with Supabase if configured
  if (isSupabaseConfigured) {
    // 1. Sync full game session
    supabase
      .from('game_sessions')
      .upsert({
        id: state.session.id || 1,
        code: state.session.code || 'SDN06',
        state_data: state,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) {
          console.warn('Supabase sync notice:', error.message);
        }
      })
      .catch((err) => {
        console.warn('Supabase sync exception:', err);
      });

    // 2. Sync all discoveries to public.kartu_temuan table
    if (Array.isArray(state.discoveries)) {
      state.discoveries.forEach((d) => {
        syncKartuTemuanToSupabase(d);
      });
    }
  }
}

/**
 * Adds a new discovery photographed by a student
 */
export function addDiscoveryToState(
  currentState: FullSessionState,
  params: {
    groupId: number;
    studentName: string;
    objectName: string;
    photoUrl: string;
    expectedShape: ShapeType;
    realShape: ShapeType;
    studentClaimedShape?: ShapeType;
  }
): { newState: FullSessionState; newDiscovery: Discovery } {
  const newId = Date.now() + Math.floor(Math.random() * 1000);
  const newDiscovery: Discovery = {
    id: newId,
    sessionId: currentState.session.id,
    groupId: params.groupId,
    studentName: params.studentName || 'Petualang Cilik',
    objectName: params.objectName || 'Benda Temuan',
    photoUrl: params.photoUrl,
    realShape: params.realShape,
    expectedShape: params.expectedShape,
    studentClaimedShape: params.studentClaimedShape || params.expectedShape,
    classifiedShape: null,
    isLocked: false,
    annotationsJson: '[]',
    traitsVerified: false,
    isProven: false,
    createdAt: new Date().toISOString(),
  };

  const updatedDiscoveries = [newDiscovery, ...currentState.discoveries];

  // Update totalDiscoveries in score
  const updatedScores = currentState.scores.map((score) => {
    if (score.groupId === params.groupId) {
      return {
        ...score,
        totalDiscoveries: score.totalDiscoveries + 1,
        updatedAt: new Date().toISOString(),
      };
    }
    return score;
  });

  const newState: FullSessionState = {
    ...currentState,
    discoveries: updatedDiscoveries,
    scores: updatedScores,
  };

  saveGameState(newState);
  syncKartuTemuanToSupabase(newDiscovery);

  return { newState, newDiscovery };
}

/**
 * Async version of addDiscoveryToState that uploads photo to Supabase Storage bucket "foto_temuan" first
 */
export async function addDiscoveryToStateAsync(
  currentState: FullSessionState,
  params: {
    groupId: number;
    studentName: string;
    objectName: string;
    photoUrl: string;
    expectedShape: ShapeType;
    realShape: ShapeType;
    studentClaimedShape?: ShapeType;
  }
): Promise<{ newState: FullSessionState; newDiscovery: Discovery }> {
  // Try uploading image to "foto_temuan" storage bucket if it's base64
  const cdnPhotoUrl = await uploadPhotoToSupabaseBucket(params.photoUrl);

  return addDiscoveryToState(currentState, {
    ...params,
    photoUrl: cdnPhotoUrl,
  });
}

/**
 * Evaluates a shape placement attempt (Drag & Drop to shape island)
 */
export function evaluateShapeAttempt(
  currentState: FullSessionState,
  params: {
    groupId: number;
    discoveryId: number;
    selectedShape: ShapeType;
  }
): {
  newState: FullSessionState;
  isCorrect: boolean;
  pointsAwarded: number;
  message: string;
} {
  const discovery = currentState.discoveries.find((d) => d.id === params.discoveryId);
  if (!discovery) {
    return {
      newState: currentState,
      isCorrect: false,
      pointsAwarded: 0,
      message: 'Kartu tidak ditemukan',
    };
  }

  const expected = (discovery.realShape || discovery.expectedShape).toLowerCase();
  const selected = params.selectedShape.toLowerCase();
  const isCorrect = expected === selected;

  const pointsAwarded = isCorrect ? 10 : -5;


  // Record attempt
  const newAttempt: GameAttempt = {
    id: Date.now() + Math.floor(Math.random() * 500),
    sessionId: currentState.session.id,
    groupId: params.groupId,
    discoveryId: params.discoveryId,
    selectedShape: params.selectedShape,
    isCorrect,
    levelAtAttempt: currentState.session.currentLevel,
    pointsAwarded,
    bonusAwarded: 0,
    reasonText: isCorrect
      ? 'Bentuk cocok dengan ciri bangun datar!'
      : 'Bentuk belum cocok dengan ciri bangun datar.',
    createdAt: new Date().toISOString(),
  };

  // Update discovery
  const updatedDiscoveries = currentState.discoveries.map((d) => {
    if (d.id === params.discoveryId) {
      return {
        ...d,
        classifiedShape: isCorrect ? params.selectedShape : d.classifiedShape,
        isLocked: isCorrect ? true : d.isLocked,
        isProven: isCorrect ? true : d.isProven,
      };
    }
    return d;
  });

  // Update group score
  const updatedScores = currentState.scores.map((score) => {
    if (score.groupId === params.groupId) {
      const newAttempts = score.attemptCount + 1;
      const newCorrect = score.correctCount + (isCorrect ? 1 : 0);
      const pointsAwarded = isCorrect ? 10 : -5;
      const newXp = Math.max(0, score.xp + pointsAwarded);
      const newAccuracy = Math.round((newCorrect / newAttempts) * 100);

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

  const newState: FullSessionState = {
    ...currentState,
    discoveries: updatedDiscoveries,
    scores: updatedScores,
    attempts: [newAttempt, ...currentState.attempts],
  };

  saveGameState(newState);

  const message = isCorrect
    ? `🎉 Hebat! "${discovery.objectName}" cocok dengan ${params.selectedShape.toUpperCase()} (+10 XP)`
    : `Ups, "${discovery.objectName}" bukan ${params.selectedShape.toUpperCase()}. Coba amati lagi ya!`;

  return {
    newState,
    isCorrect,
    pointsAwarded,
    message,
  };
}

/**
 * Proves geometric traits (corners & sides) in Mission 2
 */
export function proveDiscoveryTraitsInState(
  currentState: FullSessionState,
  params: {
    discoveryId: number;
    markers: Array<{ x: number; y: number; type: 'sudut' | 'sisi' }>;
  }
): FullSessionState {
  const discovery = currentState.discoveries.find((d) => d.id === params.discoveryId);
  if (!discovery) return currentState;

  const bonusPoints = 5;

  const updatedDiscoveries = currentState.discoveries.map((d) => {
    if (d.id === params.discoveryId) {
      return {
        ...d,
        traitsVerified: true,
        isProven: true,
        annotationsJson: JSON.stringify(params.markers),
      };
    }
    return d;
  });

  const updatedScores = currentState.scores.map((score) => {
    if (score.groupId === discovery.groupId) {
      return {
        ...score,
        xp: score.xp + bonusPoints,
        bonusPoints: score.bonusPoints + bonusPoints,
        updatedAt: new Date().toISOString(),
      };
    }
    return score;
  });

  const newState: FullSessionState = {
    ...currentState,
    discoveries: updatedDiscoveries,
    scores: updatedScores,
  };

  saveGameState(newState);
  return newState;
}

/**
 * Updates active mission level (1, 2, or 3)
 */
export function updateMissionLevel(
  currentState: FullSessionState,
  level: number
): FullSessionState {
  const levelInfo = MISSION_LEVELS[level] || MISSION_LEVELS[1];
  const newState: FullSessionState = {
    ...currentState,
    session: {
      ...currentState.session,
      currentLevel: level,
      missionTitle: levelInfo.title,
    },
  };
  saveGameState(newState);
  return newState;
}

/**
 * Resets session back to clean starter state
 */
export function resetGameSession(): FullSessionState {
  const fresh = getDefaultGameState();
  saveGameState(fresh);
  return fresh;
}

/**
 * Pure 1:1 synchronization with records fetched from Supabase "public.kartu_temuan"
 */
export function mergeSupabaseDiscoveriesToState(
  currentState: FullSessionState,
  supabaseItems: Array<{
    id: number;
    photoUrl: string;
    objectName: string;
    realShape: string;
    groupId: number;
    isProven: boolean;
  }>
): FullSessionState {
  if (!Array.isArray(supabaseItems)) {
    return currentState;
  }

  // Pure 1:1 mapping from Supabase public.kartu_temuan table
  const freshDiscoveries: Discovery[] = supabaseItems.map((remoteItem) => {
    const existing = currentState.discoveries.find((d) => d.id === remoteItem.id);
    const assignedShape = (remoteItem.realShape as ShapeType) || 'lingkaran';
    const isProven = Boolean(remoteItem.isProven);

    return {
      id: remoteItem.id,
      sessionId: currentState.session.id,
      groupId: remoteItem.groupId || 1,
      studentName: existing?.studentName || 'Petualang Cilik',
      objectName: remoteItem.objectName || 'Benda Temuan',
      photoUrl: remoteItem.photoUrl,
      realShape: assignedShape,
      expectedShape: assignedShape,
      studentClaimedShape: assignedShape,
      classifiedShape: existing?.classifiedShape ?? (isProven ? assignedShape : null),
      isLocked: existing?.isLocked ?? isProven,
      annotationsJson: existing?.annotationsJson ?? '[]',
      traitsVerified: isProven,
      isProven: isProven,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
  });

  // Recalculate totalDiscoveries per group based on fresh Supabase discoveries
  const updatedScores = currentState.scores.map((score) => {
    const groupCardCount = freshDiscoveries.filter((d) => d.groupId === score.groupId).length;
    return {
      ...score,
      totalDiscoveries: groupCardCount,
      updatedAt: new Date().toISOString(),
    };
  });

  const newState: FullSessionState = {
    ...currentState,
    discoveries: freshDiscoveries,
    scores: updatedScores,
  };

  saveGameState(newState);
  return newState;
}
