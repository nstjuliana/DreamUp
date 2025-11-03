# Phase 1: Setup Phase

**Goal**: Establish a barebones project structure that functions at a basic level but isn't fully usable. This phase creates the foundation for all subsequent development.

**Timeline**: Day 1 (Setup + Basic Agent foundation)

**Success Criteria**: 
- Project structure exists and follows conventions
- TypeScript/Bun environment is configured
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

### 2. TypeScript and Bun Configuration

**Goal**: Set up TypeScript with strict mode and Bun runtime configuration.

**Steps**:
1. Initialize `package.json` with Bun as runtime, project metadata, and basic scripts
2. Configure `tsconfig.json` with strict mode, proper module resolution, and output settings
3. Install TypeScript types: `@types/node` (if needed for compatibility)
4. Create `.bun` directory in `.gitignore` (cache directory)

**Deliverable**: TypeScript compiles successfully with strict mode, Bun can execute TypeScript files

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
1. Install Commander.js: `bun add commander` and `@types/commander`
2. Create `src/cli/commands.ts` with basic command structure accepting game URL
3. Create `src/cli/parser.ts` with argument parsing logic
4. Create `qa.ts` entry point that initializes Commander and calls CLI module
5. Test CLI with `bun run qa.ts --help` and `bun run qa.ts <url>`

**Deliverable**: CLI accepts game URL argument and optional `--manifest` flag, displays help text

---

### 5. Core Module Placeholders

**Goal**: Create placeholder files in each module with proper file headers and basic exports.

**Steps**:
1. Create `src/agent/qa-agent.ts` with empty `QAAgent` class and file header
2. Create `src/browser/browser-client.ts` with empty `BrowserClient` class
3. Create `src/evaluation/llm-evaluator.ts` with empty `LLMEvaluator` class
4. Create `src/storage/database.ts` and `src/storage/file-storage.ts` with placeholder functions
5. Create `src/utils/errors.ts` with base `QAAgentError` class
6. Create `src/utils/constants.ts` with application constants (MAX_EXECUTION_TIME_MS, MAX_RETRY_ATTEMPTS, etc.)
7. Create `src/utils/logger.ts` with basic logging utility

**Deliverable**: All core modules exist with proper file headers and TypeScript exports

---

### 6. Error Handling Foundation

**Goal**: Establish custom error classes for different error scenarios.

**Steps**:
1. Create base `QAAgentError` class in `src/utils/errors.ts`
2. Create specific error classes: `BrowserError`, `EvaluationError`, `StorageError`, `ValidationError`
3. Each error class should accept message and optional context object
4. Export all error classes for use across modules

**Deliverable**: Custom error classes available throughout the codebase

---

### 7. Constants and Configuration

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
- Help command works: `bun run qa.ts --help`
- URL argument parsing works: `bun run qa.ts https://example.com/game`

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
- [ ] Bun can execute `qa.ts` entry point
- [ ] CLI accepts arguments and displays help
- [ ] All core modules exist with proper file headers
- [ ] Environment variables can be loaded and validated
- [ ] Custom error classes are defined
- [ ] Constants are centralized
- [ ] `.gitignore` properly configured
- [ ] `.env.example` documents all required variables

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

