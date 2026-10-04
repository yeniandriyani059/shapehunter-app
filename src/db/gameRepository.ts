import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  gameSessions,
  groups,
  discoveries,
  gameAttempts,
  scores,
} from './schema.ts';

export type ShapeType = 'lingkaran' | 'segitiga' | 'persegi' | 'persegi_panjang';

export interface CreateSessionInput {
  title: string;
  teacherUid?: string;
  timerDurationSeconds?: number;
  currentLevel?: number;
  missionTitle?: string;
  missionTargetShape?: string;
  missionTargetCount?: number;
  groupsConfig: Array<{
    name: string;
    color: string;
    mascot: string;
    arenaSlot: number;
  }>;
}

export interface CreateDiscoveryInput {
  sessionId: number;
  groupId: number;
  studentName: string;
  objectName: string;
  photoUrl: string;
  expectedShape?: ShapeType;
  realShape?: ShapeType;
  studentClaimedShape?: ShapeType;
}

export interface SubmitAttemptInput {
  sessionId: number;
  groupId: number;
  discoveryId: number;
  selectedShape: ShapeType;
  levelAtAttempt: number;
  annotationsJson?: string;
  traitsVerified?: boolean;
  reasonText?: string;
}

function generateClassroomSvgDataUrl(
  bgHex: string,
  accentHex: string,
  shape: ShapeType,
  label: string
): string {
  let shapeMarkup = '';
  if (shape === 'lingkaran') {
    shapeMarkup = `
      <circle cx="200" cy="145" r="76" fill="${accentHex}" stroke="#ffffff" stroke-width="8"/>
      <circle cx="200" cy="145" r="62" fill="#ffffff" opacity="0.92"/>
      <circle cx="200" cy="145" r="6" fill="#1e293b"/>
      <line x1="200" y1="145" x2="200" y2="102" stroke="#1e293b" stroke-width="6" stroke-linecap="round"/>
      <line x1="200" y1="145" x2="232" y2="145" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
    `;
  } else if (shape === 'segitiga') {
    shapeMarkup = `
      <polygon points="200,62 286,216 114,216" fill="${accentHex}" stroke="#ffffff" stroke-width="8" stroke-linejoin="round"/>
      <polygon points="200,92 258,198 142,198" fill="#ffffff" opacity="0.35"/>
    `;
  } else if (shape === 'persegi') {
    shapeMarkup = `
      <rect x="122" y="68" width="156" height="156" rx="12" fill="${accentHex}" stroke="#ffffff" stroke-width="8"/>
      <rect x="144" y="90" width="112" height="112" rx="6" fill="#ffffff" opacity="0.3"/>
    `;
  } else {
    shapeMarkup = `
      <rect x="86" y="84" width="228" height="126" rx="12" fill="${accentHex}" stroke="#ffffff" stroke-width="8"/>
      <rect x="106" y="102" width="188" height="90" rx="6" fill="#ffffff" opacity="0.28"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${bgHex}"/>
    <circle cx="50" cy="50" r="90" fill="#ffffff" opacity="0.12"/>
    <circle cx="360" cy="260" r="110" fill="#ffffff" opacity="0.12"/>
    ${shapeMarkup}
    <rect x="40" y="242" width="320" height="38" rx="19" fill="#0f172a" opacity="0.78"/>
    <text x="200" y="266" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function ensureDefaultSession() {
  try {
    const existing = await db
      .select()
      .from(gameSessions)
      .orderBy(desc(gameSessions.createdAt));

    if (existing.length > 0) {
      return getFullSessionState(existing[0].id);
    }

    const [session] = await db
      .insert(gameSessions)
      .values({
        code: 'SD2GEO',
        title: 'Ekspedisi Bangun Datar Kelas 2 SD',
        status: 'playing',
        currentLevel: 1,
        timerDurationSeconds: 600,
        timerRemainingSeconds: 600,
        missionTitle: 'Cari benda berbentuk Lingkaran, Segitiga, Persegi, dan Persegi Panjang di sekitar kelas!',
        missionTargetShape: 'all',
        missionTargetCount: 4,
      })
      .returning();

    const defaultGroups = [
      { name: 'Kelompok 1 · Harimau Biru', color: 'blue', mascot: 'kapten_geo', arenaSlot: 1 },
      { name: 'Kelompok 2 · Elang Hijau', color: 'emerald', mascot: 'putri_prisma', arenaSlot: 2 },
      { name: 'Kelompok 3 · Кancil Emas', color: 'amber', mascot: 'kapten_geo', arenaSlot: 3 },
      { name: 'Kelompok 4 · Garuda Merah', color: 'rose', mascot: 'putri_prisma', arenaSlot: 4 },
    ];

    const insertedGroups = [];
    for (const g of defaultGroups) {
      const [createdGroup] = await db
        .insert(groups)
        .values({
          sessionId: session.id,
          name: g.name,
          color: g.color,
          mascot: g.mascot,
          arenaSlot: g.arenaSlot,
        })
        .returning();
      insertedGroups.push(createdGroup);

      await db.insert(scores).values({
        sessionId: session.id,
        groupId: createdGroup.id,
        xp: 0,
        totalDiscoveries: 0,
        correctCount: 0,
        attemptCount: 0,
        bonusPoints: 0,
        accuracy: 0,
      });
    }

    // Seed initial real-world schoolyard discoveries for Group 1 and Group 2 so PID is immediately playable
    if (insertedGroups.length >= 2) {
      const g1 = insertedGroups[0];
      const g2 = insertedGroups[1];

      const starterDiscoveries = [
        {
          groupId: g1.id,
          studentName: 'Budi & Siti',
          objectName: 'Jam Dinding Kelas 2A',
          expectedShape: 'lingkaran' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#dbeafe', '#2563eb', 'lingkaran', 'Jam Dinding Kelas 2A'),
        },
        {
          groupId: g1.id,
          studentName: 'Raka',
          objectName: 'Penggaris Segitiga Kayu',
          expectedShape: 'segitiga' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#fef3c7', '#d97706', 'segitiga', 'Penggaris Segitiga Kayu'),
        },
        {
          groupId: g1.id,
          studentName: 'Nadia',
          objectName: 'Ubin Keramik Lantai',
          expectedShape: 'persegi' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#dcfce7', '#16a34a', 'persegi', 'Ubin Keramik Lantai'),
        },
        {
          groupId: g1.id,
          studentName: 'Dimas',
          objectName: 'Papan Tulis Putih',
          expectedShape: 'persegi_panjang' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#ffe4e6', '#e11d48', 'persegi_panjang', 'Papan Tulis Putih'),
        },
        {
          groupId: g2.id,
          studentName: 'Putri & Edo',
          objectName: 'Roda Sepeda Sekolah',
          expectedShape: 'lingkaran' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#d1fae5', '#059669', 'lingkaran', 'Roda Sepeda Sekolah'),
        },
        {
          groupId: g2.id,
          studentName: 'Lani',
          objectName: 'Atap Rumah Burung Taman',
          expectedShape: 'segitiga' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#fef3c7', '#ea580c', 'segitiga', 'Atap Rumah Burung Taman'),
        },
        {
          groupId: g2.id,
          studentName: 'Beni',
          objectName: 'Jendela Kotak Perpustakaan',
          expectedShape: 'persegi' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#e0e7ff', '#4f46e5', 'persegi', 'Jendela Kotak Perpustakaan'),
        },
        {
          groupId: g2.id,
          studentName: 'Dayu',
          objectName: 'Buku Gambar Matematika',
          expectedShape: 'persegi_panjang' as ShapeType,
          photoUrl: generateClassroomSvgDataUrl('#fce7f3', '#db2777', 'persegi_panjang', 'Buku Gambar Matematika'),
        },
      ];

      for (const item of starterDiscoveries) {
        await createDiscovery({
          sessionId: session.id,
          groupId: item.groupId,
          studentName: item.studentName,
          objectName: item.objectName,
          photoUrl: item.photoUrl,
          expectedShape: item.expectedShape,
        });
      }
    }

    return getFullSessionState(session.id);
  } catch (error) {
    console.error('Database query failed in ensureDefaultSession:', error);
    throw new Error('Failed to initialize game session.', { cause: error });
  }
}

export async function getSessionByCode(code: string) {
  try {
    const cleanCode = code.trim().toUpperCase();
    const found = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.code, cleanCode));

    if (found.length === 0) {
      return null;
    }
    return getFullSessionState(found[0].id);
  } catch (error) {
    console.error('Database query failed in getSessionByCode:', error);
    throw new Error('Failed to find session by code.', { cause: error });
  }
}

export async function getFullSessionState(sessionId: number) {
  try {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId));

    if (!session) {
      return null;
    }

    const sessionGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.sessionId, sessionId))
      .orderBy(asc(groups.arenaSlot), asc(groups.id));

    const sessionDiscoveries = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.sessionId, sessionId))
      .orderBy(desc(discoveries.createdAt), desc(discoveries.id));

    const sessionScores = await db
      .select()
      .from(scores)
      .where(eq(scores.sessionId, sessionId));

    const sessionAttempts = await db
      .select()
      .from(gameAttempts)
      .where(eq(gameAttempts.sessionId, sessionId))
      .orderBy(desc(gameAttempts.createdAt));

    return {
      session,
      groups: sessionGroups,
      discoveries: sessionDiscoveries,
      scores: sessionScores,
      attempts: sessionAttempts,
    };
  } catch (error) {
    console.error('Database query failed in getFullSessionState:', error);
    throw new Error('Failed to load full session state.', { cause: error });
  }
}

export async function createNewSession(input: CreateSessionInput) {
  try {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const code = `SH${randomSuffix}`;

    const [session] = await db
      .insert(gameSessions)
      .values({
        code,
        title: input.title || 'Sesi Eksplorasi Bangun Datar',
        teacherUid: input.teacherUid || null,
        status: 'playing',
        currentLevel: input.currentLevel || 1,
        timerDurationSeconds: input.timerDurationSeconds || 600,
        timerRemainingSeconds: input.timerDurationSeconds || 600,
        missionTitle:
          input.missionTitle ||
          'Temukan benda berbentuk bangun datar di sekitar sekolah!',
        missionTargetShape: input.missionTargetShape || 'all',
        missionTargetCount: input.missionTargetCount || 4,
      })
      .returning();

    for (const g of input.groupsConfig) {
      const [createdGroup] = await db
        .insert(groups)
        .values({
          sessionId: session.id,
          name: g.name,
          color: g.color,
          mascot: g.mascot,
          arenaSlot: g.arenaSlot,
        })
        .returning();

      await db.insert(scores).values({
        sessionId: session.id,
        groupId: createdGroup.id,
        xp: 0,
        totalDiscoveries: 0,
        correctCount: 0,
        attemptCount: 0,
        bonusPoints: 0,
        accuracy: 0,
      });
    }

    return getFullSessionState(session.id);
  } catch (error) {
    console.error('Database query failed in createNewSession:', error);
    throw new Error('Failed to create new game session.', { cause: error });
  }
}

export async function updateSessionSettings(
  sessionId: number,
  updates: Partial<{
    status: string;
    currentLevel: number;
    timerDurationSeconds: number;
    timerRemainingSeconds: number;
    missionTitle: string;
    missionTargetShape: string;
    missionTargetCount: number;
  }>
) {
  try {
    await db
      .update(gameSessions)
      .set(updates)
      .where(eq(gameSessions.id, sessionId));

    return getFullSessionState(sessionId);
  } catch (error) {
    console.error('Database query failed in updateSessionSettings:', error);
    throw new Error('Failed to update session settings.', { cause: error });
  }
}

export async function updateGroupArenaAssignment(
  sessionId: number,
  leftGroupId: number,
  rightGroupId: number
) {
  try {
    const allGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.sessionId, sessionId));

    let extraSlot = 3;
    for (const g of allGroups) {
      let nextSlot = extraSlot;
      if (g.id === leftGroupId) {
        nextSlot = 1;
      } else if (g.id === rightGroupId) {
        nextSlot = 2;
      } else {
        extraSlot++;
      }
      await db
        .update(groups)
        .set({ arenaSlot: nextSlot })
        .where(eq(groups.id, g.id));
    }

    return getFullSessionState(sessionId);
  } catch (error) {
    console.error('Database query failed in updateGroupArenaAssignment:', error);
    throw new Error('Failed to update arena groups.', { cause: error });
  }
}

export async function updateGroupName(groupId: number, newName: string) {
  try {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Nama kelompok tidak boleh kosong.');
    }

    const [updatedGroup] = await db
      .update(groups)
      .set({ name: trimmed })
      .where(eq(groups.id, groupId))
      .returning();

    if (!updatedGroup) {
      return null;
    }

    const fullState = await getFullSessionState(updatedGroup.sessionId);
    return { updatedGroup, fullState };
  } catch (error) {
    console.error('Database query failed in updateGroupName:', error);
    throw new Error('Failed to update group name.', { cause: error });
  }
}

export async function resetSessionData(sessionId: number) {
  try {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId));

    if (!session) return null;

    await db
      .update(gameSessions)
      .set({
        status: 'playing',
        timerRemainingSeconds: session.timerDurationSeconds,
      })
      .where(eq(gameSessions.id, sessionId));

    await db
      .update(discoveries)
      .set({
        classifiedShape: null,
        isLocked: false,
        annotationsJson: '[]',
        traitsVerified: false,
      })
      .where(eq(discoveries.sessionId, sessionId));

    await db
      .delete(gameAttempts)
      .where(eq(gameAttempts.sessionId, sessionId));

    const currentDiscoveries = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.sessionId, sessionId));

    const sessionGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.sessionId, sessionId));

    for (const g of sessionGroups) {
      const groupDiscCount = currentDiscoveries.filter(
        (d) => d.groupId === g.id
      ).length;
      await db
        .update(scores)
        .set({
          xp: groupDiscCount * 2, // small exploration bonus retained
          totalDiscoveries: groupDiscCount,
          correctCount: 0,
          attemptCount: 0,
          bonusPoints: groupDiscCount * 2,
          accuracy: 0,
          updatedAt: new Date(),
        })
        .where(
          and(eq(scores.sessionId, sessionId), eq(scores.groupId, g.id))
        );
    }

    return getFullSessionState(sessionId);
  } catch (error) {
    console.error('Database query failed in resetSessionData:', error);
    throw new Error('Failed to reset session data.', { cause: error });
  }
}

export async function createDiscovery(input: CreateDiscoveryInput) {
  try {
    const studentClaimed = (input.studentClaimedShape || input.expectedShape || 'lingkaran') as ShapeType;
    const realShape = (input.realShape || studentClaimed) as ShapeType;

    const [created] = await db
      .insert(discoveries)
      .values({
        sessionId: input.sessionId,
        groupId: input.groupId,
        studentName: input.studentName || 'Petualang Cilik',
        objectName: input.objectName,
        photoUrl: input.photoUrl,
        realShape,
        studentClaimedShape: studentClaimed,
        expectedShape: realShape, // keep expectedShape synced with realShape
        classifiedShape: null,
        isLocked: false,
        annotationsJson: '[]',
        traitsVerified: false,
      })
      .returning();

    // Small exploration bonus (+2 XP for new photo discovery)
    const existingScores = await db
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.sessionId, input.sessionId),
          eq(scores.groupId, input.groupId)
        )
      );

    if (existingScores.length > 0) {
      const current = existingScores[0];
      const newTotalDiscoveries = current.totalDiscoveries + 1;
      const newBonus = current.bonusPoints + 2;
      const newXp = current.xp + 2;

      await db
        .update(scores)
        .set({
          totalDiscoveries: newTotalDiscoveries,
          bonusPoints: newBonus,
          xp: newXp,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, current.id));
    }

    return created;
  } catch (error) {
    console.error('Database query failed in createDiscovery:', error);
    throw new Error('Failed to save student discovery.', { cause: error });
  }
}

export async function updateDiscoveryRealShape(
  discoveryId: number,
  newRealShape: ShapeType
) {
  try {
    const [updated] = await db
      .update(discoveries)
      .set({
        realShape: newRealShape,
        expectedShape: newRealShape,
      })
      .where(eq(discoveries.id, discoveryId))
      .returning();

    if (!updated) {
      throw new Error('Foto temuan tidak ditemukan.');
    }

    const fullState = await getFullSessionState(updated.sessionId);
    return { updatedDiscovery: updated, fullState };
  } catch (error) {
    console.error('Database query failed in updateDiscoveryRealShape:', error);
    throw new Error('Gagal memperbarui kunci bentuk benda.', { cause: error });
  }
}

export async function submitShapeAttempt(input: SubmitAttemptInput) {
  try {
    const [disc] = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.id, input.discoveryId));

    if (!disc) {
      throw new Error('Discovery card not found.');
    }

    const targetRealShape = (disc.realShape || disc.expectedShape) as ShapeType;
    const isCorrect = targetRealShape === input.selectedShape;
    const basePoints = isCorrect ? 10 : 0;
    let bonusAwarded = 0;

    if (isCorrect) {
      if (input.traitsVerified) {
        bonusAwarded += 5;
      }
      if (input.annotationsJson && input.annotationsJson !== '[]') {
        try {
          const parsed = JSON.parse(input.annotationsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            bonusAwarded += 5;
          }
        } catch {
          // ignore parse error
        }
      }
    }

    const [attempt] = await db
      .insert(gameAttempts)
      .values({
        sessionId: input.sessionId,
        groupId: input.groupId,
        discoveryId: input.discoveryId,
        selectedShape: input.selectedShape,
        isCorrect,
        levelAtAttempt: input.levelAtAttempt,
        pointsAwarded: basePoints,
        bonusAwarded,
        reasonText: input.reasonText || null,
      })
      .returning();

    if (isCorrect) {
      await db
        .update(discoveries)
        .set({
          classifiedShape: input.selectedShape,
          isLocked: true,
          annotationsJson: input.annotationsJson || disc.annotationsJson,
          traitsVerified: Boolean(input.traitsVerified),
        })
        .where(eq(discoveries.id, disc.id));
    }

    // Update group score & accuracy strictly isolated to this group
    const existingScores = await db
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.sessionId, input.sessionId),
          eq(scores.groupId, input.groupId)
        )
      );

    if (existingScores.length > 0) {
      const current = existingScores[0];
      const newAttemptCount = current.attemptCount + 1;
      const newCorrectCount = isCorrect
        ? current.correctCount + 1
        : current.correctCount;
      const newAccuracy = Math.round((newCorrectCount / newAttemptCount) * 100);
      const newBonus = current.bonusPoints + bonusAwarded;
      const newXp = current.xp + basePoints + bonusAwarded;

      await db
        .update(scores)
        .set({
          attemptCount: newAttemptCount,
          correctCount: newCorrectCount,
          accuracy: newAccuracy,
          bonusPoints: newBonus,
          xp: newXp,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, current.id));
    }

    return {
      attempt,
      isCorrect,
      expectedShape: disc.expectedShape,
      pointsAwarded: basePoints,
      bonusAwarded,
    };
  } catch (error) {
    console.error('Database query failed in submitShapeAttempt:', error);
    throw new Error('Failed to process shape check.', { cause: error });
  }
}

export interface ProveTraitsInput {
  sessionId: number;
  groupId: number;
  discoveryId: number;
  sides: number;
  corners: number;
}

export async function proveDiscoveryTraits(input: ProveTraitsInput) {
  try {
    const [disc] = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.id, input.discoveryId));

    if (!disc) {
      throw new Error('Kartu temuan tidak ditemukan.');
    }

    const targetShape = (disc.realShape || disc.classifiedShape || disc.expectedShape) as ShapeType;
    let expectedSides = 4;
    let expectedCorners = 4;

    if (targetShape === 'lingkaran') {
      expectedSides = 0;
      expectedCorners = 0;
    } else if (targetShape === 'segitiga') {
      expectedSides = 3;
      expectedCorners = 3;
    } else {
      expectedSides = 4;
      expectedCorners = 4;
    }

    const isCorrect =
      input.sides === expectedSides && input.corners === expectedCorners;
    const pointsAwarded = isCorrect ? 10 : 0;
    const bonusAwarded = isCorrect ? 5 : 0;

    const [attempt] = await db
      .insert(gameAttempts)
      .values({
        sessionId: input.sessionId,
        groupId: input.groupId,
        discoveryId: input.discoveryId,
        selectedShape: targetShape,
        isCorrect,
        levelAtAttempt: 2,
        pointsAwarded,
        bonusAwarded,
        reasonText: isCorrect
          ? `Terbukti! Memiliki ${input.sides} sisi lurus dan ${input.corners} titik sudut.`
          : `Menjawab ${input.sides} sisi dan ${input.corners} titik sudut (kunci: ${expectedSides} sisi, ${expectedCorners} sudut).`,
      })
      .returning();

    if (isCorrect) {
      await db
        .update(discoveries)
        .set({
          classifiedShape: targetShape,
          isLocked: true,
          traitsVerified: true,
        })
        .where(eq(discoveries.id, disc.id));

      const existingScores = await db
        .select()
        .from(scores)
        .where(
          and(
            eq(scores.sessionId, input.sessionId),
            eq(scores.groupId, input.groupId)
          )
        );

      if (existingScores.length > 0) {
        const current = existingScores[0];
        const newAttemptCount = current.attemptCount + 1;
        const newCorrectCount = current.correctCount + (disc.isLocked ? 0 : 1);
        const newAccuracy = Math.round((newCorrectCount / newAttemptCount) * 100);
        const newBonus = current.bonusPoints + bonusAwarded;
        const newXp = current.xp + pointsAwarded + bonusAwarded;

        await db
          .update(scores)
          .set({
            attemptCount: newAttemptCount,
            correctCount: newCorrectCount,
            accuracy: newAccuracy,
            bonusPoints: newBonus,
            xp: newXp,
            updatedAt: new Date(),
          })
          .where(eq(scores.id, current.id));
      }
    }

    return {
      attempt,
      isCorrect,
      expectedSides,
      expectedCorners,
      targetShape,
      pointsAwarded,
      bonusAwarded,
    };
  } catch (error) {
    console.error('Database query failed in proveDiscoveryTraits:', error);
    throw new Error('Gagal memeriksa pembuktian ciri bentuk.', { cause: error });
  }
}
