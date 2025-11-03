# DreamUp: Browser Game QA Pipeline

**Version:** 1.1  
**Date:** November 3, 2025  
**Timeline:** 3-5 days core implementation \+ optional stretch features

## Overview

DreamUp is a general AI game generator that began at Gauntlet’s first 24-hour hackathon. For the purposes of this project, you can work with browser games from any source you want. Ultimately, if successful, your project would be used to help make our game-building-agent pipeline capable of automated self-improvement.

### Objective

Build an AI agent that autonomously tests browser games by simulating user interactions, capturing visual evidence, and evaluating playability metrics. The system must work with any web-hosted game URL.

### Business Value

- Solution may be used to automate game QA for DreamUp's generated games  
- Enables feedback loops for game-building agent improvement  
- Demonstrates production-ready AI agent architecture

### Success Criteria

- Successfully tests 3+ diverse browser games end-to-end  
- Generates structured reports with 80%+ accuracy on playability assessment  
- Handles common failure modes gracefully (crashes, slow loads, rendering issues)  
- Clean, documented, modular codebase

## Scope

### In Scope (Core Features \- Days 1-5)

1. **Browser Automation Agent**  
     
   - Load game from URL  
   - Detect and handle common UI patterns (start buttons, menus, game over screens)  
   - Walk through the game based on the controls it finds  
   - Implement timeouts and retry logic

   

2. **Evidence Capture**  
     
   - Take 3-5 timestamped screenshots per test session  
   - Save artifacts to structured output directory  
   - Include console logs and error messages

   

3. **AI Evaluation**  
     
   - Use LLM to analyze screenshots and logs  
   - Assess: successful load, responsive controls, stability  
   - Output structured JSON with pass/fail, confidence scores, and issue descriptions

   

4. **Execution Interface**  
     
   - Our game dev agent runs in a lambda function and we would like to invoke the QA from this environment  
   - Typescript file is preferred (i.e. executed with `bun run qa.ts`, `npx tsx qa.ts`, etc.)  
   - Running with a CLI command is acceptable too: `qa-agent <game-url>`  
   - Structured output: `{status, playability_score, issues[], screenshots[], timestamp}` 

### Out of Scope

- Multiplayer or network-dependent games  
- Mobile browser emulation  
- Security/performance testing  
- Integration with DreamUp production systems (prototype only)

### Optional Stretch Features (If Time Permits)

- **GIF Recording:** Capture gameplay as animated GIF for reports  
- **Batch Testing:** Sequential testing of multiple URLs with aggregated reporting  
- **Advanced Metrics:** FPS monitoring, load time analysis, accessibility checks  
- **Web Dashboard:** Simple UI for viewing test results and history

## Technical Architecture

### Stack

- **Browser Use:** [Browserbase](https://www.browserbase.com/) w/ [Stagehand](https://www.npmjs.com/package/@browserbasehq/stagehand) (recommended) or alternative  
- **Language:** Typescript preferred, though any language is allowed  
- **AI Framework:** Vercel’s AI SDK preferred

### Agent Design

1. Initialize → Load game URL in headless browser  
2. Observe → Wait for initial render, capture baseline screenshot  
3. Interact → Execute action sequence:  
   1. Find and click start/play buttons  
   2. Simulate basic gameplay (arrow keys, spacebar, mouse clicks)  
   3. Navigate 2-3 screens/levels if applicable  
4. Monitor → Detect crashes, freezes, or errors via:  
   1. Console error logs  
   2. Page state changes  
   3. Screenshot comparison  
5. Evaluate → Submit evidence to LLM with structured prompt:  
   1. "Does the game load successfully?"  
   2. "Are controls responsive?"  
   3. "Did the game complete without crashes?"  
6. Report → Generate JSON output with findings

### Error Handling

- Max execution time: 5 minutes per game  
- Retry failed loads up to 3 times  
- Graceful degradation if screenshots fail

## Deliverables

### Required

1. **Source Code:** GitHub repository with clear structure  
2. **Documentation:** README with setup, usage, and architecture overview  
3. **Test Results:** QA reports for 3-5 sample games (include screenshots)  
4. **Demo:** 2-5 minute video showing end-to-end execution

### Optional

- Unit and integration tests  
- Docker containerization for easy setup  
- Comparison of results across different LLM models

## Timeline

| Day | Focus | Deliverable |
| :---- | :---- | :---- |
| 1 | Setup \+ Basic Agent | Browser launches, navigates to URL, takes screenshots |
| 2 | Interaction System | Basic game interaction working |
| 3 | LLM Evaluation | AI assessment integrated, JSON output format |
| 4 | Error Handling \+ Testing | Robust failure modes, tested on 3+ games |
| 5 | Polish \+ Documentation | README, code cleanup, demo video |
| 6-7 | Stretch Features | *Optional:* batch mode, vision analysis, or dashboard |

## Test Cases

Validate against diverse game types:

1. **Simple Puzzle:** Basic click interactions (e.g., tic-tac-toe)  
2. **Platformer:** Keyboard controls, physics (e.g., simple Mario clone)  
3. **Idle/Clicker:** Minimal interaction, persistent state  
4. **Broken Game:** Intentionally buggy game to test failure detection  
5. **Complex Game:** Multiple levels/screens (e.g., RPG demo)

Find test games at: [itch.io/games/html5](http://itch.io/games/html5) or create simple test cases.

## Evaluation Criteria

- **Functionality:** Core features work as specified  
- **Code Quality:** Clean architecture, proper error handling, documentation  
- **AI Integration:** Effective prompts, accurate evaluations  
- **Robustness:** Handles edge cases, recovers from failures

## Risks & Mitigations

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| Agent loops infinitely | High | Max action count, total timeout |
| LLM gives inconsistent results | Medium | Structured prompts, confidence thresholds, fallback heuristics |
| Games don't load in headless mode | High | Test with headed mode, screenshot comparison |
| Scope creep | High | Strict adherence to 3-5 day core; no stretches until complete |
| API costs exceed budget | Low | Cache responses, use cheaper models for iteration |

## Getting Started

Recommended approach:

1. Set up Browserbase (free tier has 1 browser-hour included)  
2. Create minimal agent that loads a game and takes a screenshot  
3. Add one interaction type at a time  
4. Integrate LLM evaluation last (can mock initially)  
5. Iterate on real games early and often

## Contact:

[Matt Smith](mailto:matt.smith@superbuilders.school) (slack or email: matt.smith@superbuilders.school)