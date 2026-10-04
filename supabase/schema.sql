-- ============================================================================
-- SHAPE HUNTER: "Temukan Bentuk di Sekitarmu!"
-- Supabase Database, Storage Bucket & Realtime Configuration
-- ============================================================================

-- 1. game_sessions
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  teacher_uid TEXT,
  status TEXT NOT NULL DEFAULT 'playing',
  current_level INTEGER NOT NULL DEFAULT 1,
  timer_duration_seconds INTEGER NOT NULL DEFAULT 600,
  timer_remaining_seconds INTEGER NOT NULL DEFAULT 600,
  mission_title TEXT NOT NULL DEFAULT 'Temukan benda berbentuk bangun datar di sekitar sekolah!',
  mission_target_shape TEXT NOT NULL DEFAULT 'all',
  mission_target_count INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. groups
CREATE TABLE IF NOT EXISTS public.groups (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  mascot TEXT NOT NULL DEFAULT 'kapten_geo',
  arena_slot INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. discoveries
CREATE TABLE IF NOT EXISTS public.discoveries (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL DEFAULT 'Tim Eksplorasi',
  object_name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  expected_shape TEXT NOT NULL,
  classified_shape TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  annotations_json TEXT DEFAULT '[]',
  traits_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. game_attempts
CREATE TABLE IF NOT EXISTS public.game_attempts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  discovery_id INTEGER NOT NULL REFERENCES public.discoveries(id) ON DELETE CASCADE,
  selected_shape TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  level_at_attempt INTEGER NOT NULL DEFAULT 1,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  bonus_awarded INTEGER NOT NULL DEFAULT 0,
  reason_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. scores
CREATE TABLE IF NOT EXISTS public.scores (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  total_discoveries INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage Bucket for Student Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('shape-hunter-photos', 'shape-hunter-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Supabase Realtime on all game tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discoveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
