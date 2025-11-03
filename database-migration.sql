-- DreamUp QA Pipeline - Database Schema Migration
-- Run this in your Supabase SQL Editor
-- Last Updated: November 3, 2025

-- ============================================
-- TABLE: games
-- ============================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_url TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  game_type TEXT CHECK (game_type IN ('puzzle', 'platformer', 'idle', 'shooter', 'rpg', 'other')),
  description TEXT,
  active_manifest_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_tested_at TIMESTAMPTZ
);

COMMENT ON TABLE games IS 'Central repository of browser games available for testing';
COMMENT ON COLUMN games.game_url IS 'Unique URL of the game (serves as natural key)';
COMMENT ON COLUMN games.name IS 'Human-readable game name';
COMMENT ON COLUMN games.game_type IS 'Game genre/category for testing strategy selection';
COMMENT ON COLUMN games.active_manifest_id IS 'Currently active manifest version (nullable if no manifest)';
COMMENT ON COLUMN games.last_tested_at IS 'Timestamp of most recent test run';

-- Indexes for games table
CREATE INDEX idx_games_url ON games(game_url);
CREATE INDEX idx_games_last_tested ON games(last_tested_at DESC NULLS LAST);
CREATE INDEX idx_games_type ON games(game_type);

-- ============================================
-- TABLE: game_manifests
-- ============================================

CREATE TABLE game_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  manifest_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

COMMENT ON TABLE game_manifests IS 'Version-controlled game manifests (1-to-many with games)';
COMMENT ON COLUMN game_manifests.version_name IS 'Human-readable version identifier (e.g., "v1.0", "After Update 2024-11")';
COMMENT ON COLUMN game_manifests.manifest_data IS 'Full manifest JSON following game-manifest-schema.md';
COMMENT ON COLUMN game_manifests.is_active IS 'Whether this is the active manifest (only one per game should be true)';
COMMENT ON COLUMN game_manifests.created_by IS 'Optional: identifier of user who created this version';
COMMENT ON COLUMN game_manifests.notes IS 'Description of what changed in this version';

-- Indexes for game_manifests table
CREATE INDEX idx_manifests_game_id ON game_manifests(game_id);
CREATE INDEX idx_manifests_active ON game_manifests(game_id, is_active) WHERE is_active = true;
CREATE INDEX idx_manifests_created_at ON game_manifests(created_at DESC);

-- Ensure only one active manifest per game
CREATE UNIQUE INDEX idx_one_active_manifest_per_game 
  ON game_manifests(game_id) 
  WHERE is_active = true;

-- ============================================
-- TABLE: test_runs
-- ============================================

CREATE TABLE test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  manifest_id UUID REFERENCES game_manifests(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'error', 'timeout')),
  playability_score INTEGER CHECK (playability_score >= 0 AND playability_score <= 100),
  issues JSONB DEFAULT '[]',
  screenshots TEXT[] DEFAULT '{}',
  console_logs TEXT,
  execution_method TEXT CHECK (execution_method IN ('cli', 'lambda', 'web')),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE test_runs IS 'Historical record of all QA test executions';
COMMENT ON COLUMN test_runs.game_id IS 'Reference to the game that was tested';
COMMENT ON COLUMN test_runs.manifest_id IS 'Manifest version used for this test (nullable if no manifest used)';
COMMENT ON COLUMN test_runs.status IS 'Overall test result: pass/fail/error/timeout';
COMMENT ON COLUMN test_runs.playability_score IS 'AI-generated playability assessment (0-100)';
COMMENT ON COLUMN test_runs.issues IS 'Array of issues detected during testing';
COMMENT ON COLUMN test_runs.screenshots IS 'Array of Supabase Storage URLs for screenshots';
COMMENT ON COLUMN test_runs.console_logs IS 'Supabase Storage URL or text content of console logs';
COMMENT ON COLUMN test_runs.execution_method IS 'How the test was triggered (cli/lambda/web)';
COMMENT ON COLUMN test_runs.duration_ms IS 'Total test execution time in milliseconds';
COMMENT ON COLUMN test_runs.metadata IS 'Additional context (browser version, LLM model used, etc.)';

-- Indexes for test_runs table
CREATE INDEX idx_test_runs_game_id ON test_runs(game_id);
CREATE INDEX idx_test_runs_manifest_id ON test_runs(manifest_id);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_score ON test_runs(playability_score DESC NULLS LAST);

-- ============================================
-- FOREIGN KEY: Link active manifest to games
-- ============================================

ALTER TABLE games 
  ADD CONSTRAINT fk_active_manifest 
  FOREIGN KEY (active_manifest_id) 
  REFERENCES game_manifests(id) 
  ON DELETE SET NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Update games.updated_at on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update games.last_tested_at on new test run
CREATE OR REPLACE FUNCTION update_game_last_tested()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games
  SET last_tested_at = NEW.created_at
  WHERE id = NEW.game_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_tested_on_test_run
  AFTER INSERT ON test_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_game_last_tested();

-- Trigger: Ensure only one active manifest per game
CREATE OR REPLACE FUNCTION ensure_one_active_manifest()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other manifests for this game
    UPDATE game_manifests
    SET is_active = false
    WHERE game_id = NEW.game_id AND id != NEW.id;
    
    -- Update games table to point to this manifest
    UPDATE games
    SET active_manifest_id = NEW.id, updated_at = NOW()
    WHERE id = NEW.game_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_one_active_manifest_trigger
  AFTER INSERT OR UPDATE OF is_active ON game_manifests
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_one_active_manifest();

-- ============================================
-- COMPLETE
-- ============================================

-- Migration complete!
-- Next step: Generate TypeScript types using:
-- npx supabase gen types typescript --project-id <your-project-id> > src/storage/types.ts

