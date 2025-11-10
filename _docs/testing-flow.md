# Testing Flow: Complete End-to-End Process

This document explains the complete testing workflow from command execution to final results, detailing what happens at each step of the DreamUp QA Pipeline.

## Overview

The QA Pipeline uses **GPT-4o-mini vision** to analyze screenshots and make gameplay decisions, executing actions via **local Playwright** browser automation. The entire process is coordinated by the `QAAgent` class, which orchestrates browser initialization, game interaction, evidence collection, and evaluation.

---

## Phase 0: Command Execution & Initialization

### Step 0.1: CLI Entry Point (`qa.ts`)

**What happens:**
1. Loads environment variables from `.env` file using `dotenv`
2. Validates all required environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`
   - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
   - `LLM_PROVIDER` (must be `openai`)
   - `OPENAI_API_KEY`
3. Initializes database connection to Supabase
4. Configures logger (DEBUG mode if `DEBUG=true`)
5. Delegates to CLI command handler

**Key files:**
- `qa.ts` - Entry point
- `src/utils/config.ts` - Configuration validation

**Timeline event:** None (pre-timeline)

---

### Step 0.2: CLI Command Parsing (`src/cli/commands.ts`)

**What happens:**
1. Parses command line arguments:
   - `--url <game-url>` or positional argument
   - `--manifest <manifest-file>` (optional)
   - `--debug` (optional)
2. Validates URL format
3. Looks up game in database by URL
4. Handles manifest selection:
   - If `--manifest` provided: uses specified manifest file
   - If multiple manifests in DB: prompts user to select
   - If single manifest: uses automatically
   - If no manifest: tries to use placeholder-manifest.json
5. Creates test run ID (UUID)
6. Initializes `QAAgent` instance

**Key files:**
- `src/cli/commands.ts` - Command parsing and validation

**Timeline event:** None (pre-timeline)

---

## Phase 1: Browser Initialization

### Step 1.1: Create Agent State

**What happens:**
1. Creates initial `AgentState` object with:
   - Test ID (UUID)
   - Game URL
   - Game ID (from database)
   - Manifest ID and parsed manifest data
   - Start timestamp
   - Empty screenshots array
   - Empty timeline (with `test_start` event)

**Key files:**
- `src/agent/agent-state.ts` - State management

**Timeline event:** `test_start` - "Test execution started"

---

### Step 1.2: Launch Browser (`src/browser/browser-client.ts`)

**What happens:**
1. Launches local Chromium browser using Playwright:
   ```typescript
   chromium.launch({ headless: false })
   ```
2. Creates browser context with **fixed viewport** (1280x720):
   - Ensures consistent coordinate mapping for vision-based actions
   - Critical for GPT-4o-mini coordinate accuracy
3. Creates new page instance
4. Sets default timeout to 60 seconds for operations

**Key files:**
- `src/browser/browser-client.ts` - Browser initialization

**Timeline events:**
- `browser_init_start` - "Starting browser session initialization"
- `browser_init_complete` - "Browser session initialized"

---

### Step 1.3: Setup Console Log Collection

**What happens:**
1. Attaches console event listeners to capture:
   - `console.log()` messages
   - `console.error()` messages
   - `console.warn()` messages
   - Uncaught exceptions
   - Page errors
2. Stores logs in memory (`consoleLogEntries` array)
3. Logs will be finalized and uploaded to Supabase Storage later

**Key files:**
- `src/browser/console-logger.ts` - Console log collection

**Timeline event:** `console_logs_collected` - "Console log collection initialized"

---

## Phase 2: Game Loading

### Step 2.1: Navigate to Game URL

**What happens:**
1. Navigates browser to game URL using `page.goto()`
2. Uses retry logic with exponential backoff (up to 3 attempts):
   - Attempt 1: Immediate
   - Attempt 2: Wait 1 second
   - Attempt 3: Wait 2 seconds
3. Waits for `domcontentloaded` event (fast, usually < 1s)
4. Tracks actual load duration

**Key files:**
- `src/browser/browser-client.ts` - `loadGame()` method

**Timeline events:**
- `page_load_start` - "Navigating to game URL"
- `page_load_complete` - "Page finished loading"

---

### Step 2.2: Wait for Game Ready

**What happens:**
1. Multi-stage intelligent waiting:
   - **Stage 1:** Wait for DOM content loaded (fast)
   - **Stage 2:** Detect game container visibility:
     - Checks for common selectors: `section.scene`, `canvas`, `#game`, etc.
     - If found: Waits for visibility (max 2s)
     - If not found: Waits for short network idle (max 2s)
   - **Stage 3:** Additional wait time from manifest (`loadingDuration`) or default (3s)
2. This approach is faster than waiting for full network idle (which can take 30+ seconds for games with polling/WebSocket)

**Key files:**
- `src/browser/browser-client.ts` - `waitForLoad()` and `detectGameReady()` methods

**Timeline event:** `page_load_complete` - Includes configured vs actual duration

---

### Step 2.3: Capture Baseline Screenshot

**What happens:**

The baseline screenshot capture is a **3-stage process** tracked by separate timeline events:

**Stage 1: Initiate Capture**
- Fires event: `"Starting baseline screenshot capture"`
- Marks the beginning of the screenshot process
- Called **before** any browser operations

**Stage 2: Browser Capture (Local)**
- Captures screenshot using multi-strategy approach:
  - **Strategy 1:** Try game container selectors (DOM-based games)
  - **Strategy 2:** Try iframes (embedded games)
  - **Strategy 3:** Try canvas elements (HTML5 games)
  - **Strategy 4:** Fall back to full page viewport
- Converts screenshot to PNG buffer in memory
- Fires event: `"Screenshot buffer captured"`
- Includes metadata:
  - Buffer size (bytes)
  - Capture duration (ms)
  - Screenshot index (0)

**Stage 3: Upload to Storage (Remote)**
- Uploads PNG buffer to Supabase Storage
- Storage path: `artifacts/{testId}/screenshots/0-{timestamp}.png`
- Gets public URL back from storage
- Stores URL in agent state
- Fires event: `"Baseline screenshot uploaded"`
- Includes metadata:
  - Public URL
  - Capture duration (ms)
  - Upload duration (ms)
  - Total duration (ms)

**Why three events?**
- **Performance tracking:** Separates capture time (browser operation) from upload time (network operation)
- **Debugging:** Can identify if failures occur during capture vs upload
- **Transparency:** Shows exactly where time is spent in the screenshot process

**Key files:**
- `src/browser/screenshot-capture.ts` - Screenshot capture utilities
- `src/storage/file-storage.ts` - File upload to Supabase

**Timeline events:**
- `screenshot_captured` - "Starting baseline screenshot capture" (initiation)
- `screenshot_captured` - "Screenshot buffer captured" (browser capture complete, buffer in memory)
- `screenshot_captured` - "Baseline screenshot uploaded" (upload complete, URL available)

---

## Phase 3: Start Button Detection (Optional)

### Step 3.1: Vision-Based Button Detection

**What happens:**
1. Captures screenshot of current page state
2. Converts screenshot to base64 string
3. Sends to GPT-4o-mini vision API with prompt:
   > "Find the start/play button in this screenshot. Return the center coordinates (x, y) if found, or null if not found."
4. GPT-4o-mini analyzes the screenshot and returns JSON:
   ```json
   {
     "found": true,
     "x": 640,
     "y": 400,
     "description": "Start button found at center"
   }
   ```
5. Coordinates are clamped to viewport bounds (0-1279 for x, 0-719 for y)

**Key files:**
- `src/agent/vision-action-planner.ts` - `findStartButtonCoordinates()`
- `src/browser/ui-pattern-detector.ts` - `findStartButton()`

**Timeline event:** `start_button_search_start` - "Searching for start button using GPT-4o-mini vision"

---

### Step 3.2: Handle Start Button Result

**If button found:**
1. Logs button coordinates
2. Clicks at coordinates using `page.mouse.click(x, y)`
3. Waits `START_BUTTON_WAIT_MS` (default: 3000ms) for game transition
4. Captures post-click screenshot
5. Stores screenshot URL in state

**If button NOT found:**
1. Logs warning (not error - some games don't have start buttons)
2. Captures diagnostic screenshot
3. Stores screenshot URL in state
4. Continues to gameplay (does not fail test)

**Key files:**
- `src/browser/ui-pattern-detector.ts` - `clickElement()`
- `src/agent/qa-agent.ts` - Start button handling logic

**Timeline events:**
- `start_button_found` - "Start button detected" (if found)
- `start_button_not_found` - "No start button found - game may start automatically" (if not found)
- `start_button_clicked` - "Start button clicked successfully" (if clicked)
- `screenshot_captured` - "Post-click screenshot captured" (if clicked)

---

## Phase 4: Gameplay Simulation

### Step 4.1: Initialize Gameplay Context

**What happens:**
1. Extracts game context from manifest:
   - Game type (platformer, puzzle, etc.)
   - Available controls (ArrowUp, Space, etc.)
   - Gameplay goal/objective
   - AI decision interval (default: 2000ms)
2. Initializes OpenAI client for GPT-4o-mini
3. Determines gameplay duration from manifest or default (45 seconds)

**Key files:**
- `src/agent/qa-agent.ts` - `simulateGameplay()` method
- `src/utils/manifest-parser.ts` - Manifest parsing utilities

**Timeline event:** None (gameplay loop starts)

---

### Step 4.2: Vision-Based Gameplay Loop

**The core gameplay loop runs until duration expires:**

**For each decision cycle:**

1. **Capture Screenshot**
   - Captures screenshot of current game state
   - Converts to base64 PNG string
   - Uses same multi-strategy approach as baseline screenshot

2. **Decide Next Action (GPT-4o-mini Vision)**
   - Sends screenshot + game context to GPT-4o-mini with system prompt:
     > "You are playing a browser game. Based on the screenshot, decide the next action to take."
   - Game context includes:
     - Game type
     - Available controls
     - Gameplay goal
     - Viewport size (1280x720)
   - GPT-4o-mini returns structured JSON action:
     ```json
     {
       "action": "click",
       "x": 450,
       "y": 300,
       "description": "Clicking on enemy to attack"
     }
     ```
   - Supported actions:
     - `click` - Click at coordinates (x, y)
     - `key_press` - Press keyboard key (ArrowUp, Space, etc.)
     - `wait` - Wait for duration (ms)
     - `scroll` - Scroll page

3. **Execute Action**
   - **If `click`:** `page.mouse.click(x, y)`
   - **If `key_press`:** `page.keyboard.press(key)`
   - **If `wait`:** `page.waitForTimeout(duration)`
   - **If `scroll`:** `page.mouse.wheel(0, 300)` (scroll down)
   - Handles action errors gracefully (logs warning, continues)

4. **Store Screenshot**
   - Uploads screenshot to Supabase Storage
   - Stores URL in agent state
   - Screenshots are tightly coupled with actions (captured exactly when decision was made)

5. **Wait for Next Decision**
   - Waits `aiDecisionInterval` (default: 2000ms) before next cycle
   - Or remaining time if less than interval

**Key files:**
- `src/agent/vision-action-planner.ts` - `decideNextAction()`
- `src/agent/qa-agent.ts` - `simulateGameplay()` method

**Timeline events:**
- Multiple `screenshot_captured` events (one per decision cycle)

---

### Step 4.3: Gameplay Loop Completion

**What happens:**
1. Logs total decisions made
2. Logs total duration
3. Logs number of screenshots captured
4. Returns updated agent state with all gameplay screenshots

**Key files:**
- `src/agent/qa-agent.ts` - `simulateGameplay()` method

**Timeline event:** None (gameplay completes, moves to monitoring)

---

## Phase 5: Monitoring & Additional Screenshots

### Step 5.1: Capture Additional Screenshots (If Needed)

**What happens:**
1. Checks if manifest has `screenshotIntervals` defined
2. **If time-based intervals specified:**
   - Captures screenshots at specified time intervals
   - Example: `[5000, 10000, 15000]` captures at 5s, 10s, 15s
3. **If no intervals specified:**
   - Captures single final screenshot
4. Only captures if minimum screenshot count not met (default: 3 screenshots)

**Key files:**
- `src/agent/qa-agent.ts` - `captureScreenshotsTimeBased()` method

**Timeline events:**
- Multiple `screenshot_captured` events (if time-based)

---

### Step 5.2: Finalize Console Logs

**What happens:**
1. Collects all console log entries from memory
2. Formats logs into text file
3. Uploads to Supabase Storage at path: `artifacts/{testId}/console-logs.txt`
4. Stores public URL in agent state

**Key files:**
- `src/browser/console-logger.ts` - `finalizeConsoleLogs()`

**Timeline event:** None (logs finalized)

---

## Phase 6: LLM Evaluation

### Step 6.1: Prepare Evaluation Evidence

**What happens:**
1. Collects all evidence:
   - All screenshot URLs from state
   - Formatted console logs
   - Game metadata (name, type, URL)
   - Manifest data (if available)
2. Summarizes console logs if too long (max 5000 chars)
3. Formats screenshots for LLM vision API

**Key files:**
- `src/evaluation/llm-evaluator.ts` - `evaluate()` method
- `src/evaluation/prompt-builder.ts` - Evidence formatting

**Timeline event:** `evaluation_start` - "Starting LLM evaluation"

---

### Step 6.2: Send to GPT-4o for Evaluation

**What happens:**
1. Constructs evaluation prompt with:
   - System message explaining evaluation criteria
   - User message with game context
   - All screenshots as image URLs
   - Console logs summary
   - Manifest data (if available)
2. Sends to GPT-4o (not mini - uses full model for evaluation)
3. Requests structured JSON response with:
   - Status (pass/fail/error/timeout)
   - Playability score (0-100)
   - Issues array
   - Reasoning
4. Includes retry logic with exponential backoff (up to 3 attempts)

**Key files:**
- `src/evaluation/llm-evaluator.ts` - `evaluate()` method
- `src/evaluation/prompt-builder.ts` - Prompt construction

**Timeline event:** `evaluation_complete` - "LLM evaluation completed"

---

### Step 6.3: Parse Evaluation Results

**What happens:**
1. Parses JSON response from GPT-4o
2. Validates response structure using Zod schema
3. Converts status to test result format
4. Combines LLM issues with console errors:
   - Adds console errors to issues list (max 3 errors)
5. Creates final test result object

**Key files:**
- `src/evaluation/result-parser.ts` - Response parsing and validation
- `src/agent/qa-agent.ts` - Result aggregation

**Timeline event:** None (result created)

---

## Phase 7: Results & Cleanup

### Step 7.1: Save Results to Database

**What happens:**
1. Creates `test_runs` record in Supabase with:
   - Game ID
   - Manifest ID (if used)
   - Status (pass/fail/error/timeout)
   - Playability score
   - Issues array
   - Screenshot URLs
   - Console logs URL
   - Execution method (`cli`)
   - Duration (ms)
   - Metadata:
     - Test ID
     - Game URL
     - Timeline events
     - Browserbase URL (null for local)
2. Updates game's `last_tested_at` timestamp

**Key files:**
- `src/agent/qa-agent.ts` - `saveResultsToDatabase()` method
- `src/storage/database.ts` - Database operations

**Timeline event:** None (results saved)

---

### Step 7.2: Format Output

**What happens:**
1. Creates final result object with:
   - Status
   - Playability score
   - Issues
   - Screenshots
   - Console logs URL
   - Duration
   - Game URL
   - Game name
   - Test ID
2. Outputs JSON to stdout (CLI)
3. Exits with appropriate code:
   - `0` if pass or fail (test completed)
   - `1` if error or timeout

**Key files:**
- `src/cli/output-formatter.ts` - Result formatting
- `src/cli/commands.ts` - CLI output

**Timeline event:** `test_complete` - "Test execution completed"

---

### Step 7.3: Cleanup

**What happens:**
1. Closes browser session:
   - Closes browser instance
   - Releases all resources
   - Clears page/context references
2. Cleanup happens in `finally` block (always executes, even on errors)

**Key files:**
- `src/browser/browser-client.ts` - `closeSession()` method
- `src/agent/qa-agent.ts` - Cleanup in `finally` block

**Timeline event:** None (post-timeline)

---

## Timeout Handling

**Throughout the entire process:**
- A timeout promise runs concurrently with test execution
- Maximum execution time: 5 minutes (300,000ms)
- If timeout occurs:
  - Browser session is closed
  - Test result is marked as `timeout`
  - Partial results (screenshots, logs) are saved
  - Timeline events show timeout point

**Key files:**
- `src/agent/qa-agent.ts` - `createTimeout()` method
- `src/utils/constants.ts` - `MAX_EXECUTION_TIME_MS`

---

## Error Handling

**At each phase:**
- Errors are caught and logged
- Agent state tracks error context (phase, message, metadata)
- Partial results are saved (screenshots captured so far)
- Browser session is always closed (finally block)
- Test result is marked as `error` with error message

**Key files:**
- `src/agent/qa-agent.ts` - Error handling throughout
- `src/utils/errors.ts` - Custom error types

---

## Key Differences from Previous Implementation

### Before (Browserbase + Stagehand):
- Remote browser infrastructure (Browserbase)
- AI-powered actions via Stagehand's `act()` method
- Internal screenshot capture (not visible in state)
- Cost per browser-hour

### After (Local Playwright + GPT-4o-mini Vision):
- **Local browser execution** (no remote costs)
- **Explicit vision-based decisions** (screenshot → GPT-4o-mini → action)
- **Tight screenshot-action coupling** (screenshots captured exactly when decisions made)
- **Coordinate-based actions** (works with canvas games)
- **Transparent decision-making** (GPT-4o-mini explains each action)
- **Cost-effective** (GPT-4o-mini vision is cheaper than Stagehand)

---

## Timeline Events Summary

The complete timeline tracks every major event:

1. `test_start` - Test execution started
2. `browser_init_start` - Starting browser session initialization
3. `browser_init_complete` - Browser session initialized
4. `console_logs_collected` - Console log collection initialized
5. `page_load_start` - Navigating to game URL
6. `page_load_complete` - Page finished loading
7. `screenshot_captured` - Screenshot captured (multiple)
8. `start_button_search_start` - Searching for start button
9. `start_button_found` OR `start_button_not_found` - Button detection result
10. `start_button_clicked` - Start button clicked (if found)
11. `phase_change` - Phase transitions
12. `evaluation_start` - Starting LLM evaluation
13. `evaluation_complete` - LLM evaluation completed
14. `test_complete` - Test execution completed

All events include timestamps, elapsed time, and optional metadata.

---

## Performance Characteristics

- **Browser initialization:** ~1-2 seconds
- **Page load:** ~2-5 seconds (depending on game)
- **Screenshot capture:** ~50-200ms per screenshot
- **GPT-4o-mini vision call:** ~1-3 seconds per decision
- **Action execution:** ~50-100ms per action
- **Gameplay loop:** ~2-3 seconds per cycle (including vision call)
- **Evaluation:** ~5-10 seconds (GPT-4o with multiple screenshots)

**Total test duration:** Typically 60-90 seconds for a 45-second gameplay test.

---

## Output Format

The final JSON output includes:

```json
{
  "status": "pass" | "fail" | "error" | "timeout",
  "playability_score": 0-100,
  "issues": ["issue1", "issue2"],
  "screenshots": ["url1", "url2"],
  "console_logs": "url" | null,
  "duration_ms": 12345,
  "game_url": "https://...",
  "game_name": "Game Name",
  "test_id": "uuid"
}
```

This format is consistent across CLI, Lambda, and Web UI execution methods.

