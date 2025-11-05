# Phase 1: Setup Phase

**Goal**: Establish a barebones project structure that functions at a basic level but isn't fully usable. This phase creates the foundation for all subsequent development.

**Timeline**: Day 1 (Setup + Basic Agent foundation)

**Success Criteria**: 
- Project structure exists and follows conventions
- TypeScript/Node.js environment is configured
- Basic CLI can be executed
- Environment variables can be loaded
- Core module directories exist with placeholder files

---

## Features

### 1. Project Structure Setup

**Goal**: Create the complete directory structure following project rules.

**Steps**:
1. Create root-level files: `qa.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`
2. Create `src/` directory with all module subdirectories: `agent/`, `browser/`, `evaluation/`, `storage/`, `cli/`, `lambda/`, `utils/`
3. Create `artifacts/` directory with `.gitkeep` file
4. Create `_docs/` structure (already exists, verify completeness)

**Deliverable**: Complete directory structure matching project-rules.md specifications

---

### 2. TypeScript and Node.js Configuration

**Goal**: Set up TypeScript with strict mode and Node.js runtime configuration.

**Steps**:
1. Initialize `package.json` with Node.js as runtime, project metadata, and basic scripts
2. Configure `tsconfig.json` with strict mode, proper module resolution, and output settings
3. Install TypeScript execution tool: `npm install --save-dev tsx`
4. Install TypeScript types: `npm install --save-dev @types/node`

**Deliverable**: TypeScript compiles successfully with strict mode, Node.js can execute TypeScript files via tsx

---

### 3. Environment Configuration

**Goal**: Set up environment variable management with validation.

**Steps**:
1. Create `.env.example` file with all required environment variables (Supabase, Browserbase, LLM API keys)
2. Create `src/utils/config.ts` with `Config` interface and `loadConfig()` function
3. Implement environment variable validation (throw errors for missing required variables)
4. Create placeholder values in `.env.example` with descriptions

**Deliverable**: Environment variables can be loaded and validated on startup

---

### 4. Basic CLI Skeleton

**Goal**: Create a minimal CLI that can accept arguments but doesn't execute any logic yet.

**Steps**:
1. Install Commander.js: `npm install commander` and `npm install --save-dev @types/commander`
2. Create `src/cli/commands.ts` with basic command structure accepting game URL
3. Create `src/cli/parser.ts` with argument parsing logic
4. Create `qa.ts` entry point that initializes Commander and calls CLI module
5. Test CLI with `npx tsx qa.ts --help` and `npx tsx qa.ts <url>`

**Deliverable**: CLI accepts game URL argument and optional `--manifest` flag, displays help text

---

### 5. Database Schema Setup

**Goal**: Create database schema in Supabase for games, manifests, and test runs.

**Steps**:
1. Reference `_docs/database-schema.md` for complete schema definition
2. Create Supabase project (if not already created)
3. Run SQL migrations to create tables:
   - `games` table (id, game_url, name, game_type, description, active_manifest_id, timestamps)
   - `game_manifests` table (id, game_id, version_name, manifest_data, is_active, created_at, notes)
   - `test_runs` table (id, game_id, manifest_id, status, playability_score, issues, screenshots, console_logs, execution_method, duration_ms, created_at, metadata)
4. Create indexes for efficient querying
5. Create foreign key constraints
6. Create triggers (update_updated_at, update_last_tested, ensure_one_active_manifest)
7. Generate TypeScript types: `supabase gen types typescript > src/storage/types.ts`

**Deliverable**: Database schema created, types generated, Supabase ready for use

---

### 6. Core Module Placeholders

**Goal**: Create placeholder files in each module with proper file headers and basic exports.

**Steps**:
1. Create `src/agent/qa-agent.ts` with empty `QAAgent` class and file header
2. Create `src/browser/browser-client.ts` with empty `BrowserClient` class
3. Create `src/evaluation/llm-evaluator.ts` with empty `LLMEvaluator` class
4. Create `src/storage/database.ts` and `src/storage/file-storage.ts` with placeholder functions
5. Create `src/storage/types.ts` (will be populated with generated types from step 5)
6. Create `src/utils/errors.ts` with base `QAAgentError` class
7. Create `src/utils/constants.ts` with application constants (MAX_EXECUTION_TIME_MS, MAX_RETRY_ATTEMPTS, etc.)
8. Create `src/utils/logger.ts` with basic logging utility

**Deliverable**: All core modules exist with proper file headers and TypeScript exports

---

### 7. Error Handling Foundation

**Goal**: Establish custom error classes for different error scenarios.

**Steps**:
1. Create base `QAAgentError` class in `src/utils/errors.ts`
2. Create specific error classes: `BrowserError`, `EvaluationError`, `StorageError`, `ValidationError`
3. Each error class should accept message and optional context object
4. Export all error classes for use across modules

**Deliverable**: Custom error classes available throughout the codebase

---

### 8. Constants and Configuration

**Goal**: Define all application constants in a centralized location.

**Steps**:
1. Create `src/utils/constants.ts` with timeout values (MAX_EXECUTION_TIME_MS = 5 minutes)
2. Add retry configuration (MAX_RETRY_ATTEMPTS = 3)
3. Add screenshot configuration (SCREENSHOT_COUNT = 5, SCREENSHOT_INTERVAL_MS)
4. Add any other application-wide constants from project spec

**Deliverable**: All constants centralized and documented

---

## Integration Tasks

### Task 1: Verify CLI Integration
- CLI entry point (`qa.ts`) imports and calls CLI module
- Help command works: `npx tsx qa.ts --help`
- URL argument parsing works: `npx tsx qa.ts https://example.com/game`

### Task 2: Verify Module Imports
- Each placeholder module can be imported without errors
- TypeScript compilation succeeds with strict mode
- No circular dependencies exist

### Task 3: Verify Environment Setup
- `.env.example` documents all required variables
- `loadConfig()` function can read and validate environment variables
- Missing required variables throw descriptive errors

---

## Deliverables Checklist

- [ ] Complete directory structure matches project-rules.md
- [ ] TypeScript compiles with strict mode
- [ ] Node.js can execute `qa.ts` entry point via tsx
- [ ] CLI accepts arguments and displays help
- [ ] Database schema created in Supabase
- [ ] Database types generated and imported
- [ ] All core modules exist with proper file headers
- [ ] Environment variables can be loaded and validated
- [ ] Custom error classes are defined
- [ ] Constants are centralized
- [ ] `.gitignore` properly configured
- [ ] `.env.example` documents all required variables (including Supabase credentials)

---

## Next Phase

After completing Setup Phase, proceed to **MVP Phase** where we implement basic browser automation and evidence capture.

---

## Notes

- This phase focuses on structure, not functionality
- Don't implement any actual browser automation or LLM calls yet
- Ensure all code follows project-rules.md conventions (file headers, documentation, naming)
- Keep files under 500 lines (shouldn't be an issue for placeholders)
- Commit frequently with clear commit messages

