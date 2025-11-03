# Phase 5: Stretch Phase (Optional)

**Goal**: Add optional stretch features that enhance the QA pipeline with advanced capabilities. These features are not required for core functionality but add significant value.

**Timeline**: Days 6-7+ (Optional, after core completion)

**Success Criteria**: 
- Stretch features work as specified
- Features integrate well with existing core functionality
- Documentation updated to include stretch features

---

## Features

### 1. Web Dashboard UI (Next.js)

**Goal**: Create a web UI for game management, manifest creation, and test execution.

**Priority**: High - Core value for stretch phase

**Steps**:
1. Set up Next.js project (App Router)
2. Create pages:
   - Games Library page (list all games)
   - Create Game page with embedded manifest generator
   - Game Detail page (game info, manifest versions, test history)
   - Edit/Add Manifest page
   - Run Test page
   - Test Results page
3. Integrate with Supabase database (read/write games, manifests, test runs)
4. Implement API routes for test submission
5. Style with Tailwind CSS + shadcn/ui components

**Sub-Feature: Embedded Manifest Generator**

**Goal**: Visual interface for creating/editing game manifests without manual JSON editing.

**Components** (see detailed spec in user-flow.md Journey 3.2):
1. **Controls Definition Interface**
   - Visual keyboard picker (click keys to select)
   - Primary/secondary controls lists
   - Mouse interaction toggles
   - Preset buttons for common control schemes

2. **Start Button Configuration**
   - CSS selector input
   - Button text input
   - Position selector
   - Wait time configuration

3. **Game States Builder**
   - Add/remove/reorder game states
   - For each state:
     - Name input
     - Expected elements builder
     - Required actions builder
     - Optional screenshot upload
   - Drag-to-reorder functionality

4. **Live JSON Preview**
   - Side/bottom panel
   - Syntax-highlighted display
   - Real-time updates
   - Copy to clipboard
   - Validates against game-manifest-schema.md

5. **Manifest Versioning UI**
   - List all manifest versions for a game
   - Create new version (with clone option)
   - Set active manifest
   - View/edit/delete versions
   - Version notes and change tracking

**Deliverable**: 
- Full web UI for games, manifests, and testing
- Embedded manifest generator eliminates need for manual JSON editing
- Manifest versioning support

---

### 2. Batch Testing

**Goal**: Enable testing multiple games in sequence with aggregated reporting.

**Steps**:
1. Update CLI to accept multiple URLs or CSV file with game IDs
2. Create `src/agent/batch-runner.ts` with batch execution logic
3. Implement sequential execution of multiple tests
4. Aggregate results: total tests, passed, failed, average playability score
5. Output aggregated report (JSON or formatted text)
6. Store batch results in database with batch_id linking tests
7. Handle partial failures gracefully (continue with remaining tests)
8. Add batch view to web UI (if built)

**Deliverable**: Can test multiple games in one command with aggregated results

---

### 3. Advanced Metrics

**Goal**: Capture and analyze advanced game performance metrics.

**Steps**:
1. Implement FPS monitoring (if accessible via browser APIs)
2. Measure page load time (time to first render, time to interactive)
3. Monitor network requests (failed requests, slow requests)
4. Track accessibility issues (basic checks via browser APIs)
5. Store metrics in database
6. Include metrics in evaluation result
7. Display metrics in web UI (if built)

**Deliverable**: Advanced metrics captured and included in test results

---

### 4. GIF Recording

**Goal**: Capture gameplay as animated GIF for visual reports.

**Steps**:
1. Research GIF recording options (browser APIs, screen recording libraries)
2. Implement frame capture during gameplay (every 1-2 seconds)
3. Convert frames to animated GIF
4. Upload GIF to Supabase Storage
5. Include GIF URL in test results
6. Display GIF in web UI results page (if built)

**Deliverable**: Animated GIF of gameplay created and stored

---

### 5. Comparison Across LLM Models

**Goal**: Allow testing different LLM models and comparing results.

**Steps**:
1. Update configuration to support multiple LLM providers
2. Implement evaluation with multiple models (if cost allows)
3. Compare results across models
4. Store model-specific results in database
5. Display comparison in web UI (if built)
6. Document accuracy differences

**Deliverable**: Can evaluate games with different LLM models and compare results

---

### 6. Settings/Configuration Interface

**Goal**: Allow users to configure agent behavior (timeouts, retries, LLM model, etc.).

**Steps**:
1. Create configuration schema (timeouts, retries, screenshot count, LLM model)
2. Support configuration via CLI flags
3. Support configuration via config file (JSON or YAML)
4. Store user preferences in database (if web UI built)
5. Apply configuration throughout agent execution
6. Document all configuration options

**Deliverable**: Agent behavior can be configured via flags or config file

---

### 7. Test Result Export

**Goal**: Export test results in various formats (CSV, JSON, PDF report).

**Steps**:
1. Implement JSON export (already have this, enhance format)
2. Implement CSV export for batch results
3. Implement PDF report generation (optional, requires library)
4. Include screenshots and logs in export (zip file)
5. Add export functionality to CLI and web UI (if built)

**Deliverable**: Test results can be exported in multiple formats

---

### 8. Real-Time Progress Updates

**Goal**: Provide real-time progress updates during test execution (for web UI).

**Steps**:
1. Implement WebSocket or Server-Sent Events for progress updates
2. Emit progress events during agent execution (phases)
3. Update web UI in real-time as test progresses
4. Show current phase, percentage complete, estimated time remaining
5. Handle connection drops gracefully

**Deliverable**: Web UI shows real-time progress during test execution

---

## Implementation Notes

### Priority Order

If implementing stretch features, recommended order:
1. **Web Dashboard UI with Manifest Generator** - Highest value, enables easy game/manifest management
2. **Batch Testing** - Most useful for QA workflows
3. **Settings/Configuration** - Improves usability
4. **Test Result Export** - Useful for reporting
5. **Advanced Metrics** - Nice to have
6. **GIF Recording** - Nice to have
7. **LLM Model Comparison** - Experimental/analysis feature
8. **Real-Time Progress** - Enhances web UI experience

### Integration Considerations

- All stretch features should integrate cleanly with existing core functionality
- Don't break existing CLI or Lambda functionality
- Maintain backward compatibility
- Update documentation for any new features
- Follow project-rules.md for all new code

---

## Deliverables Checklist

Stretch features are optional. Complete based on time and priorities:

- [ ] Batch testing implemented (if prioritized)
- [ ] Web dashboard UI built (if prioritized)
- [ ] Advanced metrics captured (if prioritized)
- [ ] GIF recording works (if prioritized)
- [ ] Configuration interface added (if prioritized)
- [ ] Export functionality implemented (if prioritized)
- [ ] Documentation updated with stretch features

---

## Notes

- Stretch features should only be implemented after core MVP is complete and polished
- Prioritize based on user needs and project timeline
- Web UI is a significant feature that could be a separate phase
- Some stretch features (like GIF recording) may require additional dependencies
- Monitor costs for advanced features (multiple LLM evaluations, storage for GIFs)

---

## Completion

After completing stretch features (if any), the project is feature-complete. The QA Pipeline should be ready for production use with comprehensive documentation.

