# Database Schema

**Database:** Supabase (PostgreSQL)  
**Last Updated:** November 3, 2025

## Overview

The DreamUp QA Pipeline uses a relational database to store games, manifests, and test results. The schema supports manifest versioning and maintains relationships between games and their test history.

## Entity Relationship Diagram

```
┌─────────────────┐
│     games       │
│─────────────────│
│ id (PK)         │◄─────┐
│ game_url        │      │
│ name            │      │
│ game_type       │      │
│ description     │      │
│ active_manifest─┼──┐   │
│ created_at      │  │   │
│ updated_at      │  │   │
│ last_tested_at  │  │   │
└─────────────────┘  │   │
                     │   │
                     │   │
┌─────────────────┐  │   │
│ game_manifests  │  │   │
│─────────────────│  │   │
│ id (PK)         │◄─┘   │
│ game_id (FK)    │──────┘
│ version_name    │
│ manifest_data   │
│ is_active       │
│ created_at      │
│ created_by      │
│ notes           │
└─────────────────┘
         ▲
         │
         │
┌─────────────────┐
│   test_runs     │
│─────────────────│
│ id (PK)         │
│ game_id (FK)    │──────┐
│ manifest_id (FK)│      │
│ status          │      │
│ playability_... │      │
│ issues          │      │
│ screenshots     │      │
│ console_logs    │      │
│ execution_...   │      │
│ duration_ms     │      │
│ created_at      │      │
│ metadata        │      │
└─────────────────┘      │
                         │
                         └─────► References games.id
```

## Tables

### games

Stores information about browser games that can be tested.

```sql
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
```

**Indexes:**
```sql
CREATE INDEX idx_games_url ON games(game_url);
CREATE INDEX idx_games_last_tested ON games(last_tested_at DESC NULLS LAST);
CREATE INDEX idx_games_type ON games(game_type);
```

**Constraints:**
- `game_url` must be unique
- `game_type` must be one of the allowed enum values
- `name` is required

---

### game_manifests

Stores version-controlled manifests for each game.

```sql
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
```

**Indexes:**
```sql
CREATE INDEX idx_manifests_game_id ON game_manifests(game_id);
CREATE INDEX idx_manifests_active ON game_manifests(game_id, is_active) WHERE is_active = true;
CREATE INDEX idx_manifests_created_at ON game_manifests(created_at DESC);
```

**Constraints:**
```sql
-- Ensure only one active manifest per game
CREATE UNIQUE INDEX idx_one_active_manifest_per_game 
  ON game_manifests(game_id) 
  WHERE is_active = true;
```

---

### test_runs

Stores results of QA test executions.

```sql
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
```

**Indexes:**
```sql
CREATE INDEX idx_test_runs_game_id ON test_runs(game_id);
CREATE INDEX idx_test_runs_manifest_id ON test_runs(manifest_id);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_score ON test_runs(playability_score DESC NULLS LAST);
```

**Constraints:**
- `status` must be one of: 'pass', 'fail', 'error', 'timeout'
- `playability_score` must be between 0 and 100 (inclusive)
- `execution_method` must be one of: 'cli', 'lambda', 'web'

---

### Foreign Key Relationships

```sql
-- Link active manifest back to games table
ALTER TABLE games 
  ADD CONSTRAINT fk_active_manifest 
  FOREIGN KEY (active_manifest_id) 
  REFERENCES game_manifests(id) 
  ON DELETE SET NULL;

-- Ensure manifest belongs to a game
ALTER TABLE game_manifests
  ADD CONSTRAINT fk_game
  FOREIGN KEY (game_id)
  REFERENCES games(id)
  ON DELETE CASCADE;

-- Link test runs to games
ALTER TABLE test_runs
  ADD CONSTRAINT fk_game
  FOREIGN KEY (game_id)
  REFERENCES games(id)
  ON DELETE CASCADE;

-- Link test runs to manifests (optional)
ALTER TABLE test_runs
  ADD CONSTRAINT fk_manifest
  FOREIGN KEY (manifest_id)
  REFERENCES game_manifests(id)
  ON DELETE SET NULL;
```

## Data Types

### JSONB Columns

#### games.active_manifest_id
Nullable UUID reference to active manifest.

#### game_manifests.manifest_data
Full game manifest following schema defined in `game-manifest-schema.md`:
```json
{
  "version": "1.0",
  "gameType": "platformer",
  "controls": {
    "primary": ["ArrowLeft", "ArrowRight", "Space"]
  },
  "startButton": {
    "text": "Start Game"
  }
}
```

#### test_runs.issues
Array of issue descriptions detected during testing:
```json
[
  "Console error: Cannot read property 'x' of undefined",
  "Screenshot comparison detected frozen game at 00:02:30",
  "Page load timeout after 30 seconds"
]
```

#### test_runs.metadata
Additional context about the test run:
```json
{
  "browserVersion": "Chrome 120.0",
  "llmModel": "gpt-4-vision-preview",
  "llmProvider": "openai",
  "retryCount": 0,
  "userAgent": "Mozilla/5.0...",
  "manifestVersion": "v2.0"
}
```

### Array Columns

#### test_runs.screenshots
Array of Supabase Storage URLs:
```sql
ARRAY[
  'https://xxx.supabase.co/storage/v1/object/public/artifacts/test-123/screenshots/001.png',
  'https://xxx.supabase.co/storage/v1/object/public/artifacts/test-123/screenshots/002.png'
]
```

## Queries

### Common Query Patterns

#### Get game with active manifest
```sql
SELECT 
  g.*,
  m.manifest_data,
  m.version_name
FROM games g
LEFT JOIN game_manifests m ON g.active_manifest_id = m.id
WHERE g.game_url = $1;
```

#### Get all manifests for a game
```sql
SELECT *
FROM game_manifests
WHERE game_id = $1
ORDER BY created_at DESC;
```

#### Get test history for a game
```sql
SELECT 
  tr.*,
  m.version_name as manifest_version
FROM test_runs tr
LEFT JOIN game_manifests m ON tr.manifest_id = m.id
WHERE tr.game_id = $1
ORDER BY tr.created_at DESC
LIMIT 50;
```

#### Get latest test results for all games
```sql
SELECT DISTINCT ON (g.id)
  g.name,
  g.game_url,
  tr.status,
  tr.playability_score,
  tr.created_at as last_tested
FROM games g
LEFT JOIN test_runs tr ON g.id = tr.game_id
ORDER BY g.id, tr.created_at DESC;
```

#### Get games without manifests
```sql
SELECT *
FROM games
WHERE active_manifest_id IS NULL
ORDER BY last_tested_at DESC NULLS LAST;
```

#### Set manifest as active (transaction)
```sql
BEGIN;

-- Deactivate all manifests for this game
UPDATE game_manifests
SET is_active = false
WHERE game_id = $1;

-- Activate the selected manifest
UPDATE game_manifests
SET is_active = true
WHERE id = $2 AND game_id = $1;

-- Update games table to point to active manifest
UPDATE games
SET active_manifest_id = $2, updated_at = NOW()
WHERE id = $1;

COMMIT;
```

## Database Triggers

### Update games.updated_at on modification
```sql
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
```

### Update games.last_tested_at on new test run
```sql
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
```

### Ensure only one active manifest per game
```sql
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
```

## Migration Strategy

### Initial Setup (Phase: Setup)
1. Create `games` table
2. Create `game_manifests` table
3. Create `test_runs` table
4. Add foreign key constraints
5. Create indexes
6. Create triggers

### Version 1.0 → Future Versions
If schema changes are needed:
- Use Supabase migrations
- Version control all migration files
- Never modify existing columns (add new ones instead)
- Provide backward compatibility for at least one version

## Data Retention

### Recommendations
- **Test runs**: Retain for 90 days, archive older results
- **Screenshots**: Retain for 30 days, delete after
- **Console logs**: Retain for 30 days, delete after
- **Games & Manifests**: Retain indefinitely

### Cleanup Queries
```sql
-- Delete test runs older than 90 days
DELETE FROM test_runs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Find screenshots to delete (older than 30 days)
SELECT screenshots
FROM test_runs
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Performance Considerations

### Query Optimization
- Indexes on foreign keys for efficient joins
- Composite index on `(game_id, is_active)` for active manifest lookups
- Descending indexes on timestamps for "latest first" queries

### Storage Optimization
- Use JSONB (not JSON) for efficient querying
- Store large artifacts (screenshots, logs) in Supabase Storage, not database
- Use arrays for small collections (screenshots URLs)

### Connection Pooling
For Lambda functions, use Supabase connection pooling to avoid exhausting connections:
```typescript
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);
```

## Security

### Row Level Security (RLS)

For future authentication (currently not implemented):

```sql
-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

-- Public read access (since no auth in MVP)
CREATE POLICY "Public read access" ON games FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON games FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON games FOR DELETE USING (true);

-- Same for other tables
-- (Replicate for game_manifests and test_runs)
```

**Note**: With no authentication, all tables have public CRUD access. Enable proper RLS policies if authentication is added later.

## TypeScript Types

Generate TypeScript types from schema:

```bash
npx supabase gen types typescript --project-id <project-id> > src/storage/types.ts
```

Example generated types:
```typescript
export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          game_url: string;
          name: string;
          game_type: string | null;
          description: string | null;
          active_manifest_id: string | null;
          created_at: string;
          updated_at: string;
          last_tested_at: string | null;
        };
        Insert: {
          id?: string;
          game_url: string;
          name: string;
          game_type?: string | null;
          description?: string | null;
          active_manifest_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_tested_at?: string | null;
        };
        Update: {
          id?: string;
          game_url?: string;
          name?: string;
          game_type?: string | null;
          description?: string | null;
          active_manifest_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_tested_at?: string | null;
        };
      };
      // ... game_manifests and test_runs types
    };
  };
};
```

---

## Summary

The database schema supports:
- ✅ Games as first-class entities
- ✅ Version-controlled manifests (1-to-many)
- ✅ Test result history with full context
- ✅ Efficient querying with proper indexes
- ✅ Data integrity with constraints and triggers
- ✅ Scalability with connection pooling
- ✅ Type safety with generated TypeScript types

This schema provides a solid foundation for the DreamUp QA Pipeline while remaining flexible for future enhancements.

