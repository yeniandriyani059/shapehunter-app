import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 0. Users table (Teacher accounts via Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 1. game_sessions table
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  teacherUid: text('teacher_uid'),
  status: text('status').notNull().default('playing'), // 'waiting' | 'playing' | 'paused' | 'ended'
  currentLevel: integer('current_level').notNull().default(1), // 1: Sort It!, 2: Prove It!, 3: Shape Hunter Mission
  timerDurationSeconds: integer('timer_duration_seconds').notNull().default(600),
  timerRemainingSeconds: integer('timer_remaining_seconds').notNull().default(600),
  missionTitle: text('mission_title').notNull().default('Temukan benda berbentuk bangun datar di sekitar sekolah!'),
  missionTargetShape: text('mission_target_shape').notNull().default('all'), // 'all' | 'lingkaran' | 'segitiga' | 'persegi' | 'persegi_panjang'
  missionTargetCount: integer('mission_target_count').notNull().default(4),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. groups table
export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => gameSessions.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('blue'), // 'blue' | 'emerald' | 'amber' | 'rose' | 'purple'
  mascot: text('mascot').notNull().default('kapten_geo'),
  arenaSlot: integer('arena_slot').notNull().default(1), // 1 = Left PID Arena, 2 = Right PID Arena, 3+ = Additional
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. discoveries table (Photos uploaded from student HP)
export const discoveries = pgTable('discoveries', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => gameSessions.id, { onDelete: 'cascade' })
    .notNull(),
  groupId: integer('group_id')
    .references(() => groups.id, { onDelete: 'cascade' })
    .notNull(),
  studentName: text('student_name').notNull().default('Tim Eksplorasi'),
  objectName: text('object_name').notNull(),
  photoUrl: text('photo_url').notNull(),
  realShape: text('real_shape'), // Key shape detected by Gemini AI or corrected by Teacher ('lingkaran' | 'segitiga' | 'persegi' | 'persegi_panjang')
  studentClaimedShape: text('student_claimed_shape'), // Initial student guess from mobile upload form
  expectedShape: text('expected_shape').notNull(), // 'lingkaran' | 'segitiga' | 'persegi' | 'persegi_panjang'
  classifiedShape: text('classified_shape'), // Set when locked on PID
  isLocked: boolean('is_locked').notNull().default(false),
  annotationsJson: text('annotations_json').default('[]'), // JSON array of {x, y, type: 'corner' | 'side'} for Level 2 Prove It!
  traitsVerified: boolean('traits_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. game_attempts table (Answers & classification checks on PID)
export const gameAttempts = pgTable('game_attempts', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => gameSessions.id, { onDelete: 'cascade' })
    .notNull(),
  groupId: integer('group_id')
    .references(() => groups.id, { onDelete: 'cascade' })
    .notNull(),
  discoveryId: integer('discovery_id')
    .references(() => discoveries.id, { onDelete: 'cascade' })
    .notNull(),
  selectedShape: text('selected_shape').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  levelAtAttempt: integer('level_at_attempt').notNull().default(1),
  pointsAwarded: integer('points_awarded').notNull().default(0),
  bonusAwarded: integer('bonus_awarded').notNull().default(0),
  reasonText: text('reason_text'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. scores table (Group score & accuracy summary)
export const scores = pgTable('scores', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => gameSessions.id, { onDelete: 'cascade' })
    .notNull(),
  groupId: integer('group_id')
    .references(() => groups.id, { onDelete: 'cascade' })
    .notNull(),
  xp: integer('xp').notNull().default(0),
  totalDiscoveries: integer('total_discoveries').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  attemptCount: integer('attempt_count').notNull().default(0),
  bonusPoints: integer('bonus_points').notNull().default(0),
  accuracy: integer('accuracy').notNull().default(0), // 0 to 100 percentage
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const gameSessionsRelations = relations(gameSessions, ({ many }) => ({
  groups: many(groups),
  discoveries: many(discoveries),
  attempts: many(gameAttempts),
  scores: many(scores),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  session: one(gameSessions, {
    fields: [groups.sessionId],
    references: [gameSessions.id],
  }),
  discoveries: many(discoveries),
  attempts: many(gameAttempts),
  scores: many(scores),
}));

export const discoveriesRelations = relations(discoveries, ({ one, many }) => ({
  session: one(gameSessions, {
    fields: [discoveries.sessionId],
    references: [gameSessions.id],
  }),
  group: one(groups, {
    fields: [discoveries.groupId],
    references: [groups.id],
  }),
  attempts: many(gameAttempts),
}));
