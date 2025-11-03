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
- Game must exist in database (created via Web UI)

**Execution Steps:**

1. **Command Execution**
   - User runs: `bun run qa.ts <game-url>`
   - Optional flags:
     - `--manifest <version-name>`: Use specific manifest version
     - `--no-manifest`: Skip manifest usage
     - `--create-game`: Error out with helpful message (games must be created via Web UI)

1a. **Game Lookup**
   - System looks up game by URL in database
   - If game not found:
     - Error: "Game not found. Create it at [web UI link]"
     - Exit with error code 1
   - If game found: Proceed to step 1b

1b. **Manifest Selection** (if game has manifests)
   - If `--manifest` flag provided:
     - Use specified manifest version
     - If version not found, error: "Manifest version 'x' not found"
   - If `--no-manifest` flag provided:
     - Skip manifest, proceed to agent execution
   - If no flags provided:
     - Check if game has any manifests:
       - **No manifests**: Proceed without manifest (warn user)
       - **Has manifests**: Prompt user:
         ```
         Select manifest version:
         [1] v1.0 (active) - Initial manifest
         [2] v2.0 - Updated controls
         [3] None (run without manifest)
         Enter selection [1]:
         ```
     - Wait for user input, default to active manifest (option 1)

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

#### 3.1 Landing/Games Library View

**Entry Point:**
- User navigates to `localhost` (or deployed URL)

**View Components:**
- **Games Library**: Grid or table of all games
- Each game card/row displays:
  - Game name
  - Game URL (truncated with tooltip)
  - Game type badge (puzzle, platformer, etc.)
  - Has manifest indicator (✓ badge if manifest exists)
  - Last tested date
  - Latest playability score
  - Number of tests run

**Interactions:**
- Click on any game → View Game Detail Page (Journey 3.4)
- Filter games by:
  - Game type (puzzle, platformer, idle, etc.)
  - Has/no manifest
  - Last tested date range
- Search by game name or URL
- Sort by: name, last tested, playability score

**Navigation:**
- "Create New Game" button → Create Game Page (Journey 3.2)
- "Run Test" button on each card → Run Test Page with game pre-selected (Journey 3.5)

---

#### 3.2 Create Game Page

**Entry Point:**
- User clicks "Create New Game" from Games Library

**Page Structure:**

**Section 1: Basic Game Information**
1. **Game URL Input**
   - Text input field for game URL
   - Validation: Must be valid URL format, must be unique
   - Real-time check: Does this game already exist?

2. **Game Name Input**
   - Text input field for game name (required)
   - Example: "Space Shooter Pro", "Puzzle Quest"

3. **Game Type Selection**
   - Dropdown: Puzzle, Platformer, Idle, Shooter, RPG, Other
   - If "Other" selected, show additional text input for description

4. **Description (Optional)**
   - Text area for game description
   - Markdown support

**Section 2: Embedded Manifest Generator (Optional)**
- Section header: "Create Game Manifest (Optional - can add later)"
- Collapsible/expandable section

**Manifest Generator Components:**

1. **Controls Definition**
   - Visual keyboard picker (click keys to select)
   - Primary controls list (with remove buttons)
   - Secondary controls list (optional)
   - Mouse interaction toggle
   - Mouse actions checkboxes (click, drag, scroll)
   - Preset buttons: "WASD + Space", "Arrow Keys + Space", "Mouse Only"

2. **Start Button Configuration**
   - CSS Selector input (advanced)
   - Button text input
   - Position dropdown (center/top/bottom/left/right)
   - Wait after click input (milliseconds)

3. **Game States Builder**
   - "Add Game State" button
   - List of game states (drag to reorder)
   - Each state has:
     - State name input
     - Expected elements section (add/remove)
     - Required actions section (add/remove)
     - Optional screenshot upload
   - Visual state flow diagram

4. **Additional Settings**
   - Loading duration input (milliseconds)
   - Notes/Special instructions (text area)

5. **Live JSON Preview**
   - Side panel or bottom panel
   - Syntax-highlighted JSON display
   - Updates in real-time as user fills form
   - Copy to clipboard button

**Save Actions:**
- "Save Without Manifest" button
  - Creates game record with no manifest
  - Redirect to Game Detail Page

- "Save With Manifest" button
  - Creates game record
  - Creates initial manifest version (v1.0)
  - Sets manifest as active
  - Redirect to Game Detail Page

- "Cancel" button → Return to Games Library

**Error Handling:**
- If game URL already exists, show error with link to existing game
- Validate required fields before save
- Validate JSON schema before creating manifest
- Show inline validation errors

**Exit Point:**
- Game created, redirect to Game Detail Page (Journey 3.4)

---

#### 3.3 Edit/Add Manifest Version

**Entry Point:**
- From Game Detail Page, click "Create New Manifest Version"
- Or click "Edit" on existing manifest

**Page Structure:**

Similar to embedded manifest generator from Create Game Page (Journey 3.2), but:

**Additional Fields:**
1. **Version Name Input**
   - Text input (required)
   - Examples: "v2.0", "After Dec Update", "Tutorial Skip Version"
   - Auto-suggest: Increment from latest version

2. **Clone From Previous Version**
   - Dropdown to select existing manifest as starting point
   - Pre-populates form with selected manifest data

3. **Version Notes**
   - Text area (required)
   - Describe what changed: "Updated controls after game patch", "Added tutorial screen handling"

**Manifest Generator:**
- Same components as Create Game Page
- All fields editable

**Save Actions:**
- "Save Manifest Version" button
  - Creates new manifest version
  - Does NOT set as active by default
  - Redirect to Game Detail Page

- "Save and Set as Active" button
  - Creates new manifest version
  - Sets it as active (deactivates previous active)
  - Redirect to Game Detail Page

- "Cancel" button → Return to Game Detail Page

**Exit Point:**
- New manifest version created, visible in Game Detail Page

---

#### 3.4 Game Detail Page

**Entry Point:**
- User clicks on game from Games Library

**Page Structure:**

**Section 1: Game Information**
- Game name (editable inline)
- Game URL (clickable link to open game)
- Game type badge
- Description
- Edit button → Edit game info

**Section 2: Manifest Versions**
- List of all manifest versions for this game
- Each version displays:
  - Version name
  - Created date
  - Creator (if tracked)
  - "Active" badge (if currently active)
  - Notes preview (expandable)
  - Actions: View JSON, Set as Active, Edit, Delete

- "Create New Manifest Version" button → Journey 3.3
- If no manifests: "No manifests yet. Create the first one!"

**Section 3: Test History**
- List of all test runs for this game (most recent first)
- Each test run displays:
  - Status badge (Pass/Fail/Error/Timeout)
  - Playability score
  - Manifest version used (or "No manifest")
  - Execution method (CLI/Lambda/Web)
  - Date/time
  - Duration
- Click on test run → View Test Results Page (Journey 3.6)
- "View All Tests" button if many tests

**Section 4: Quick Actions**
- "Run New Test" button → Run Test Page with game pre-selected (Journey 3.5)
- "Edit Game" button → Edit game info modal
- "Delete Game" button → Confirmation modal (cascades to manifests and tests)

**Navigation:**
- Back button to Games Library
- Breadcrumb: Games > [Game Name]

---

#### 3.5 Run Test Page

**Entry Point:**
- Click "Run Test" from Games Library
- Click "Run New Test" from Game Detail Page

**Page Structure:**

**Form:**

1. **Game Selection**
   - Dropdown showing all games
   - Displays: game name, URL preview, last tested date
   - If coming from Game Detail Page: pre-selected and disabled
   - Search/filter games

2. **Manifest Version Selection**
   - Dropdown showing all manifest versions for selected game
   - Default: Active manifest (indicated with badge)
   - Option: "No manifest" (test without manifest)
   - Shows preview of selected manifest settings (controls, game type)

3. **Advanced Options** (collapsible)
   - Override execution timeout
   - Override screenshot count
   - Custom notes for this test run

4. **Run Test Button**
   - Validates: game selected
   - Triggers test execution

**Progress Display:**
- Real-time progress indicators:
  - "Initializing browser..."
  - "Loading game..."
  - "Interacting with game..."
  - "Evaluating results..."
- Progress bar (if phases can be tracked)
- Estimated time remaining
- Cancel button (attempt to stop test)

**Completion:**
- Auto-redirect to Test Results Page (Journey 3.6)
- Success message with link to results

**Error Handling:**
- If test fails to start: Show error message with details
- If test times out: Show timeout message with partial results link
- Validation errors: Inline field-level errors

**Exit Point:**
- Test run completed, redirect to Test Results Page

---

#### 3.6 View Test Results Page

**Entry Point:**
- After completing test run (Journey 3.5)
- Click on test result from Game Detail Page
- Or navigate directly to `/tests/:testId`

**View Components:**

1. **Header Section**
   - Game name (clickable link to Game Detail Page)
   - Test ID
   - Timestamp
   - Duration

2. **Summary Section**
   - Overall status badge (Pass/Fail/Error/Timeout)
   - Playability score (large, visual indicator: 0-100 scale)
   - Manifest version used (link to manifest details)
   - Execution method badge (CLI/Lambda/Web)

3. **Evaluation Results**
   - Structured display of AI evaluation:
     - Game loaded successfully? (Yes/No with confidence)
     - Controls responsive? (Yes/No with confidence)
     - Completed without crashes? (Yes/No with confidence)
   - Issues array:
     - List of detected problems
     - Each issue with severity indicator
     - Console errors highlighted

4. **Screenshots Gallery**
   - 3-5 timestamped screenshots
   - Thumbnail grid view
   - Click to expand in lightbox/modal
   - Each screenshot labeled with:
     - Timestamp
     - Phase (Initial Load, After Start, During Gameplay, etc.)
   - Download individual screenshot button
   - Navigation arrows in lightbox

5. **Console Logs**
   - Expandable/collapsible section
   - Syntax-highlighted logs
   - Filter by level: All, Error, Warning, Info
   - Search within logs
   - Download logs button
   - Copy to clipboard button

6. **Test Metadata** (collapsible)
   - Browser version
   - LLM model used
   - Retry count
   - User agent
   - Any custom notes from test submission

7. **Artifacts Download**
   - "Download All Artifacts" button → ZIP file with:
     - All screenshots
     - Console logs
     - JSON report
     - Manifest used (if applicable)

**Actions:**
- "Run Test Again" button → Run Test Page with same game/manifest
- "Run with Different Manifest" button → Run Test Page with manifest dropdown open
- "Back to Game" button → Game Detail Page
- "Back to Games Library" button → Games Library

**Navigation:**
- Breadcrumb: Games > [Game Name] > Test Results

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
┌─────────────────────────────────────────────────────────┐
│                       Web UI                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Games Library (Journey 3.1)                            │
│    ├─→ Create Game (Journey 3.2)                        │
│    │     └─→ Game Detail (Journey 3.4)                  │
│    ├─→ Game Detail (Journey 3.4)                        │
│    │     ├─→ Edit/Add Manifest (Journey 3.3)            │
│    │     ├─→ View Test Results (Journey 3.6)            │
│    │     └─→ Run Test (Journey 3.5)                     │
│    └─→ Run Test (Journey 3.5)                           │
│          └─→ View Test Results (Journey 3.6)            │
│                                                         │
│  Batch Test (Journey 4.1) [Stretch]                     │
│    ├─→ View Individual Results (Journey 3.6)            │
│    └─→ Return to Games Library                          │
│                                                         │
│  Settings (Journey 4.2) [Stretch]                       │
│    └─→ Return to Games Library                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Execution Methods                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CLI (Journey 1)                                        │
│    └─→ Looks up existing game → Uses active manifest   │
│        └─→ Results stored → Visible in Web UI          │
│                                                         │
│  Lambda (Journey 2)                                     │
│    └─→ Receives gameId + manifestId                    │
│        └─→ Results stored → Visible in Web UI          │
│                                                         │
│  Web UI Run Test (Journey 3.5)                          │
│    └─→ Select game + manifest → Run test               │
│        └─→ Results displayed in Test Results Page      │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Data Flow                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Create Game (Web UI only)                           │
│     ├─→ Game record in database                         │
│     └─→ Optional: Initial manifest (v1.0)               │
│                                                         │
│  2. Add/Edit Manifest (Web UI)                          │
│     └─→ New manifest version linked to game             │
│                                                         │
│  3. Run Test (CLI/Lambda/Web)                           │
│     ├─→ Lookup game                                     │
│     ├─→ Get manifest (active or specified)              │
│     ├─→ Execute QA agent                                │
│     └─→ Store test results linked to game + manifest    │
│                                                         │
│  4. View Results (Web UI)                               │
│     └─→ Display test results with game/manifest context │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

