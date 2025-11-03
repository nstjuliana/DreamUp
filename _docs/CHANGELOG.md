# Documentation Changelog

## November 3, 2025 - Architecture Update v2.0

### Major Changes

This update introduces Games and Manifests as first-class entities in the architecture, significantly improving the system's organization and capability to handle game updates over time.

---

### New Files Created

#### 1. `_docs/game-manifest-schema.md`
- **Purpose**: Formal specification of game manifest JSON schema
- **Content**:
  - TypeScript and JSON schema definitions
  - Detailed explanation of all fields (controls, startButton, gameStates, etc.)
  - Example manifests for different game types (puzzle, platformer, RPG, idle)
  - Key concepts (control key names, CSS selectors, game types)
  - Validation rules
  - Best practices and usage guidelines

#### 2. `_docs/database-schema.md`
- **Purpose**: Complete database schema documentation
- **Content**:
  - Entity Relationship Diagram
  - Three main tables: `games`, `game_manifests`, `test_runs`
  - Column definitions with comments
  - Indexes for query performance
  - Foreign key constraints
  - Database triggers (auto-update timestamps, ensure one active manifest)
  - Common query patterns
  - TypeScript type generation instructions
  - Migration strategy
  - Data retention recommendations
  - Performance and security considerations

#### 3. `_docs/architecture-summary.md`
- **Purpose**: High-level overview of the complete architecture
- **Content**:
  - Key architectural concepts (games as entities, manifest versioning)
  - Database schema overview
  - Execution methods (CLI, Lambda, Web UI)
  - Manifest schema summary
  - Agent workflow (with/without manifest)
  - Technology stack table
  - Data flow diagrams
  - User journeys
  - File structure
  - Performance, security, and cost considerations

#### 4. `_docs/CHANGELOG.md`
- **Purpose**: Track documentation changes over time
- **Content**: This file

---

### Updated Files

#### 1. `_docs/DreamUp - Gauntlet C3 Project 1.md` (Main Project Document)

**Changes:**
- Updated **Optional Stretch Features** section:
  - Added "Web Dashboard with Game Management"
  - Added "Manifest Generator" (visual interface, no JSON editing)
  - Added "Manifest Versioning" (multiple versions per game)
  - Reordered features by priority

- Updated **Technical Architecture → Stack** section:
  - Added Runtime (Node.js)
  - Added Database (Supabase for games, manifests, test results)
  - Added File Storage (Supabase Storage)
  - Added CLI Framework (Commander.js)
  - Added Web Framework (Next.js for stretch)
  - Specified TypeScript strict mode

- Updated **Execution Interface** section:
  - Split into three execution methods: CLI, Lambda, Web UI
  - CLI now requires games to exist in database
  - Lambda receives gameId + manifestId
  - Added bullet point 5: "Game & Manifest Management"

---

#### 2. `_docs/user-flow.md` (User Flow Documentation)

**Major Restructure:**

**Journey 1: CLI/Script Execution**
- Updated to require game existence in database
- Added game lookup step (error if not found)
- Added manifest selection prompt (if game has manifests)
- Added CLI flags: `--manifest`, `--no-manifest`
- Games must be created via Web UI (not CLI)

**Journey 3: Web UI Journey** (Completely Revised)

**3.1 Landing/Games Library View** (was Dashboard View)
- Now shows **Games** instead of raw test results
- Each game card shows: name, URL, type, manifest indicator, last tested, score
- Filter by game type, has/no manifest
- Navigation to Create Game and Run Test

**3.2 Create Game Page** (NEW)
- Game URL input (validated, unique check)
- Game name, type, description inputs
- **Embedded Manifest Generator Section**:
  - Controls definition interface (visual keyboard picker)
  - Start button configuration
  - Game states builder (add/remove/reorder states)
  - Live JSON preview
  - Save with or without manifest

**3.3 Edit/Add Manifest Version** (NEW)
- Create new manifest versions for existing games
- Version name and notes inputs
- Clone from previous version option
- Same manifest generator components
- Save and optionally set as active

**3.4 Game Detail Page** (NEW)
- Game information section
- Manifest versions list (all versions with active indicator)
- Test history for this game
- Quick actions (run test, edit, delete)

**3.5 Run Test Page** (NEW - was part of 3.2)
- Game selection dropdown
- Manifest version selection (defaults to active)
- Advanced options
- Progress display
- Redirects to Test Results on completion

**3.6 View Test Results Page** (was 3.3)
- Enhanced with game name link
- Shows manifest version used
- All previous functionality retained

**Updated Navigation Map**
- New flow: Games Library → Create Game → Game Detail → Manifests/Tests
- Shows data flow: Create Game → Add Manifest → Run Test → View Results

---

#### 3. `_docs/tech-stack.md` (Technology Stack)

**Database Section Updated:**
- Added **Database Schema** subsection
- Listed three main tables: `games`, `game_manifests`, `test_runs`
- Reference to `database-schema.md` for complete details
- Updated best practices:
  - Generate types to `src/storage/types.ts`
  - RLS policies (currently public for MVP)
  - Store artifacts in Storage, not database

---

#### 4. `_docs/phases/setup-phase.md` (Setup Phase)

**New Feature 5: Database Schema Setup**
- Create Supabase project
- Run SQL migrations for `games`, `game_manifests`, `test_runs` tables
- Create indexes, foreign keys, triggers
- Generate TypeScript types from schema
- Reference to `database-schema.md`

**Updated Feature 6 (was 5): Core Module Placeholders**
- Added step 5: Create `src/storage/types.ts` (populated with generated types)
- Renumbered from 5 → 6

**Updated Features 7-8** (was 6-7): Error Handling, Constants
- Renumbered

**Updated Deliverables Checklist**
- Added: Database schema created in Supabase
- Added: Database types generated and imported
- Updated: `.env.example` documents Supabase credentials

---

#### 5. `_docs/phases/mvp-phase.md` (MVP Phase)

**Feature 6: CLI Integration with Game Lookup** (Updated)
- CLI now looks up game by URL in database
- Error if game not found (with helpful message)
- Retrieve game record (manifest can be null for MVP)
- Note: Games created manually in DB for MVP (Web UI comes later)

**MVP Scope Boundaries** (Updated)
- **In Scope**: Added "Game lookup from database by URL"
- **Out of Scope**:
  - Database storage of test results (just stdout for MVP)
  - Manifest usage (retrieve but don't use yet)
  - Web UI for game creation (manual DB entry for now)

---

#### 6. `_docs/phases/enhancement-phase-1.md` (Enhancement Phase 1)

**Feature 1: Game Interaction System** (Updated to include Manifest Support)
- `findStartButton()` now checks manifest first, then AI detection
- Use manifest controls data to guide key presses
- Added step 9: Create `src/utils/manifest-parser.ts`
- Fallback to AI detection if no manifest

**Feature 3: Supabase Database Integration** (Updated)
- Schema already created in Setup Phase (no longer creating here)
- Focus on implementing `saveTestResult()` function
- Link test results to gameId + manifestId
- Update `games.last_tested_at`

---

#### 7. `_docs/phases/stretch-phase.md` (Stretch Phase)

**Feature Order Changed:**

**1. Web Dashboard UI (Next.js)** (Now Priority #1, was #4)
- Expanded significantly with sub-feature: **Embedded Manifest Generator**
- Detailed components:
  - Controls Definition Interface (visual keyboard picker, presets)
  - Start Button Configuration
  - Game States Builder (drag-to-reorder)
  - Live JSON Preview (syntax highlighted, validates)
  - Manifest Versioning UI (list versions, create, clone, set active)
- Complete page list: Games Library, Create Game, Game Detail, Edit Manifest, Run Test, Test Results

**2. Batch Testing** (was #1)
- Updated to work with game IDs (not just URLs)
- Add batch view to Web UI

**3-8: Other Features** (Unchanged, renumbered)

**Priority Order Updated:**
1. Web Dashboard UI with Manifest Generator (highest value)
2. Batch Testing
3. Settings/Configuration
4. Test Result Export
5. Advanced Metrics
6. GIF Recording
7. LLM Model Comparison
8. Real-Time Progress

---

### Architecture Changes Summary

#### Before (v1.0)
- Games were implicit (just URLs passed around)
- Manifests were optional files uploaded per test
- Test results stored with URL but no game entity
- No version control for manifests
- Web UI was simple test submission + results viewing

#### After (v2.0)
- **Games are first-class entities** in database
- **Manifests are versioned** (1-to-many with games)
- **Test results link to game + specific manifest version**
- **CLI requires games to exist** (created via Web UI)
- **Web UI focuses on game management** with embedded manifest generator
- **Manifest Generator** eliminates need for manual JSON editing

---

### Key Benefits of Changes

1. **Centralized Game Management**: All game info in one place
2. **Historical Context**: Know exactly what was tested and how
3. **Handle Game Updates**: Create new manifest versions when game changes
4. **Better UX**: Visual manifest generator vs manual JSON editing
5. **Improved Testing**: Manifests guide agent for better accuracy
6. **Trend Analysis**: Track playability over time per game
7. **Team Collaboration**: Shared game/manifest repository

---

### Migration Notes

**For Existing Implementations (if any):**

1. **Database Migration Required**:
   - Create new tables: `games`, `game_manifests`
   - Migrate existing `test_runs` to link to game records
   - Add foreign key constraints

2. **CLI Changes**:
   - Update to require game lookup
   - Add manifest selection prompt
   - Update error messages

3. **Lambda Changes**:
   - Update event payload to accept `gameId` instead of URL
   - Add manifest lookup logic

4. **Test Data**:
   - Create game records for existing test URLs
   - Optionally create manifests for known games

---

### Documentation Cross-References

All documentation files now reference each other appropriately:

- Main project doc → Points to all detailed docs
- User flow → References manifest schema for manifest generator
- Tech stack → References database schema
- Phase docs → Reference manifest schema and database schema
- Database schema → References manifest schema
- Architecture summary → References all other docs

---

### Future Documentation Needs

1. **API Documentation**: If building Web UI, document API endpoints
2. **Deployment Guide**: Step-by-step Lambda deployment
3. **Error Code Reference**: Catalog of all error codes and meanings
4. **Monitoring Guide**: Setting up alerts and dashboards
5. **Cost Analysis**: Detailed cost breakdown per test run

---

## Next Steps

1. ✅ Documentation updated (complete)
2. ⏳ Begin Setup Phase implementation
3. ⏳ Create database schema in Supabase
4. ⏳ Generate TypeScript types
5. ⏳ Implement core modules following phase docs

---

**Note**: This changelog documents the November 3, 2025 architecture update. Future changes should be appended below with clear date headers.

