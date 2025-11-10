# Gameplay Loop Optimization Plan

## Current State Analysis

### Current Gameplay Flow

The current implementation follows this sequence:

```markdown:_docs/gameplay-loop-optimization.md
<code_block_to_apply_changes_from>
```
1. Baseline Screenshot (after page load)
   ↓
2. Start Button Click
   ↓
3. Wait 3 seconds (START_BUTTON_WAIT_MS)
   ↓
4. Screenshot after start click
   ↓
5. simulateGameplay() Loop:
   - Build full prompt (game type, controls, goal) EVERY cycle
   - Call page.act(actionPrompt) - Stagehand internally captures screenshot
   - Wait aiDecisionInterval (default: 2000ms)
   - Repeat until duration expires
   - NO screenshots stored in state during gameplay
   ↓
6. Monitoring Phase (AFTER gameplay):
   - Capture screenshots separately via time-based intervals OR
   - Capture single final screenshot
   ↓
7. Evaluation Phase
```

### Current Implementation Details

#### `simulateGameplay()` Method (`src/agent/qa-agent.ts:478-588`)

**Current Behavior:**
- Returns `Promise<void>` (doesn't update state)
- Loop structure:
  ```typescript
  while (Date.now() - startTime < durationMs) {
    1. Build full prompt (game type, controls, goal) EVERY cycle
    2. Execute page.act(actionPrompt)
    3. Wait aiDecisionInterval (default: 2000ms)
    4. Repeat
  }
  ```

**Issues:**
- ❌ Screenshots and actions are **decoupled** (screenshots captured separately in monitoring phase)
- ❌ No screenshots stored in state during gameplay loop
- ❌ Full prompt rebuilt every cycle (inefficient)
- ❌ Fixed wait intervals regardless of action completion
- ❌ Stagehand's internal screenshot capture not leveraged for documentation

#### Monitoring Phase (`src/agent/qa-agent.ts:356-369`)

**Current Behavior:**
- Runs AFTER gameplay completes
- Captures screenshots via:
  - Time-based intervals (if `screenshotIntervals` in manifest)
  - OR single final screenshot (event-based)
- Screenshots captured don't correspond to specific actions

**Issues:**
- ❌ Screenshots don't document action outcomes
- ❌ Redundant screenshot capture (Stagehand already captures internally)
- ❌ No correlation between screenshots and actions taken

### Current Configuration Values

From `src/utils/manifest-parser.ts` and `src/utils/constants.ts`:

- **Default gameplay duration**: 45 seconds (`getGameplayDuration()`)
- **Default AI decision interval**: 2000ms (`getAiDecisionInterval()`)
- **Start button wait**: 3000ms (`START_BUTTON_WAIT_MS`)
- **Default loading duration**: 5000ms (`DEFAULT_LOADING_DURATION_MS`)

### Current Prompt Strategy

**`buildGameplayPrompt()`** (`src/agent/qa-agent.ts:449-464`):
- Builds prompt EVERY cycle with:
  - Game type
  - Controls list
  - Gameplay goal
- Example: `"Play this platformer game. Goal: Keep playing. Use these controls: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space."`

**Issues:**
- ❌ Same prompt sent every cycle (redundant)
- ❌ Stagehand already sees screenshot visually - text prompt mostly redundant
- ❌ No distinction between initial setup and subsequent actions

---

## Desired Future State

### Tight Screenshot-Action Loop

**Target Flow:**
```
1. Baseline Screenshot (after page load)
   ↓
2. Start Button Click
   ↓
3. Minimal wait (only if necessary for game initialization)
   ↓
4. Screenshot after start click (if needed)
   ↓
5. Tight Gameplay Loop:
   Screenshot → Action → Screenshot → Action → ...
   - Capture screenshot BEFORE each action (document current state)
   - Store screenshot in state immediately
   - Execute action based on screenshot
   - Minimal/no wait between cycles
   - Repeat until duration expires
   ↓
6. Evaluation Phase (screenshots already captured)
```

### Key Principles

1. **Screenshot-First Decision Making**
   - Screenshots are captured BEFORE each action
   - Screenshots serve as primary context (after initial setup)
   - Actions are tightly coupled with their pre-action screenshots

2. **Minimal Delays**
   - Remove fixed wait intervals
   - Only wait if action completion requires it
   - Use Stagehand's built-in waiting mechanisms

3. **Efficient Context Usage**
   - Initial prompt sent ONCE (game type, controls, goal)
   - Subsequent actions use screenshots as primary context
   - Minimal or no text prompts after initial setup

4. **State Management**
   - Screenshots stored in state during gameplay
   - Each action has corresponding screenshot
   - Timeline events document screenshot → action pairs

---

## Recommended Changes

### Change 1: Refactor `simulateGameplay()` to Return State

**Current Signature:**
```typescript
private async simulateGameplay(state: AgentState, durationMs: number): Promise<void>
```

**Target Signature:**
```typescript
private async simulateGameplay(state: AgentState, durationMs: number): Promise<AgentState>
```

**Why:**
- Need to return updated state with screenshots captured during gameplay
- Caller needs to access screenshots for evaluation

**Implementation:**
- Initialize `currentState = state` at start
- Return `currentState` at end
- Update state with screenshots during loop

---

### Change 2: Capture Screenshot BEFORE Each Action

**Current Flow:**
```
Loop:
  1. Build prompt
  2. Execute action
  3. Wait
```

**Target Flow:**
```
Loop:
  1. Capture screenshot (current game state)
  2. Store screenshot in state
  3. Execute action (Stagehand uses screenshot internally)
  4. Minimal/no wait
```

**Implementation:**
```typescript
while (Date.now() - startTime < durationMs) {
  // STEP 1: Capture screenshot BEFORE action
  const screenshotIndex = currentState.screenshots.length;
  const preActionScreenshot = await captureScreenshot(
    this.browserClient,
    currentState.testId,
    screenshotIndex
  );
  
  if (preActionScreenshot) {
    currentState = addScreenshot(currentState, preActionScreenshot);
    currentState = addTimelineEvent(currentState, 'screenshot_captured', 
      `Pre-action screenshot before decision ${decisionCount}`, 
      { index: screenshotIndex, decisionCycle: decisionCount }
    );
  }
  
  // STEP 2: Execute action
  await page.act(actionPrompt);
  
  // STEP 3: Minimal wait (or no wait)
  // ...
}
```

**Benefits:**
- ✅ Screenshots document exact game state before each action
- ✅ Tight coupling between screenshots and actions
- ✅ Better documentation for QA evaluation

---

### Change 3: Optimize Prompt Strategy

**Current:**
- Full prompt sent every cycle

**Target:**
- Initial prompt sent ONCE (contains game type, controls, goal)
- Subsequent actions use minimal prompts or just gameplay goal
- Stagehand relies on visual context from screenshots

**Implementation:**
```typescript
// Build initial prompt ONCE before loop
const initialPrompt = this.buildInitialGameplayPrompt(
  gameType,
  controls.primary,
  gameplayGoal
);

while (Date.now() - startTime < durationMs) {
  // Use initial prompt for first action, minimal prompt for rest
  const actionPrompt = decisionCount === 1 
    ? initialPrompt 
    : gameplayGoal; // Minimal - Stagehand uses visual context
  
  await page.act(actionPrompt);
}
```

**New Method:**
```typescript
private buildInitialGameplayPrompt(
  gameType: string,
  controls: string[],
  goal: string
): string {
  let prompt = `You are playing a ${gameType} game. `;
  prompt += `Your goal: ${goal}. `;
  
  if (controls.length > 0) {
    prompt += `Available controls: ${controls.join(', ')}. `;
  } else {
    prompt += `Use mouse controls. `;
  }
  
  prompt += `Make decisions based on what you see in the screenshot. `;
  
  return prompt;
}
```

**Benefits:**
- ✅ Reduces prompt overhead (sent once, not every cycle)
- ✅ Leverages Stagehand's visual understanding
- ✅ Faster decision cycles

---

### Change 4: Minimize Wait Times

**Current:**
- Fixed `aiDecisionInterval` wait (default: 2000ms) after every action
- Fixed `START_BUTTON_WAIT_MS` (3000ms) after start button click

**Target:**
- Remove fixed waits in gameplay loop
- Let Stagehand handle waiting (it waits for action completion)
- Only wait if absolutely necessary (e.g., game initialization)

**Implementation:**
```typescript
// Remove fixed wait after action
// Stagehand's act() already waits for action completion
await page.act(actionPrompt);

// Only wait if we're approaching duration limit (to avoid exceeding)
const remainingTime = durationMs - (Date.now() - startTime);
if (remainingTime <= 0) break;

// Continue immediately to next cycle
```

**Start Button Wait:**
- Consider reducing `START_BUTTON_WAIT_MS` from 3000ms to 500-1000ms
- Or remove entirely if Stagehand's action completion is sufficient

**Benefits:**
- ✅ Faster gameplay loop
- ✅ More actions per test duration
- ✅ Better test coverage

---

### Change 5: Update `executeTest()` to Use Returned State

**Current:**
```typescript
await this.simulateGameplay(currentState, gameplayDuration);

// Monitoring phase captures screenshots separately
```

**Target:**
```typescript
currentState = await this.simulateGameplay(currentState, gameplayDuration);
currentState = addTimelineEvent(currentState, 'gameplay_complete', 
  'Gameplay simulation completed', 
  { screenshotCount: currentState.screenshots.length }
);

// Skip monitoring phase screenshots if we have enough from gameplay
if (currentState.screenshots.length < 3) {
  // Capture additional screenshots if needed
}
```

**Benefits:**
- ✅ Screenshots captured during gameplay are preserved
- ✅ Eliminates redundant screenshot capture
- ✅ Faster overall test execution

---

### Change 6: Remove or Minimize Monitoring Phase

**Current:**
- Separate monitoring phase captures screenshots after gameplay

**Target:**
- Skip monitoring phase if sufficient screenshots captured during gameplay
- Only capture additional screenshots if count < 3 (minimum for evaluation)

**Implementation:**
```typescript
// Phase 5: Monitoring - only if needed
currentState = updatePhase(currentState, 'monitoring');

if (currentState.screenshots.length < 3) {
  // Capture additional screenshots
  const finalScreenshot = await captureScreenshot(
    this.browserClient, 
    currentState.testId, 
    currentState.screenshots.length
  );
  if (finalScreenshot) {
    currentState = addScreenshot(currentState, finalScreenshot);
  }
} else {
  logger.info('Skipping monitoring phase (sufficient screenshots from gameplay)', {
    screenshotCount: currentState.screenshots.length,
  });
}
```

**Benefits:**
- ✅ Eliminates redundant screenshot capture
- ✅ Faster test execution
- ✅ Screenshots directly correspond to actions

---

## Expected Performance Improvements

### Latency Reduction

**Current:**
- Decision cycle: ~2000ms wait + action time (~500-1000ms) = ~2500-3000ms per cycle
- 45 seconds = ~15-18 decision cycles
- Separate monitoring phase adds additional time

**Target:**
- Decision cycle: action time (~500-1000ms) + screenshot capture (~200-500ms) = ~700-1500ms per cycle
- 45 seconds = ~30-64 decision cycles (2-4x more actions)
- No separate monitoring phase

**Estimated Improvement:**
- **2-4x more actions** per test duration
- **30-50% reduction** in total test time
- **Better documentation** (screenshot per action vs. separate screenshots)

### Screenshot Quality

**Current:**
- 2-5 screenshots total (baseline + post-start + monitoring)
- Screenshots don't correspond to actions

**Target:**
- 20-60+ screenshots (one per action)
- Each screenshot documents pre-action game state
- Better evidence for QA evaluation

---

## Implementation Checklist

### Phase 1: Core Loop Changes
- [ ] Change `simulateGameplay()` return type to `Promise<AgentState>`
- [ ] Add screenshot capture before each action in loop
- [ ] Store screenshots in state during gameplay
- [ ] Update `executeTest()` to capture returned state

### Phase 2: Prompt Optimization
- [ ] Create `buildInitialGameplayPrompt()` method
- [ ] Use initial prompt only for first action
- [ ] Use minimal prompts for subsequent actions
- [ ] Remove `buildGameplayPrompt()` method (or keep as fallback)

### Phase 3: Wait Time Optimization
- [ ] Remove fixed `aiDecisionInterval` wait from loop
- [ ] Reduce or remove `START_BUTTON_WAIT_MS`
- [ ] Let Stagehand handle action completion waiting
- [ ] Only wait if absolutely necessary

### Phase 4: Monitoring Phase Cleanup
- [ ] Add check for screenshot count before monitoring phase
- [ ] Skip monitoring if sufficient screenshots captured
- [ ] Log when monitoring phase is skipped

### Phase 5: Testing & Validation
- [ ] Test with various game types
- [ ] Verify screenshot quality and count
- [ ] Verify test execution time reduction
- [ ] Verify LLM evaluation still works correctly

---

## Configuration Considerations

### Manifest Settings

**Current defaults:**
- `gameplayDuration`: 45000ms (45s)
- `aiDecisionInterval`: 2000ms

**After optimization:**
- `gameplayDuration`: Keep at 45000ms (or reduce if tests are faster)
- `aiDecisionInterval`: Can be removed (no longer used)
- Consider adding `minScreenshotCount` for quality assurance

### Timeline Events

**New events to add:**
- `screenshot_captured`: Before each action
- `action_executed`: After each action
- `gameplay_complete`: End of gameplay with screenshot count

**Events to remove:**
- None (keep existing for backward compatibility)

---

## Risks & Mitigations

### Risk 1: Too Many Screenshots
**Concern:** Capturing 20-60 screenshots might be excessive
**Mitigation:** 
- Screenshots are essential for QA documentation
- Can implement screenshot sampling if needed (e.g., every Nth action)
- Storage costs are minimal for PNG files

### Risk 2: Action Speed Too Fast
**Concern:** Removing waits might cause actions to execute before game responds
**Mitigation:**
- Stagehand's `act()` method already waits for action completion
- Can add minimal wait (e.g., 100-200ms) if games need more time
- Monitor for action failures in logs

### Risk 3: Screenshot Capture Overhead
**Concern:** Capturing screenshots before each action might slow down loop
**Mitigation:**
- Screenshot capture is async and runs in parallel with action planning
- 720p screenshots are reasonably sized (~200-500ms capture time)
- Benefits outweigh costs (better documentation, faster overall test)

---

## Success Metrics

### Performance Metrics
- [ ] **Test execution time**: Reduce by 30-50%
- [ ] **Actions per test**: Increase by 2-4x
- [ ] **Screenshot count**: Increase from 2-5 to 20-60+

### Quality Metrics
- [ ] **Screenshot-action correlation**: 100% (every action has pre-action screenshot)
- [ ] **LLM evaluation accuracy**: Maintain or improve
- [ ] **Test reliability**: No regression in test success rate

### Documentation Metrics
- [ ] **Timeline completeness**: Every action documented with screenshot
- [ ] **Evidence quality**: Screenshots clearly show game state before actions
- [ ] **Debugging capability**: Screenshots aid in troubleshooting failed tests

---

## Notes

- Stagehand's `act()` method internally captures screenshots for visual understanding
- Our explicit screenshot capture is for **documentation/evaluation purposes**
- The tight loop ensures screenshots match the exact game state Stagehand sees
- Minimal waits rely on Stagehand's built-in action completion detection
- Consider adding screenshot compression/optimization if file sizes become an issue
```

This document covers:
1. Current gameplay loop logic (implementation details)
2. Issues with the current approach
3. Desired future state (tight screenshot-action loop)
4. Recommended changes (6 changes with code examples)
5. Expected performance improvements
6. Implementation checklist
7. Risks and mitigations

Should I save this to `_docs/gameplay-loop-optimization.md`?
