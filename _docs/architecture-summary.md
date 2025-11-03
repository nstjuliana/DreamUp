# Architecture Summary: DreamUp QA Pipeline

**Last Updated:** November 3, 2025  
**Version:** 2.0 (Updated with Games & Manifest Management)

## Overview

The DreamUp QA Pipeline is an AI-powered browser game testing system that autonomously tests games through browser automation, captures evidence, evaluates playability, and stores results for analysis.

## Key Architectural Concepts

### 1. Games as First-Class Entities

Games are stored in the database as central entities with:
- **Unique URL** (natural key)
- **Name** and **Type** (puzzle, platformer, idle, shooter, rpg, other)
- **Description** (optional)
- **Active Manifest** reference
- **Last Tested timestamp**

All test runs are linked to game records, enabling:
- Test history per game
- Playability trends over time
- Centralized game management

### 2. Version-Controlled Manifests

Each game can have **multiple manifest versions** (1-to-many relationship):
- **Manifest data** (JSONB): Controls, start button config, game states
- **Version name**: Human-readable identifier (e.g., "v2.0", "After Update")
- **Active flag**: Only one manifest active per game
- **Notes**: Description of what changed in this version

**Benefits:**
- Handle game updates that change controls/UI
- Track manifest evolution over time
- Test with different manifest versions
- Record which manifest was used for each test

### 3. Test Results with Full Context

Test runs store:
- Link to **game** (which game was tested)
- Link to **manifest** version used (optional)
- Execution method (CLI/Lambda/Web)
- Full results (status, playability score, issues, screenshots, logs)
- Duration and metadata

## Database Schema

Three main tables with relationships:

```
games (1) ←──── (many) game_manifests
  │
  │ (1)
  │
  ↓ (many)
test_runs
```

See `_docs/database-schema.md` for complete schema with indexes, constraints, and triggers.

## Execution Methods

### CLI Execution
```bash
bun run qa.ts <game-url>
```

**Flow:**
1. Look up game by URL in database
2. If not found: Error (games must be created via Web UI)
3. If found: Prompt for manifest selection (or use --manifest flag)
4. Execute QA agent with game + manifest
5. Save results to database
6. Output JSON to stdout

**CLI Flags:**
- `--manifest <version>`: Use specific manifest version
- `--no-manifest`: Skip manifest usage

### Lambda Execution

**Event Payload:**
```json
{
  "gameId": "uuid",
  "manifestId": "uuid"  // optional
}
```

**Flow:**
1. Receive gameId + optional manifestId
2. Look up game and manifest from database
3. Execute QA agent
4. Save results to database
5. Return result object

### Web UI Execution (Stretch)

**Pages:**
- **Games Library**: Browse all games
- **Create Game**: Add game with embedded manifest generator
- **Game Detail**: View game info, manifests, test history
- **Edit/Add Manifest**: Create/edit manifest versions
- **Run Test**: Select game + manifest, execute test
- **Test Results**: View results with full context

## Game Manifest Schema

Manifests provide game-specific information to improve testing:

```typescript
interface GameManifest {
  version: "1.0";
  gameType: "puzzle" | "platformer" | "idle" | "shooter" | "rpg" | "other";
  controls: {
    primary: string[];      // Key names (e.g., ["ArrowUp", "Space"])
    secondary?: string[];
    mouse?: boolean;
    mouseActions?: ("click" | "drag" | "scroll")[];
  };
  startButton?: {
    selector?: string;      // CSS selector
    text?: string;          // Button text
    position?: string;      // "center" | "top" | "bottom" | etc.
    waitAfterClick?: number;
  };
  gameStates?: GameState[];  // Sequence of screens/phases
  loadingDuration?: number;
  notes?: string;
}
```

See `_docs/game-manifest-schema.md` for complete schema with examples.

## Agent Workflow

### With Manifest

```
1. Initialize Browser
2. Load Game URL
3. Read Manifest
4. Use manifest to locate start button (fallback to AI detection)
5. Click start button
6. Use manifest controls to simulate gameplay
7. Navigate through manifest-defined game states
8. Capture screenshots at key points
9. Collect console logs
10. Evaluate with LLM (include manifest context)
11. Save results linked to game + manifest version
12. Return structured result
```

### Without Manifest

```
1. Initialize Browser
2. Load Game URL
3. Use AI detection to find start button
4. Click start button
5. Use heuristic controls (arrow keys, space, clicks)
6. Detect game state changes via screenshots
7. Capture screenshots at intervals
8. Collect console logs
9. Evaluate with LLM
10. Save results linked to game (no manifest)
11. Return structured result
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Bun | Fast TypeScript execution |
| **Database** | Supabase (PostgreSQL) | Games, manifests, test results |
| **File Storage** | Supabase Storage | Screenshots, console logs |
| **Browser Automation** | Browserbase + Stagehand | Headless browser control |
| **AI/LLM** | Vercel AI SDK | Game evaluation |
| **CLI** | Commander.js | Command-line interface |
| **Web UI** | Next.js (App Router) | Game/manifest management (stretch) |
| **Language** | TypeScript (strict mode) | Type-safe codebase |

## Data Flow

### Creating a Game (Web UI)
```
User → Web UI → Create Game Page → Save → Database (games + game_manifests)
```

### Running a Test (CLI)
```
User → CLI → Lookup Game → Prompt Manifest → QA Agent → Browser → Capture Evidence → LLM Evaluation → Save Results → Database (test_runs)
```

### Running a Test (Lambda)
```
Trigger → Lambda Handler → Lookup Game + Manifest → QA Agent → Browser → Capture Evidence → LLM Evaluation → Save Results → Database (test_runs)
```

### Viewing Results (Web UI)
```
User → Web UI → Games Library → Game Detail → Test History → Test Results Page → Display (from database + storage)
```

## Key Features

### Core Features (MVP + Enhancements)
- ✅ Browser automation with Browserbase/Stagehand
- ✅ Game interaction (buttons, keyboard, mouse)
- ✅ Evidence capture (screenshots, console logs)
- ✅ AI evaluation with LLM
- ✅ Database storage (games, manifests, test results)
- ✅ File storage (screenshots, logs in Supabase Storage)
- ✅ CLI execution with game lookup
- ✅ Lambda execution support
- ✅ Error handling and retry logic
- ✅ Manifest support for improved accuracy

### Stretch Features
- 🎯 Web Dashboard with Games Library
- 🎯 Embedded Manifest Generator (visual, no JSON editing)
- 🎯 Manifest Versioning UI
- 🎯 Batch Testing (multiple games)
- 🎯 GIF Recording
- 🎯 Advanced Metrics (FPS, load time)
- 🎯 Settings/Configuration
- 🎯 LLM Model Comparison

## User Journeys

### 1. CLI User (QA Engineer)
1. Create game via Web UI (one-time setup)
2. Run test: `bun run qa.ts <game-url>`
3. Select manifest version from prompt
4. View results in terminal (JSON)
5. View detailed results in Web UI later

### 2. Web UI User (QA Engineer)
1. Navigate to Games Library
2. Click "Create New Game"
3. Enter game info + create manifest (optional)
4. Save game
5. From Game Detail page, click "Run Test"
6. View results immediately
7. Create additional manifest versions as game evolves

### 3. Lambda Automation
1. Game dev agent generates new game
2. Triggers Lambda with gameId
3. Lambda looks up game + active manifest
4. Runs test automatically
5. Results stored in database
6. QA team reviews via Web UI

## File Structure

```
dreamup-qa/
├── _docs/                          # Documentation
│   ├── DreamUp - Gauntlet C3 Project 1.md
│   ├── architecture-summary.md     # This file
│   ├── database-schema.md          # Database schema details
│   ├── game-manifest-schema.md     # Manifest format specification
│   ├── user-flow.md                # User journey documentation
│   ├── tech-stack.md               # Technology decisions
│   ├── project-rules.md            # Coding standards
│   └── phases/                     # Implementation phases
│       ├── setup-phase.md
│       ├── mvp-phase.md
│       ├── enhancement-phase-1.md
│       ├── enhancement-phase-2.md
│       └── stretch-phase.md
│
├── src/
│   ├── agent/                      # QA agent orchestration
│   ├── browser/                    # Browser automation
│   ├── evaluation/                 # LLM evaluation
│   ├── storage/                    # Database & file storage
│   │   ├── database.ts
│   │   ├── file-storage.ts
│   │   └── types.ts                # Generated from Supabase schema
│   ├── cli/                        # CLI commands
│   ├── lambda/                     # Lambda handlers
│   └── utils/                      # Shared utilities
│
├── artifacts/                      # Local artifact fallback
├── qa.ts                           # CLI entry point
├── lambda.ts                       # Lambda entry point
└── package.json
```

## Security & Access Control

**Current (MVP):**
- No authentication
- Public CRUD access to all tables
- Anyone can create/edit/delete games and manifests

**Future (If Auth Added):**
- User authentication via Supabase Auth
- Row Level Security (RLS) policies
- Per-user game ownership
- Public/private manifest sharing

## Performance Considerations

- **Database**: Indexes on foreign keys, timestamps, and frequently queried columns
- **Connection Pooling**: Required for Lambda to avoid connection exhaustion
- **Storage**: Artifacts in Supabase Storage, not database
- **LLM Caching**: Cache responses for identical evidence
- **Timeouts**: 5-minute max execution per test
- **Retry Logic**: Max 3 retries for failed operations

## Error Handling

- **Game Not Found**: Clear error with link to create game
- **Manifest Selection**: Prompt user or use active manifest
- **Browser Failures**: Retry up to 3 times with exponential backoff
- **LLM Failures**: Fallback to heuristic-based evaluation
- **Storage Failures**: Graceful degradation (save logs, continue)
- **Timeouts**: Return partial results with timeout status

## Cost Management

- **Browserbase**: ~$X per browser-hour (monitor usage)
- **LLM API**: Primary cost driver (use cheaper models for iteration)
- **Supabase**: Generous free tier (monitor storage/bandwidth)
- **Lambda**: Minimal cost for low volume

**Optimization Strategies:**
- Use cheaper LLM models where possible
- Cache LLM responses for identical evidence
- Compress images before upload
- Implement artifact cleanup policies (30-90 day retention)

## Testing Strategy

**Diverse Game Types:**
1. Simple Puzzle (tic-tac-toe) - Mouse clicks only
2. Platformer - Keyboard controls, physics
3. Idle/Clicker - Minimal interaction
4. Broken Game - Intentional bugs to test failure detection
5. Complex Game - Multiple levels/screens

**Success Criteria:**
- 3+ diverse games tested successfully
- 80%+ accuracy on playability assessment
- All failure modes handled gracefully

## Documentation References

- **Database Schema**: `_docs/database-schema.md`
- **Manifest Schema**: `_docs/game-manifest-schema.md`
- **User Flows**: `_docs/user-flow.md`
- **Tech Stack Details**: `_docs/tech-stack.md`
- **Implementation Phases**: `_docs/phases/`
- **Project Rules**: `_docs/project-rules.md`

## Summary of Architectural Benefits

1. **Games as Central Entities**: Enables test history, playability trends, organized management
2. **Manifest Versioning**: Handles game updates without losing history
3. **Test Context**: Every test run records exactly what was tested and how
4. **Flexible Execution**: CLI for manual testing, Lambda for automation, Web UI for convenience
5. **Fallback Strategies**: Works with or without manifests, degrades gracefully
6. **Type Safety**: Generated TypeScript types from database schema
7. **Scalability**: Database-backed with proper indexing and connection pooling
8. **Maintainability**: Clear separation of concerns, modular architecture

---

This architecture provides a solid foundation for autonomous browser game testing while remaining flexible for future enhancements and integrations.

