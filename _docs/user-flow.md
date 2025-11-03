# User Flow: DreamUp QA Pipeline

## Overview

This document defines the user journey through the DreamUp QA Pipeline application, detailing how users interact with different segments of the system and how features connect to one another. This serves as a guide for building project architecture and UI elements.

The application supports three primary execution methods:
- **CLI/Script Execution**: Manual testing by QA engineers
- **Autonomous/Lambda Execution**: Automated testing triggered when developers submit new games
- **Web UI**: Visual interface for submitting tests and viewing results

All execution paths share the same core QA agent logic and store results in a database for unified access.

## User Personas

### 1. QA Engineer (Primary User)
- Performs ad-hoc manual testing of browser games
- Uses CLI/script execution for immediate feedback
- Reviews results through CLI output or web UI
- May test multiple games in sequence

### 2. Automated System (Secondary User)
- Lambda function triggered when developer submits new game
- Runs QA tests automatically to ensure playability/compatibility
- Stores results in database for later review
- Operates without direct user interaction

## Core User Journeys

### Journey 1: CLI/Script Execution

**Entry Point:**
- QA engineer has a game URL to test
- Optional: Has `game-manifest.json` file with game type and key controls

**Execution Steps:**

1. **Command Execution**
   - User runs one of:
     - `bun run qa.ts <game-url>`
     - `npx tsx qa.ts <game-url>`
     - `qa-agent <game-url>`
   - Optional: Include `--manifest <path-to-game-manifest.json>`

2. **Agent Initialization**
   - System loads game URL in headless browser (Browserbase/Stagehand)
   - If manifest provided, system reads game type and control mappings

3. **Observation Phase**
   - Wait for initial render (timeout: configurable, default based on spec)
   - Capture baseline screenshot
   - Detect UI patterns (start buttons, menus, game over screens)

4. **Interaction Phase**
   - Find and click start/play buttons
   - Simulate gameplay based on:
     - Controls found in UI
     - Controls defined in `game-manifest.json` (if provided)
   - Execute basic actions: arrow keys, spacebar, mouse clicks
   - Navigate 2-3 screens/levels if applicable

5. **Monitoring Phase**
   - Capture 3-5 timestamped screenshots throughout session
   - Collect console logs and error messages
   - Detect crashes, freezes, or errors via:
     - Console error logs
     - Page state changes
     - Screenshot comparison

6. **Evaluation Phase**
   - Submit evidence (screenshots + logs) to LLM
   - LLM assesses:
     - "Does the game load successfully?"
     - "Are controls responsive?"
     - "Did the game complete without crashes?"
   - Generate structured JSON with pass/fail, confidence scores, issue descriptions

7. **Reporting Phase**
   - Output JSON to stdout: `{status, playability_score, issues[], screenshots[], timestamp}`
   - Save results to database (for web UI access)
   - Save artifacts (screenshots, logs) to structured output directory

**Exit Point:**
- User reviews JSON output in terminal
- User can view detailed results later via web UI
- Results persist in database

**Error Handling:**
- Max execution time: 5 minutes per game
- Retry failed loads up to 3 times
- Graceful degradation if screenshots fail
- If game fails to load after retries, return error status with description

---

### Journey 2: Autonomous/Lambda Execution

**Entry Point:**
- Developer submits new game to DreamUp system
- Lambda function triggered automatically
- Game URL available in trigger payload
- Optional: `game-manifest.json` available from game generation process

**Execution Steps:**

1. **Trigger Reception**
   - Lambda function receives game submission event
   - Extracts game URL from payload
   - Retrieves `game-manifest.json` if available

2. **Agent Execution**
   - Same process flow as CLI journey (steps 2-6)
   - Initialize → Observe → Interact → Monitor → Evaluate → Report

3. **Result Storage**
   - Results automatically saved to database
   - Artifacts (screenshots, logs) stored in structured directory
   - Result includes link back to original game submission

4. **Notification (Optional)**
   - If test fails (playability_score below threshold), trigger alert
   - Notification could be: email, Slack message, or status update in game dev system

**Exit Point:**
- Results available in database
- Results visible in web UI for QA team review
- Optional notifications sent if failures detected

**Key Differences from CLI:**
- No user interaction required
- Results always stored (CLI can optionally skip storage)
- Can trigger follow-up actions based on results

---

### Journey 3: Web UI Journey (MVP)

#### 3.1 Landing/Dashboard View

**Entry Point:**
- User navigates to `localhost` (or deployed URL)

**View Components:**
- Test history list showing all past test runs
- Each entry displays:
  - Game URL (truncated with tooltip for full URL)
  - Test status (Pass/Fail/In Progress)
  - Playability score
  - Timestamp
  - Duration

**Interactions:**
- Click on any test result to view details (see Journey 3.3)
- Filter tests by:
  - Status (Pass/Fail/All)
  - Date range
  - Playability score threshold
- Search by game URL
- Sort by timestamp (newest/oldest first) or playability score

**Navigation:**
- "New Test" button/link to submit test flow

---

#### 3.2 Submit Test Flow

**Entry Point:**
- User clicks "New Test" from dashboard or navigates to `/test/new`

**Form Steps:**

1. **Game URL Input**
   - Text input field for game URL
   - Validation: Must be valid URL format
   - Optional: Preview/test URL accessibility

2. **Manifest Upload (Optional)**
   - File upload input for `game-manifest.json`
   - Drag-and-drop support
   - Validation: Must be valid JSON format
   - Display parsed game type and controls preview if valid

3. **Submit Action**
   - User clicks "Run Test" button
   - Form validation confirms URL is provided

4. **Execution Trigger**
   - System triggers same QA agent execution (API call or direct invocation)
   - Same process flow as CLI journey (Initialize → Observe → Interact → Monitor → Evaluate → Report)

5. **Progress Display**
   - Show loading/progress state:
     - "Initializing browser..."
     - "Loading game..."
     - "Interacting with game..."
     - "Evaluating results..."
   - Optional: Real-time status updates via WebSocket or polling

6. **Result Display**
   - Once complete, automatically redirect to results view
   - New test entry appears in dashboard

**Error Handling:**
- If URL is invalid, show validation error
- If test fails to start, show error message
- If test times out, show timeout error and partial results if available

---

#### 3.3 View Results Flow

**Entry Point:**
- User clicks on test result from dashboard
- Or navigates directly to `/test/:id`

**View Components:**

1. **Summary Section**
   - Test metadata:
     - Game URL (clickable link)
     - Timestamp
     - Duration
     - Test ID
   - Overall status badge (Pass/Fail)
   - Playability score (visual indicator)

2. **Evaluation Results**
   - Display structured JSON results:
     - Status
     - Playability score (0-100 or similar scale)
     - Issues array (list of detected problems)
     - Confidence scores for each assessment

3. **Screenshots Gallery**
   - Display 3-5 timestamped screenshots
   - Thumbnail grid view with click-to-expand
   - Each screenshot labeled with timestamp
   - Lightbox/modal for full-size viewing

4. **Console Logs**
   - Expandable section showing console logs captured during test
   - Filterable by log level (error, warn, info)
   - Syntax highlighting for readability

5. **Artifacts Download**
   - Download button to get all artifacts (screenshots, logs, JSON report) as zip

**Navigation:**
- Back button to return to dashboard
- "Run New Test" button to start another test

---

### Journey 4: Web UI Journey (Stretch Features)

#### 4.1 Batch Testing Interface

**Entry Point:**
- User navigates to "Batch Test" from main navigation
- Or special button/link from dashboard

**Form Steps:**

1. **Multiple URL Input**
   - Text area or multiple input fields for game URLs
   - One URL per line or separate inputs
   - Optional: Upload CSV file with URLs and manifest paths
   - Validation: All URLs must be valid format

2. **Batch Configuration (Optional)**
   - Set execution order (sequential vs parallel)
   - Set batch timeout (max time for entire batch)
   - Configure concurrency limits

3. **Submit Batch**
   - User clicks "Run Batch Test"
   - System queues all tests

4. **Progress Tracking**
   - Table/list view showing each test in batch:
     - Game URL
     - Status (Queued/In Progress/Complete/Failed)
     - Progress bar for in-progress tests
     - Playability score (when complete)
   - Real-time updates as tests complete
   - Ability to cancel pending tests

5. **Aggregated Results**
   - Summary statistics:
     - Total tests: X
     - Passed: Y
     - Failed: Z
     - Average playability score
   - Expandable view to see individual test results
   - Export aggregated report (CSV, JSON)

**Navigation:**
- Return to dashboard (all batch results appear in main dashboard)
- Click individual test to view detailed results (Journey 3.3)

---

#### 4.2 Settings/Configuration

**Entry Point:**
- User navigates to "Settings" from main navigation

**Configuration Options:**

1. **Timeout Settings**
   - Max execution time per game (default: 5 minutes)
   - Page load timeout
   - Interaction timeout
   - Input validation for reasonable ranges

2. **Retry Settings**
   - Number of retry attempts for failed loads (default: 3)
   - Retry delay/backoff configuration

3. **LLM Model Selection**
   - Dropdown to select LLM model for evaluation
   - Show model capabilities and cost implications
   - Save preference for future tests

4. **Screenshot Configuration**
   - Number of screenshots to capture (default: 3-5)
   - Screenshot interval/timing
   - Image quality settings

5. **Output Settings**
   - Default artifact storage location
   - Auto-delete old results after X days
   - Export format preferences

6. **Save Settings**
   - "Save" button commits all settings
   - Settings persist across sessions
   - "Reset to Defaults" option

**Navigation:**
- Return to dashboard or previous page

---

## Feature Connections

### Data Flow Architecture

```
┌─────────────────┐
│  CLI Execution  │
│  (Journey 1)    │
└────────┬────────┘
         │
         │ Results
         ↓
    ┌─────────┐
    │ Database│
    └────┬────┘
         │
         │ Results
         ↓
┌─────────────────┐
│  Web UI         │
│  (Journey 3)    │
└─────────────────┘

┌─────────────────┐
│  Lambda Trigger │
│  (Journey 2)    │
└────────┬────────┘
         │
         │ Results
         ↓
    ┌─────────┐
    │ Database│
    └────┬────┘
         │
         │ Results
         ↓
┌─────────────────┐
│  Web UI         │
│  (Journey 3)    │
└─────────────────┘
```

### Shared Core Components

All execution methods (CLI, Lambda, Web UI) utilize the same core QA agent:

1. **Browser Automation Module**
   - Handles browser initialization and navigation
   - UI pattern detection (start buttons, menus)
   - Game interaction logic

2. **Evidence Capture Module**
   - Screenshot capture with timestamps
   - Console log collection
   - Artifact storage management

3. **AI Evaluation Module**
   - LLM integration for assessment
   - Structured prompt generation
   - JSON report generation

4. **Reporting Module**
   - Database storage logic
   - JSON output formatting
   - Artifact organization

### game-manifest.json Flow

The `game-manifest.json` file flows through all execution paths:

- **CLI**: Provided via `--manifest` flag or file path parameter
- **Lambda**: Retrieved from game generation process or storage
- **Web UI**: Uploaded via form in submit test flow
- **Usage**: All paths use manifest to:
  - Understand game type (puzzle, platformer, etc.)
  - Map key controls for interaction
  - Guide interaction strategy

### Result Storage Strategy

- **All execution paths** save results to database (mandatory)
- Database includes:
  - Test metadata (URL, timestamp, duration, status)
  - Evaluation results (JSON)
  - Screenshot paths/URLs
  - Console log references
  - Execution method (CLI/Lambda/Web UI)
  - game-manifest.json reference if provided

- **Web UI** reads from database to display:
  - Dashboard history
  - Detailed test results
  - Batch test aggregations

### Decision Points and Error Handling

Throughout all journeys, the system handles:

1. **Game Load Failures**
   - Retry up to 3 times (configurable)
   - Return error status with retry count
   - Store partial results if screenshots captured

2. **Timeout Scenarios**
   - 5-minute max execution time (configurable)
   - Return timeout status
   - Store whatever evidence was captured

3. **Screenshot Failures**
   - Graceful degradation: continue with logs only
   - Mark missing screenshots in report
   - Return warning in issues array

4. **LLM Evaluation Failures**
   - Fallback to heuristic-based assessment
   - Mark low confidence in report
   - Log LLM error for debugging

## Navigation Map

```
┌─────────────────────────────────────────────────┐
│                  Web UI                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Dashboard (Journey 3.1)                        │
│    ├─→ View Results (Journey 3.3)               │
│    └─→ New Test (Journey 3.2)                   │
│                                                 │
│  Batch Test (Journey 4.1) [Stretch]             │
│    ├─→ View Individual Results (Journey 3.3)    │
│    └─→ Return to Dashboard                      │
│                                                 │
│  Settings (Journey 4.2) [Stretch]               │
│    └─→ Return to Dashboard                      │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Execution Methods                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  CLI (Journey 1)                                │
│    └─→ Results stored → Visible in Web UI      │
│                                                 │
│  Lambda (Journey 2)                             │
│    └─→ Results stored → Visible in Web UI      │
│                                                 │
│  Web UI Submit (Journey 3.2)                    │
│    └─→ Results stored → Visible in Dashboard   │
│                                                 │
└─────────────────────────────────────────────────┘
```

