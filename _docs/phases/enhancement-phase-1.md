# Phase 3: Enhancement Phase 1

**Goal**: Expand MVP with full interaction capabilities, proper evidence capture, LLM evaluation, and database integration. This phase delivers a fully functional QA agent that can test games comprehensively and store results.

**Timeline**: Days 2-3 (Building on MVP Phase)

**Success Criteria**: 
- Agent can interact with games (click buttons, keyboard input)
- Captures 3-5 screenshots throughout test session
- LLM evaluates screenshots and logs
- Results stored in Supabase database
- Artifacts (screenshots, logs) stored in Supabase Storage
- Retry logic handles failed page loads

---

## Features

### 1. Game Interaction System with Manifest Support

**Goal**: Enable agent to find and interact with game UI elements using manifest data (if available).

**Steps**:
1. Create `src/browser/ui-pattern-detector.ts` with UI detection functions
2. Implement `findStartButton()` that:
   - First checks manifest for start button configuration (selector, text, position)
   - Falls back to Stagehand's AI detection if no manifest or manifest fails
3. Implement `clickElement()` helper function
4. Create `src/browser/stagehand-handler.ts` with Stagehand integration
5. Implement basic interaction sequence: detect start button → click it
6. Add keyboard input support (arrow keys, spacebar) for gameplay simulation
7. Use manifest controls data (if available) to guide which keys to press
8. Implement simple gameplay loop: detect game state → perform actions → wait
9. Create `src/utils/manifest-parser.ts` to parse and validate manifest data

**Deliverable**: Agent can use manifest data to improve interaction accuracy, with fallback to AI detection

---

### 2. Multiple Screenshot Capture

**Goal**: Capture 3-5 screenshots at key moments throughout the test session.

**Steps**:
1. Enhance `src/browser/screenshot-capture.ts` to capture screenshots at intervals
2. Capture baseline screenshot after initial load
3. Capture screenshot after clicking start button
4. Capture screenshots during gameplay (every 30-60 seconds)
5. Capture final screenshot before closing
6. Ensure all screenshots have timestamps and are saved with descriptive names
7. Return array of screenshot paths/URLs in result

**Deliverable**: 3-5 timestamped screenshots captured throughout session

---

### 3. Supabase Database Integration for Test Results

**Goal**: Store test results in Supabase PostgreSQL database (schema already created in Setup Phase).

**Steps**:
1. Supabase client already installed and configured (Setup Phase)
2. Database schema already exists: `games`, `game_manifests`, `test_runs` (Setup Phase)
3. TypeScript types already generated in `src/storage/types.ts` (Setup Phase)
4. Implement `saveTestResult()` function in `src/storage/database.ts`:
   - Accept test result data + gameId + optional manifestId
   - Insert into `test_runs` table
   - Update `games.last_tested_at` timestamp
   - Return test run ID
5. Integrate database save in agent after test completion
6. Handle database save failures gracefully (log error, still output JSON result)

**Deliverable**: Test results are saved to Supabase database after each test run, linked to game record

---

### 4. Supabase Storage Integration

**Goal**: Upload screenshots and logs to Supabase Storage instead of local filesystem.

**Steps**:
1. Create `src/storage/file-storage.ts` with Supabase Storage client
2. Implement `uploadScreenshot()` function to upload to `artifacts/{testId}/screenshots/` bucket
3. Implement `uploadLogs()` function to upload to `artifacts/{testId}/logs/` bucket
4. Set up Supabase Storage buckets (public for screenshots, private for logs)
5. Replace local file saving with Supabase Storage uploads
6. Store Storage URLs in database (not file paths)
7. Handle upload failures gracefully (fallback or error in result)

**Deliverable**: Screenshots and logs uploaded to Supabase Storage, URLs stored in database

---

### 5. LLM Evaluation Integration

**Goal**: Use LLM (via Vercel AI SDK) to analyze screenshots and logs for playability assessment.

**Steps**:
1. Install Vercel AI SDK: `bun add ai` and LLM provider SDK (e.g., `openai`)
2. Create `src/evaluation/llm-evaluator.ts` with `LLMEvaluator` class
3. Create `src/evaluation/prompt-builder.ts` with structured prompt generation
4. Implement `evaluateGame()` method that:
   - Builds prompt with screenshots and console logs
   - Sends to LLM with structured output schema
   - Parses LLM response for: load success, controls responsive, crashes detected
   - Calculates playability score (0-100)
   - Extracts issues list
5. Create `src/evaluation/result-parser.ts` to parse LLM structured outputs
6. Handle LLM API failures with fallback (return default/low-confidence result)

**Deliverable**: LLM evaluates game evidence and returns playability_score, status, and issues

---

### 6. Structured LLM Prompts

**Goal**: Create effective prompts that produce consistent, structured JSON responses.

**Steps**:
1. Design prompt template in `src/evaluation/prompt-builder.ts`
2. Include evaluation criteria:
   - "Does the game load successfully?"
   - "Are controls responsive?"
   - "Did the game complete without crashes?"
3. Use Vercel AI SDK structured outputs to ensure JSON format
4. Include screenshot context (describe what's visible)
5. Include console log analysis (errors, warnings)
6. Test prompts with sample games and refine for accuracy

**Deliverable**: LLM prompts produce consistent structured JSON with all required fields

---

### 7. Retry Logic for Page Loads

**Goal**: Automatically retry failed page loads up to 3 times.

**Steps**:
1. Implement retry logic in `src/browser/browser-client.ts` `loadGame()` method
2. Wrap load attempt in retry loop (max 3 attempts)
3. Add exponential backoff between retries (1s, 2s, 4s)
4. Log retry attempts
5. Return error only after all retries exhausted
6. Update agent to handle retry failures gracefully

**Deliverable**: Failed page loads retry up to 3 times before failing

---

### 8. Agent State Management

**Goal**: Track agent state throughout test execution for better error handling and logging.

**Steps**:
1. Create `src/agent/agent-state.ts` with `AgentState` interface/class
2. Track current phase: 'initializing' | 'loading' | 'interacting' | 'monitoring' | 'evaluating' | 'reporting'
3. Track test metadata: testId, gameUrl, startTime, endTime
4. Store evidence: screenshots array, logs array
5. Use state for logging and error context
6. Pass state through agent workflow

**Deliverable**: Agent state is tracked throughout execution for debugging and logging

---

### 9. Enhanced Error Handling

**Goal**: Improve error handling with context preservation and graceful degradation.

**Steps**:
1. Wrap each agent phase in try-catch blocks
2. Preserve partial results if one phase fails (e.g., if evaluation fails, still return screenshots)
3. Add error context to state (which phase failed, why)
4. Log errors with full context before re-throwing or returning error result
5. Return meaningful error messages in result JSON
6. Handle timeout scenarios (5-minute max execution time)

**Deliverable**: Errors are handled gracefully with context, partial results returned when possible

---

### 10. Result Format Completion

**Goal**: Ensure result JSON matches specification exactly.

**Steps**:
1. Verify result format matches spec: `{status, playability_score, issues[], screenshots[], timestamp}`
2. Include all required fields with proper types
3. Add optional fields: `duration`, `testId`, `gameUrl`
4. Ensure screenshots array contains Supabase Storage URLs (not local paths)
5. Format timestamp as ISO 8601 string
6. Validate result structure before outputting

**Deliverable**: Result JSON matches specification with all fields populated correctly

---

## Integration Tasks

### Task 1: Full End-to-End Test
- Execute: `bun run qa.ts <game-url>`
- Browser loads game
- Agent finds and clicks start button
- Agent simulates gameplay
- 3-5 screenshots captured throughout
- Console logs collected
- LLM evaluates evidence
- Results saved to database
- Artifacts uploaded to Storage
- JSON result output to stdout

### Task 2: Database Verification
- Check Supabase database for test results
- Verify all fields populated correctly
- Verify Storage URLs are valid and accessible
- Test with multiple game URLs

### Task 3: Error Scenarios
- Test with broken game URL → proper error handling
- Test with LLM API failure → fallback behavior
- Test with Storage upload failure → graceful degradation
- Test with timeout → partial results returned

---

## Deliverables Checklist

- [ ] Agent can interact with games (find buttons, click, keyboard input)
- [ ] 3-5 screenshots captured at key moments
- [ ] LLM evaluates screenshots and logs
- [ ] Results stored in Supabase database
- [ ] Screenshots and logs uploaded to Supabase Storage
- [ ] Retry logic handles failed page loads (up to 3 attempts)
- [ ] Agent state tracked throughout execution
- [ ] Enhanced error handling with context preservation
- [ ] Result JSON matches specification exactly
- [ ] End-to-end flow works with real game URLs

---

## Scope Boundaries

**In Scope for Enhancement Phase 1**:
- Full game interaction capabilities
- Multiple screenshot capture (3-5)
- LLM evaluation with structured outputs
- Database and Storage integration
- Retry logic
- Enhanced error handling

**Out of Scope for Enhancement Phase 1**:
- Lambda deployment (next phase)
- Web UI (stretch feature)
- Batch testing (stretch feature)
- Advanced metrics (FPS, load time analysis)
- GIF recording

---

## Next Phase

After completing Enhancement Phase 1, proceed to **Enhancement Phase 2** where we add Lambda deployment, advanced error handling, polish, and testing on diverse game types.

---

## Notes

- This phase adds the core "intelligence" to the agent (interaction + evaluation)
- Focus on getting LLM evaluation working reliably (may need prompt iteration)
- Test with diverse game types to ensure interaction logic works broadly
- Monitor LLM API costs (use cheaper models for iteration)
- Follow all project-rules.md conventions

