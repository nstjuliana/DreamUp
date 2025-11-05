# Phase 2: MVP Phase

**Goal**: Build a minimal, usable version with core features integrated. This phase delivers essential functionality that provides the project's primary value—a working QA agent that can test a browser game and return basic results.

**Timeline**: Days 1-2 (Building on Setup Phase)

**Success Criteria**: 
- Can execute CLI command with game URL
- Browser launches and loads game URL successfully
- Captures at least 1 screenshot
- Outputs basic JSON result to stdout
- Handles basic errors (invalid URL, browser connection failures)

---

## Features

### 1. Browser Automation - Basic Navigation

**Goal**: Initialize browser session and load game URL with Browserbase and Stagehand.

**Steps**:
1. Install dependencies: `npm install @browserbasehq/stagehand`
2. Create `src/browser/browser-client.ts` with `BrowserClient` class
3. Implement `initializeSession()` method to create Browserbase session
4. Implement `loadGame(url: string)` method to navigate to game URL
5. Implement `waitForLoad()` method to wait for page to be ready
6. Implement `closeSession()` method for cleanup

**Deliverable**: Browser session can be created, game URL can be loaded, session can be closed

---

### 2. Screenshot Capture

**Goal**: Capture screenshots from the browser and save them to Supabase Storage.

**Steps**:
1. Create `src/browser/screenshot-capture.ts` with `captureScreenshot()` function
2. Implement screenshot capture using Browserbase API
3. Upload screenshot to Supabase Storage with timestamped filename
4. Return public URL for later reference
5. Handle screenshot failures gracefully (log error, continue execution)

**Deliverable**: Can capture screenshots and upload to Supabase Storage at path `artifacts/{testId}/screenshots/`

---

### 3. Console Log Collection

**Goal**: Capture console logs and errors from the browser session.

**Steps**:
1. Create `src/browser/console-logger.ts` with `collectConsoleLogs()` function
2. Set up console log listeners using Browserbase/Stagehand API
3. Collect logs during browser session (errors, warnings, info)
4. Upload logs to Supabase Storage at path `artifacts/{testId}/logs/console.log`
5. Return log entries as array and storage URL for evaluation phase

**Deliverable**: Console logs are captured and uploaded to Supabase Storage

---

### 4. Basic Agent Orchestration

**Goal**: Create the main QA agent that orchestrates browser operations in a simple flow.

**Steps**:
1. Create `src/agent/qa-agent.ts` with `QAAgent` class
2. Implement `run(gameUrl: string)` method that:
   - Initializes browser session
   - Loads game URL
   - Waits for initial render
   - Captures baseline screenshot
   - Collects console logs
   - Closes browser session
3. Return basic result object with status and screenshot path
4. Implement timeout (5 minutes max execution time)

**Deliverable**: Agent can execute basic workflow: initialize → load → capture → collect → close

---

### 5. Basic Result Formatting

**Goal**: Format and output results as JSON to stdout.

**Steps**:
1. Create `src/cli/output-formatter.ts` with `formatResult()` function
2. Define `TestResult` interface matching spec: `{status, playability_score, issues[], screenshots[], timestamp}`
3. Format result as JSON string
4. Output to stdout in CLI
5. Handle errors by outputting error result format

**Deliverable**: Results output as structured JSON to stdout

---

### 6. CLI Integration with Game Lookup

**Goal**: Connect CLI commands to agent execution with database game lookup.

**Steps**:
1. Update `src/cli/commands.ts` to:
   - Parse game URL from command arguments
   - Look up game in database by URL
   - If game not found, show error: "Game not found. Create it at [web UI link]"
   - If game found, retrieve game record (manifest can be null for MVP)
2. Call `QAAgent.run()` with game data
3. Validate URL format before database lookup
4. Handle agent execution errors and display user-friendly messages
5. Output JSON result to console
6. Return appropriate exit codes (0 for success, 1 for errors)

**Note for MVP**: Games/manifests will be created manually in database for testing. Web UI for game creation comes in Stretch Phase.

**Deliverable**: CLI command `npx tsx qa.ts <game-url>` looks up game and executes agent

---

### 7. Basic Error Handling

**Goal**: Handle common error scenarios gracefully.

**Steps**:
1. Validate game URL format in CLI parser
2. Handle browser initialization failures (invalid API keys, connection errors)
3. Handle page load failures (timeout, network errors)
4. Handle screenshot failures (continue with logs only)
5. Return error status in result JSON with descriptive messages

**Deliverable**: Common errors are caught and returned in result format rather than crashing

---

### 8. Input Validation

**Goal**: Validate all inputs before processing.

**Steps**:
1. Create `src/utils/validation.ts` with validation functions
2. Implement `validateUrl(url: string)` function
3. Implement `validateManifest(manifestPath: string)` function (basic validation for future use)
4. Use validation in CLI before agent execution
5. Throw `ValidationError` for invalid inputs

**Deliverable**: Invalid inputs are caught early with clear error messages

---

## Integration Tasks

### Task 1: End-to-End Flow Test
- Execute: `npx tsx qa.ts https://example-game.com`
- Browser loads game successfully
- Screenshot is captured and saved
- Console logs are collected
- JSON result is output to stdout

### Task 2: Error Handling Test
- Test with invalid URL → validation error returned
- Test with unreachable URL → connection error in result
- Test with browser API key error → clear error message

### Task 3: Artifact Organization
- Screenshots uploaded to Supabase Storage at `artifacts/{testId}/screenshots/`
- Logs uploaded to Supabase Storage at `artifacts/{testId}/logs/`
- Test ID is unique (UUID-based)
- Public URLs returned for all uploaded artifacts

---

## Deliverables Checklist

- [x] Browser session can be initialized and closed
- [x] Game URL can be loaded in browser
- [x] At least 1 screenshot captured per test
- [x] Console logs collected and uploaded to Supabase Storage
- [x] Agent orchestrates basic workflow (initialize → load → capture → close)
- [x] JSON results output to stdout in correct format
- [x] CLI command executes end-to-end successfully
- [x] Basic error handling works (invalid URL, connection failures)
- [x] Input validation prevents invalid URLs
- [x] Artifacts uploaded to Supabase Storage with public URLs
- [x] Test results saved to database

---

## MVP Scope Boundaries

**In Scope for MVP**:
- Basic browser navigation (load URL, wait for load)
- Single screenshot capture
- Console log collection
- Game lookup from database by URL
- JSON output to stdout
- Basic error handling

**Out of Scope for MVP**:
- Game interaction (clicking buttons, keyboard input)
- Multiple screenshots throughout session
- LLM evaluation (will return static playability_score = 50)
- Manifest usage (can retrieve if exists, but won't use it yet)
- Retry logic
- Advanced error recovery
- Web UI for game creation (games created manually in DB for testing)

---

## Next Phase

After completing MVP Phase, proceed to **Enhancement Phase 1** where we add game interaction, multiple screenshots, LLM evaluation, and database storage.

---

## Notes

- MVP focuses on proving core concept works: browser automation → evidence capture → basic output
- Use dummy/placeholder values where needed (e.g., playability_score = 50, issues = [])
- Keep it simple: one screenshot is enough for MVP
- Test with real game URLs to ensure it works in practice
- Follow project-rules.md for all code (file headers, documentation, naming)

