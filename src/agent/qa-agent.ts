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
import { createSuccessResult, createErrorResult, createTimeoutResult } from '../cli/output-formatter.js';
import { LLMEvaluator } from '../evaluation/llm-evaluator.js';
import { parseManifest, getGameplayDuration, getScreenshotIntervals } from '../utils/manifest-parser.js';
import { createAgentState, updatePhase, addScreenshot, setConsoleLogsUrl, setError, finalizeState } from './agent-state.js';
import type { AgentState } from './agent-state.js';
import type { ManifestData } from '../storage/types.js';
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
      const result = await Promise.race([testPromise, timeoutPromise]);

      const duration_ms = Date.now() - state.startTime;

      logger.info('QA test completed', {
        testId: state.testId,
        status: result.status,
        duration_ms,
      });

      // Try to save to database (don't fail if this fails)
      try {
        await this.saveResultsToDatabase(state, result, params);
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
   * @returns {Promise<TestResult>} Test result
   * @private
   */
  private async executeTest(
    state: AgentState,
    params: QAAgentRunParams
  ): Promise<TestResult> {
    let currentState = state;

    try {
      // Phase 1: Initialize browser session
      currentState = updatePhase(currentState, 'initializing');
      logger.info('Initializing browser session', { testId: currentState.testId });
      await this.browserClient.initializeSession();

      // Phase 2: Set up console log collection
      logger.info('Setting up console log collection', { testId: currentState.testId });
      const logsResult = await collectConsoleLogs(this.browserClient, currentState.testId);
      this.consoleLogEntries = logsResult.entries;

      // Phase 3: Load game URL (with retry logic built into browser-client)
      currentState = updatePhase(currentState, 'loading');
      logger.info('Loading game', { testId: currentState.testId, gameUrl: currentState.gameUrl });
      await this.browserClient.loadGame(currentState.gameUrl);

      // Wait for initial render
      const loadingDuration = currentState.manifest?.loadingDuration || DEFAULT_LOADING_DURATION_MS;
      logger.info('Waiting for game to load', { testId: currentState.testId, duration: loadingDuration });
      await this.browserClient.waitForLoad(loadingDuration);

      // Capture baseline screenshot
      logger.info('Capturing baseline screenshot', { testId: currentState.testId });
      const baselineScreenshot = await captureScreenshot(this.browserClient, currentState.testId, 0);
      if (baselineScreenshot) {
        currentState = addScreenshot(currentState, baselineScreenshot);
      }

      // Phase 4: Interaction
      currentState = updatePhase(currentState, 'interacting');
      
      // Find and click start button
      const startButtonLocation = await findStartButton(this.browserClient, currentState.manifest);
      if (startButtonLocation.locator) {
        logger.info('Start button found, clicking', {
          testId: currentState.testId,
          method: startButtonLocation.method,
        });
        await clickElement(this.browserClient, startButtonLocation);

        // Wait after clicking start button
        const waitAfterClick = currentState.manifest?.startButton?.waitAfterClick || START_BUTTON_WAIT_MS;
        await new Promise(resolve => setTimeout(resolve, waitAfterClick));

        // Capture screenshot after start click
        const afterStartScreenshot = await captureScreenshot(this.browserClient, currentState.testId, 1);
        if (afterStartScreenshot) {
          currentState = addScreenshot(currentState, afterStartScreenshot);
        }
      } else {
        logger.warn('Start button not found, skipping interaction', { testId: currentState.testId });
      }

      // Simulate gameplay
      const gameplayDuration = getGameplayDuration(currentState.manifest || null, 45000); // Default 45s
      await this.simulateGameplay(currentState, gameplayDuration);

      // Phase 5: Monitoring - capture remaining screenshots
      currentState = updatePhase(currentState, 'monitoring');
      const screenshotIntervals = getScreenshotIntervals(currentState.manifest || null);
      
      if (screenshotIntervals) {
        // Time-based screenshot capture
        currentState = await this.captureScreenshotsTimeBased(currentState, screenshotIntervals);
      } else {
        // Event-based: capture final screenshot
        const finalScreenshot = await captureScreenshot(this.browserClient, currentState.testId, currentState.screenshots.length);
        if (finalScreenshot) {
          currentState = addScreenshot(currentState, finalScreenshot);
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

      return createSuccessResult(
        {
          screenshots: currentState.screenshots,
          console_logs: currentState.consoleLogsUrl || null,
          issues,
        },
        {
          playability_score: evaluationResult.playabilityScore,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Test execution failed', {
        testId: currentState.testId,
        error: message,
      });

      currentState = setError(currentState, message);

      return createErrorResult(message, {
        screenshots: currentState.screenshots,
        console_logs: currentState.consoleLogsUrl || null,
      });
    }
  }

  /**
   * Simulate gameplay by pressing keys.
   * 
   * @param {AgentState} state - Agent state
   * @param {number} durationMs - Duration to simulate gameplay in milliseconds
   * @private
   */
  private async simulateGameplay(state: AgentState, durationMs: number): Promise<void> {
    const page = this.browserClient.getPage();
    const controls = state.manifest?.controls || {
      primary: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
    };

    logger.info('Simulating gameplay', {
      testId: state.testId,
      duration: durationMs,
      controls: controls.primary,
    });

    const startTime = Date.now();
    const keyPressInterval = 500; // Press a key every 500ms
    let keyIndex = 0;

    while (Date.now() - startTime < durationMs) {
      const key = controls.primary[keyIndex % controls.primary.length];
      try {
        await page.keyboard.press(key);
        await new Promise(resolve => setTimeout(resolve, keyPressInterval));
        keyIndex++;
      } catch (error) {
        logger.warn('Key press failed', {
          testId: state.testId,
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
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
        },
      });

      // Update last_tested_at timestamp
      const db = getDatabase();
      await db
        .from('games')
        .update({ last_tested_at: new Date().toISOString() })
        .eq('id', params.gameId);

      logger.info('Test results saved to database', { testId: state.testId });
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
