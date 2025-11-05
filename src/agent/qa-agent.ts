/**
 * File: src/agent/qa-agent.ts
 * 
 * QA agent orchestrator for browser game testing.
 * 
 * This module provides the main QA agent that orchestrates the entire testing workflow:
 * Initialize browser → Load game → Interact → Capture evidence → Evaluate → Store results.
 * Handles timeouts, errors, and ensures proper cleanup of resources.
 * 
 * @module QAAgent
 */

import { BrowserClient } from '../browser/browser-client.js';
import { captureScreenshot, captureMultipleScreenshots } from '../browser/screenshot-capture.js';
import { collectConsoleLogs, finalizeConsoleLogs } from '../browser/console-logger.js';
import { findStartButton, clickElement } from '../browser/ui-pattern-detector.js';
import type { ConsoleLogEntry } from '../browser/console-logger.js';
import type { TestResult } from '../cli/output-formatter.js';
import { createSuccessResult, createErrorResult, createTimeoutResult, outputTimeline } from '../cli/output-formatter.js';
import { LLMEvaluator } from '../evaluation/llm-evaluator.js';
import { parseManifest, getGameplayDuration, getScreenshotIntervals, getGameplayGoal, getAiDecisionInterval } from '../utils/manifest-parser.js';
import { createAgentState, updatePhase, addScreenshot, setConsoleLogsUrl, setError, finalizeState, addTimelineEvent } from './agent-state.js';
import type { AgentState } from './agent-state.js';
import type { ManifestData, GameUpdate } from '../storage/types.js';
import { saveTestRun, getDatabase } from '../storage/database.js';
import { QAAgentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { MAX_EXECUTION_TIME_MS, DEFAULT_LOADING_DURATION_MS, START_BUTTON_WAIT_MS } from '../utils/constants.js';

/**
 * QA agent execution result.
 */
export interface AgentResult {
  success: boolean;
  result: TestResult;
  duration_ms: number;
}

/**
 * QA Agent run parameters.
 */
export interface QAAgentRunParams {
  gameUrl: string;
  testId: string;
  gameId?: string;
  manifestId?: string | null;
  manifest?: ManifestData | null;
  gameName?: string;
  gameType?: string | null;
}

/**
 * QA Agent for autonomous game testing.
 * 
 * Orchestrates the complete testing workflow including browser initialization,
 * game loading, interaction, evidence capture, LLM evaluation, and result storage.
 */
export class QAAgent {
  private browserClient: BrowserClient;
  private consoleLogEntries: ConsoleLogEntry[] = [];
  private llmEvaluator: LLMEvaluator;
  
  constructor() {
    this.browserClient = new BrowserClient();
    this.llmEvaluator = new LLMEvaluator();
  }

  /**
   * Run QA test for a game.
   * 
   * Executes the complete QA workflow with all enhancements:
   * 1. Initialize browser session
   * 2. Load game URL (with retry)
   * 3. Parse manifest if available
   * 4. Find and click start button (manifest → AI fallback)
   * 5. Simulate gameplay (manifest controls or defaults)
   * 6. Capture multiple screenshots (event-based or time-based)
   * 7. Collect console logs
   * 8. Evaluate with LLM
   * 9. Save results to database
   * 10. Return structured result
   * 
   * Includes timeout handling (5 minutes max) and proper cleanup even on errors.
   * 
   * @param {QAAgentRunParams} params - Test execution parameters
   * @returns {Promise<AgentResult>} Test execution result
   * 
   * @example
   * ```typescript
   * const agent = new QAAgent();
   * const result = await agent.run({
   *   gameUrl: 'https://example.com/game',
   *   testId: 'test-123',
   *   gameId: 'game-uuid',
   *   gameName: 'Example Game'
   * });
   * ```
   */
  async run(params: QAAgentRunParams): Promise<AgentResult> {
    const state = createAgentState({
      testId: params.testId,
      gameUrl: params.gameUrl,
      gameId: params.gameId,
      manifestId: params.manifestId,
      manifest: params.manifest || null,
    });

    try {
      logger.info('Starting QA test', {
        testId: state.testId,
        gameUrl: state.gameUrl,
        gameId: state.gameId,
        hasManifest: !!state.manifest,
      });

      // Set up timeout
      const timeoutPromise = this.createTimeout(state.testId);
      const testPromise = this.executeTest(state, params);

      // Race between test execution and timeout
      const testResult = await Promise.race([testPromise, timeoutPromise]);
      
      // Extract state and result (timeout returns just result, test returns both)
      const updatedState = 'state' in testResult ? testResult.state : state;
      const result = 'state' in testResult ? testResult.result : testResult;

      const duration_ms = Date.now() - updatedState.startTime;

      logger.info('QA test completed', {
        testId: state.testId,
        status: result.status,
        duration_ms,
      });

      // Try to save to database (don't fail if this fails)
      try {
        await this.saveResultsToDatabase(updatedState, result, params);
      } catch (dbError) {
        logger.error('Failed to save results to database', {
          testId: state.testId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        // Continue - don't fail the test if DB save fails
      }

      return {
        success: result.status === 'pass' || result.status === 'fail',
        result: {
          ...result,
          duration_ms,
          game_url: params.gameUrl,
          game_name: params.gameName,
          test_id: params.testId,
        },
        duration_ms,
      };
    } catch (error) {
      const duration_ms = Date.now() - state.startTime;
      const message = error instanceof Error ? error.message : String(error);

      logger.error('QA test failed with error', {
        testId: state.testId,
        error: message,
        duration_ms,
      });

      const errorState = setError(state, message);
      const errorResult = createErrorResult(message, {
        screenshots: errorState.screenshots,
        console_logs: errorState.consoleLogsUrl || null,
        duration_ms,
        game_url: params.gameUrl,
        game_name: params.gameName,
        test_id: params.testId,
      });

      // Try to save error result to database
      try {
        await this.saveResultsToDatabase(errorState, errorResult, params);
      } catch (dbError) {
        logger.error('Failed to save error results to database', {
          testId: state.testId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }

      return {
        success: false,
        result: errorResult,
        duration_ms,
      };
    } finally {
      // Always close browser session
      await this.browserClient.closeSession();
    }
  }

  /**
   * Execute the test workflow.
   * 
   * Internal method that runs the actual test steps without timeout handling.
   * 
   * @param {AgentState} state - Agent state
   * @param {QAAgentRunParams} params - Test parameters
   * @returns {Promise<{state: AgentState, result: TestResult}>} Updated state and test result
   * @private
   */
  private async executeTest(
    state: AgentState,
    params: QAAgentRunParams
  ): Promise<{state: AgentState, result: TestResult}> {
    let currentState = state;

    try {
      // Phase 1: Initialize browser session
      currentState = updatePhase(currentState, 'initializing');
      currentState = addTimelineEvent(currentState, 'browser_init_start', 'Starting browser session initialization');
      logger.info('Initializing browser session', { testId: currentState.testId });
      await this.browserClient.initializeSession();
      
      // Capture BrowserBase session URL for live viewing
      const sessionUrl = this.browserClient.getSessionUrl();
      const sessionId = this.browserClient.getSessionId();
      currentState = addTimelineEvent(currentState, 'browser_init_complete', 'Browser session initialized', {
        sessionUrl,
        sessionId,
      });

      // Phase 2: Set up console log collection
      logger.info('Setting up console log collection', { testId: currentState.testId });
      const logsResult = await collectConsoleLogs(this.browserClient, currentState.testId);
      this.consoleLogEntries = logsResult.entries;
      currentState = addTimelineEvent(currentState, 'console_logs_collected', 'Console log collection initialized');

      // Phase 3: Load game URL (with retry logic built into browser-client)
      currentState = updatePhase(currentState, 'loading');
      currentState = addTimelineEvent(currentState, 'page_load_start', 'Navigating to game URL', { url: currentState.gameUrl });
      logger.info('Loading game', { testId: currentState.testId, gameUrl: currentState.gameUrl });
      const pageLoadStartTime = Date.now();
      await this.browserClient.loadGame(currentState.gameUrl);
      
      // Wait for initial render with intelligent detection
      const loadingDuration = currentState.manifest?.loadingDuration || DEFAULT_LOADING_DURATION_MS;
      logger.info('Waiting for game to load', { testId: currentState.testId, duration: loadingDuration });
      await this.browserClient.waitForLoad(loadingDuration);
      const pageLoadActualDuration = Date.now() - pageLoadStartTime;
      currentState = addTimelineEvent(currentState, 'page_load_complete', 'Page finished loading', { 
        configuredDuration: loadingDuration,
        actualDuration: pageLoadActualDuration 
      });

      // Capture baseline screenshot
      logger.info('Capturing baseline screenshot', { testId: currentState.testId });
      currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Starting baseline screenshot capture');
      const screenshotStartTime = Date.now();
      
      // Capture screenshot buffer first
      const { captureScreenshotBuffer } = await import('../browser/screenshot-capture.js');
      const buffer = await captureScreenshotBuffer(this.browserClient, currentState.testId, 0);
      const captureDuration = Date.now() - screenshotStartTime;
      
      if (buffer) {
        currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Screenshot buffer captured', { 
          index: 0,
          captureDurationMs: captureDuration,
          bufferSize: buffer.length
        });
        
        // Upload screenshot
        const uploadStartTime = Date.now();
        const { uploadScreenshot } = await import('../storage/file-storage.js');
        const baselineScreenshot = await uploadScreenshot(buffer, currentState.testId, 0);
        const uploadDuration = Date.now() - uploadStartTime;
        
        if (baselineScreenshot) {
          currentState = addScreenshot(currentState, baselineScreenshot);
          currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Baseline screenshot uploaded', { 
            index: 0, 
            url: baselineScreenshot,
            captureDurationMs: captureDuration,
            uploadDurationMs: uploadDuration,
            totalDurationMs: Date.now() - screenshotStartTime
          });
        }
      }

      // Phase 4: Interaction
      currentState = updatePhase(currentState, 'interacting');
      currentState = addTimelineEvent(currentState, 'phase_change', 'Entering interaction phase');
      
      // Find and click start button using StageHand AI
      currentState = addTimelineEvent(currentState, 'start_button_search_start', 'Searching for start button using Stagehand AI');
      const startButtonLocation = await findStartButton(this.browserClient, currentState.manifest || null);
      
      if (!startButtonLocation.element) {
        // Start button not found - this is a critical failure
        const errorMessage = 'Start button not found by StageHand AI. Cannot proceed with test.';
        logger.error(errorMessage, {
          testId: currentState.testId,
          method: startButtonLocation.method,
          failureScreenshot: startButtonLocation.failureScreenshot,
          allButtonsFound: startButtonLocation.allButtonsFound?.map(b => b.description),
        });

        // Add failure screenshot to state if available
        if (startButtonLocation.failureScreenshot) {
          currentState = addScreenshot(currentState, startButtonLocation.failureScreenshot);
        }

        // Create detailed error message with diagnostic info
        let detailedError = errorMessage;
        if (startButtonLocation.allButtonsFound && startButtonLocation.allButtonsFound.length > 0) {
          detailedError += `\n\nButtons found on page (${startButtonLocation.allButtonsFound.length}):`;
          startButtonLocation.allButtonsFound.forEach((btn, i) => {
            detailedError += `\n  ${i + 1}. ${btn.description} (${btn.method || 'no method'})`;
          });
        } else {
          detailedError += '\n\nNo buttons found on page.';
        }
        
        if (startButtonLocation.failureScreenshot) {
          detailedError += `\n\nFailure screenshot: ${startButtonLocation.failureScreenshot}`;
        }

        throw new Error(detailedError);
      }

      // Button found - click it
      logger.info('Start button found using StageHand, clicking', {
        testId: currentState.testId,
        method: startButtonLocation.method,
        description: startButtonLocation.element.description,
      });
      currentState = addTimelineEvent(currentState, 'start_button_found', 'Start button detected', {
        method: startButtonLocation.method,
        description: startButtonLocation.element.description,
      });
      
      await clickElement(this.browserClient, startButtonLocation);
      currentState = addTimelineEvent(currentState, 'start_button_clicked', 'Start button clicked successfully');

      // Wait after clicking start button
      const waitAfterClick = currentState.manifest?.startButton?.waitAfterClick || START_BUTTON_WAIT_MS;
      await new Promise(resolve => setTimeout(resolve, waitAfterClick));

      // Capture screenshot after start click
      const afterStartScreenshot = await captureScreenshot(this.browserClient, currentState.testId, 1);
      if (afterStartScreenshot) {
        currentState = addScreenshot(currentState, afterStartScreenshot);
        currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Post-click screenshot captured', { index: 1 });
      }

      // Simulate gameplay
      const gameplayDuration = getGameplayDuration(currentState.manifest || null, 45000); // Default 45s
      await this.simulateGameplay(currentState, gameplayDuration);

      // Phase 5: Monitoring - capture remaining screenshots
      currentState = updatePhase(currentState, 'monitoring');
      const screenshotIntervals = getScreenshotIntervals(currentState.manifest || null);
      
      if (screenshotIntervals) {
        // Time-based screenshot capture (null check above ensures non-null)
        currentState = await this.captureScreenshotsTimeBased(currentState, screenshotIntervals as number[]);
      } else {
        // Event-based: capture final screenshot
        const finalScreenshot = await captureScreenshot(this.browserClient, currentState.testId, currentState.screenshots.length);
        if (finalScreenshot) {
          currentState = addScreenshot(currentState, finalScreenshot as string);
        }
      }

      // Finalize console logs
      logger.info('Finalizing console logs', { testId: currentState.testId });
      const consoleLogsUrl = await finalizeConsoleLogs(this.consoleLogEntries, currentState.testId);
      currentState = setConsoleLogsUrl(currentState, consoleLogsUrl);

      // Phase 6: Evaluation
      currentState = updatePhase(currentState, 'evaluating');
      const evaluationResult = await this.llmEvaluator.evaluate({
        screenshotUrls: currentState.screenshots.filter(url => url !== null) as string[],
        consoleLogs: this.formatConsoleLogs(),
        gameMetadata: {
          name: params.gameName || 'Unknown Game',
          type: params.gameType || null,
          url: params.gameUrl,
        },
        manifest: currentState.manifest || null,
      });

      // Build issues list
      const issues: string[] = [...evaluationResult.issues];
      
      // Add console errors
      const errorLogs = this.consoleLogEntries.filter(e => e.type === 'error');
      if (errorLogs.length > 0) {
        issues.push(`${errorLogs.length} console error(s) detected`);
        errorLogs.slice(0, 3).forEach(log => {
          issues.push(`Console error: ${log.text}`);
        });
      }

      // Create result
      currentState = finalizeState(currentState);
      logger.info('Test execution completed successfully', { testId: currentState.testId });

      const successResult = createSuccessResult(
        {
          screenshots: currentState.screenshots,
          console_logs: currentState.consoleLogsUrl || null,
          issues,
        },
        {
          playability_score: evaluationResult.playabilityScore,
        }
      );
      
      return { state: currentState, result: successResult };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Test execution failed', {
        testId: currentState.testId,
        error: message,
      });

      currentState = addTimelineEvent(currentState, 'error', `Error: ${message}`, { phase: currentState.phase });
      currentState = setError(currentState, message);

      const errorResult = createErrorResult(message, {
        screenshots: currentState.screenshots,
        console_logs: currentState.consoleLogsUrl || null,
      });
      
      return { state: currentState, result: errorResult };
    }
  }

  /**
   * Build AI gameplay prompt for Stagehand.
   * 
   * Constructs a concise prompt for the AI to guide gameplay decisions.
   * Stagehand's act() method already sees the screenshot, so we only need
   * to provide essential context: game type, controls, and goal.
   * 
   * @param {string} gameType - Type of game (puzzle, platformer, etc.)
   * @param {string[]} controls - Available control keys from manifest
   * @param {string} goal - Gameplay goal/objective
   * @returns {string} Concise prompt for AI action
   * @private
   */
  private buildGameplayPrompt(
    gameType: string,
    controls: string[],
    goal: string
  ): string {
    let prompt = `Play this ${gameType} game. `;
    prompt += `Goal: ${goal}. `;
    
    if (controls.length > 0) {
      prompt += `Use these controls: ${controls.join(', ')}.`;
    } else {
      prompt += `Use mouse controls.`;
    }
    
    return prompt;
  }

  /**
   * Simulate gameplay using AI-powered decision making.
   * 
   * Uses Stagehand's act() to intelligently play the game based on manifest controls
   * and gameplay goals. Stagehand's act() method uses visual understanding from
   * screenshots, so we provide only essential context (game type, controls, goal).
   * The AI makes decisions at regular intervals and executes actions accordingly.
   * 
   * @param {AgentState} state - Agent state
   * @param {number} durationMs - Duration to simulate gameplay in milliseconds
   * @private
   */
  private async simulateGameplay(state: AgentState, durationMs: number): Promise<void> {
    const page = this.browserClient.getPage();
    
    // Extract game context from manifest
    const gameType = state.manifest?.gameType || 'other';
    const controls = state.manifest?.controls || {
      primary: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
    };
    const gameplayGoal = getGameplayGoal(state.manifest || null);
    const aiDecisionInterval = getAiDecisionInterval(state.manifest || null);

    logger.info('Starting AI-powered gameplay simulation', {
      testId: state.testId,
      duration: durationMs,
      gameType,
      controls: controls.primary,
      gameplayGoal,
      aiDecisionInterval,
    });

    const startTime = Date.now();
    let decisionCount = 0;

    // AI decision loop - runs until duration expires
    while (Date.now() - startTime < durationMs) {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = durationMs - elapsedTime;
      
      try {
        decisionCount++;
        logger.info(`AI decision cycle ${decisionCount}`, {
          testId: state.testId,
          elapsedMs: elapsedTime,
          remainingMs: remainingTime,
        });

        // Build concise action prompt - Stagehand's act() sees the screenshot visually
        const actionPrompt = this.buildGameplayPrompt(
          gameType,
          controls.primary,
          gameplayGoal
        );

        logger.debug('AI action prompt', {
          testId: state.testId,
          prompt: actionPrompt,
        });

        // Execute AI action - Stagehand uses visual understanding from screenshot
        try {
          await page.act(actionPrompt);
          
          logger.info('AI action executed successfully', {
            testId: state.testId,
            decisionNumber: decisionCount,
          });
        } catch (actError) {
          // Fallback: If AI action fails, press a random control key
          logger.warn('AI action failed, falling back to keyboard control', {
            testId: state.testId,
            error: actError instanceof Error ? actError.message : String(actError),
          });

          if (controls.primary.length > 0) {
            // Pick a random key from available controls
            const randomIndex = Math.floor(Math.random() * controls.primary.length);
            const randomKey = controls.primary[randomIndex];
            
            if (randomKey) {
              try {
                await page.keyboard.press(randomKey);
                logger.info('Fallback keyboard action executed', {
                  testId: state.testId,
                  key: randomKey,
                });
              } catch (keyError) {
                logger.error('Fallback keyboard action also failed', {
                  testId: state.testId,
                  key: randomKey,
                  error: keyError instanceof Error ? keyError.message : String(keyError),
                });
              }
            }
          }
        }

        // Step 4: Wait for next decision interval (or remaining time, whichever is shorter)
        const waitTime = Math.min(aiDecisionInterval, remainingTime);
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } catch (error) {
        // Catch any unexpected errors in decision loop
        logger.error('Error in AI gameplay decision loop', {
          testId: state.testId,
          decisionNumber: decisionCount,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Wait a bit before trying again to avoid rapid error loops
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('AI gameplay simulation completed', {
      testId: state.testId,
      totalDecisions: decisionCount,
      totalDuration: Date.now() - startTime,
    });
  }

  /**
   * Capture screenshots at time-based intervals.
   * 
   * @param {AgentState} state - Agent state
   * @param {number[]} intervals - Screenshot intervals in milliseconds
   * @returns {Promise<AgentState>} Updated agent state
   * @private
   */
  private async captureScreenshotsTimeBased(state: AgentState, intervals: number[]): Promise<AgentState> {
    logger.info('Capturing time-based screenshots', {
      testId: state.testId,
      intervals,
    });

    let currentState = state;
    const startTime = Date.now();
    
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      if (interval === undefined) continue;
      
      const elapsed = Date.now() - startTime;
      const waitTime = Math.max(0, interval - elapsed);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const screenshot = await captureScreenshot(
        this.browserClient,
        currentState.testId,
        currentState.screenshots.length
      );
      if (screenshot) {
        currentState = addScreenshot(currentState, screenshot);
      }
    }
    
    return currentState;
  }

  /**
   * Format console logs as text string.
   * 
   * @returns {string} Formatted console logs
   * @private
   */
  private formatConsoleLogs(): string {
    return this.consoleLogEntries
      .map(entry => `[${entry.type.toUpperCase()}] ${entry.timestamp} ${entry.text}`)
      .join('\n');
  }

  /**
   * Save test results to database.
   * 
   * @param {AgentState} state - Agent state
   * @param {TestResult} result - Test result
   * @param {QAAgentRunParams} params - Test parameters
   * @private
   */
  private async saveResultsToDatabase(
    state: AgentState,
    result: TestResult,
    params: QAAgentRunParams
  ): Promise<void> {
    if (!params.gameId) {
      logger.warn('Cannot save to database - no gameId provided', { testId: state.testId });
      return;
    }

    try {
      logger.info('Saving test results to database', {
        testId: state.testId,
        gameId: params.gameId,
      });

      // Get BrowserBase session URL if available
      const sessionUrl = this.browserClient.getSessionUrl()
      
      await saveTestRun({
        game_id: params.gameId,
        manifest_id: params.manifestId || null,
        status: result.status,
        playability_score: result.playability_score,
        issues: result.issues,
        screenshots: result.screenshots,
        console_logs: result.console_logs,
        execution_method: 'cli',
        duration_ms: result.duration_ms || null,
        metadata: {
          testId: state.testId,
          gameUrl: params.gameUrl,
          gameName: params.gameName,
          timeline: state.timeline.events as any,
          browserbaseUrl: sessionUrl || null,
          browserbaseSessionId: this.browserClient.getSessionId() || null,
        } as any,
      });

      // Update last_tested_at timestamp
      const db = getDatabase();
      const gameUpdate: GameUpdate = { last_tested_at: new Date().toISOString() };
      const updateResult = await db
        .from('games')
        // @ts-expect-error - Supabase type inference issue with partial updates
        .update(gameUpdate)
        .eq('id', params.gameId);
      
      if (updateResult.error) {
        logger.warn('Failed to update last_tested_at timestamp', {
          testId: state.testId,
          error: updateResult.error.message,
        });
      }

      logger.info('Test results saved to database', { testId: state.testId });
      
      // Output timeline for debugging if debug mode is enabled
      if (process.env.DEBUG === 'true') {
        outputTimeline(state.timeline);
      }
    } catch (error) {
      logger.error('Failed to save test results to database', {
        testId: state.testId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create timeout promise.
   * 
   * @param {string} testId - Test run identifier
   * @returns {Promise<TestResult>} Promise that resolves to timeout result
   * @private
   */
  private createTimeout(testId: string): Promise<TestResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        logger.warn('Test execution timed out', {
          testId,
          timeout_ms: MAX_EXECUTION_TIME_MS,
        });
        resolve(createTimeoutResult());
      }, MAX_EXECUTION_TIME_MS);
    });
  }
}
