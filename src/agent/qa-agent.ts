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
import { StagehandClient } from '../browser/stagehand-client.js';
import { captureScreenshot, captureMultipleScreenshots, captureScreenshotBuffer } from '../browser/screenshot-capture.js';
import { collectConsoleLogs, finalizeConsoleLogs } from '../browser/console-logger.js';
import { findStartButton, clickElement } from '../browser/ui-pattern-detector.js';
import type { ConsoleLogEntry } from '../browser/console-logger.js';
import type { TestResult } from '../cli/output-formatter.js';
import { createSuccessResult, createErrorResult, createTimeoutResult, outputTimeline } from '../cli/output-formatter.js';
import { LLMEvaluator } from '../evaluation/llm-evaluator.js';
import { parseManifest, getGameplayDuration, getGameplayGoal, getAiDecisionInterval } from '../utils/manifest-parser.js';
import { createAgentState, updatePhase, addScreenshot, setConsoleLogsUrl, setError, finalizeState, addTimelineEvent } from './agent-state.js';
import type { AgentState } from './agent-state.js';
import type { ManifestData, GameUpdate } from '../storage/types.js';
import { saveTestRun, getDatabase } from '../storage/database.js';
import { QAAgentError, StorageError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { MAX_EXECUTION_TIME_MS, DEFAULT_LOADING_DURATION_MS, START_BUTTON_WAIT_MS } from '../utils/constants.js';
import { decideNextAction, type GameContext } from './vision-action-planner.js';
import OpenAI from 'openai';
import { getConfig } from '../utils/config.js';
import { uploadScreenshot } from '../storage/file-storage.js';

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
  private stagehandClient: StagehandClient;
  private consoleLogEntries: ConsoleLogEntry[] = [];
  private llmEvaluator: LLMEvaluator;
  
  constructor() {
    this.browserClient = new BrowserClient();
    this.stagehandClient = new StagehandClient();
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
        await this.saveResultsToDatabase(updatedState, result, params, duration_ms);
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
        await this.saveResultsToDatabase(errorState, errorResult, params, duration_ms);
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
      // Always cleanup resources
      try {
        await this.stagehandClient.cleanup();
      } catch (cleanupError) {
        logger.warn('Error during Stagehand cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
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
      // Phase 1: Initialize browser (using standard Playwright, not Stagehand)
      // NOTE: Stagehand v3.0.1 has compatibility issues - disabling for now
      currentState = updatePhase(currentState, 'initializing');
      currentState = addTimelineEvent(currentState, 'browser_init_start', 'Starting browser initialization');
      logger.info('Initializing browser client', { testId: currentState.testId });
      await this.browserClient.initializeSession();
      
      // Stagehand integration disabled due to compatibility issues
      // await this.stagehandClient.initialize();
      // const page = this.stagehandClient.getPage();
      // const context = this.stagehandClient.getContext();
      // await this.browserClient.initializeSession(page, context);
      
      // Browser session is local (no URL to capture)
      currentState = addTimelineEvent(currentState, 'browser_init_complete', 'Browser session initialized from Stagehand');

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
      const screenshotStartTime = Date.now();
      
      // Capture screenshot buffer first
      const { captureScreenshotBuffer } = await import('../browser/screenshot-capture.js');
      const buffer = await captureScreenshotBuffer(this.browserClient, currentState.testId, 0);
      const captureDuration = Date.now() - screenshotStartTime;
      
      if (buffer) {
        // Upload screenshot
        const uploadStartTime = Date.now();
        const { uploadScreenshot } = await import('../storage/file-storage.js');
        const baselineScreenshot = await uploadScreenshot(buffer, currentState.testId, 0);
        const uploadDuration = Date.now() - uploadStartTime;
        
        if (baselineScreenshot) {
          currentState = addScreenshot(currentState, baselineScreenshot);
          currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Baseline screenshot captured and uploaded', { 
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
      
      // Find and click start button (optional - some games don't have one)
      // Stagehand disabled - using standard Playwright click
      currentState = addTimelineEvent(currentState, 'start_button_search_start', 'Searching for start button');
      const startButtonLocation = await findStartButton(this.browserClient, null, currentState.testId);
      
      if (!startButtonLocation.success) {
        // Start button not found - log warning but continue (some games don't have start buttons)
        logger.warn('Start button not found - continuing without clicking start button', {
          testId: currentState.testId,
          method: startButtonLocation.method,
          failureScreenshot: startButtonLocation.failureScreenshot,
        });

        // Add failure screenshot to state if available
        if (startButtonLocation.failureScreenshot) {
          currentState = addScreenshot(currentState, startButtonLocation.failureScreenshot);
        }

        currentState = addTimelineEvent(currentState, 'start_button_not_found', 'No start button found - game may start automatically');
      } else {
        // Button found and clicked successfully
        logger.info('Start button clicked successfully using Stagehand', {
          testId: currentState.testId,
          method: startButtonLocation.method,
        });
        currentState = addTimelineEvent(currentState, 'start_button_found', 'Start button detected and clicked', {
          method: startButtonLocation.method,
        });
        
        currentState = addTimelineEvent(currentState, 'start_button_clicked', 'Start button clicked successfully');

        // Wait after clicking start button (AI-detected buttons need time to transition)
        await new Promise(resolve => setTimeout(resolve, START_BUTTON_WAIT_MS));

        // Capture screenshot after start click
        const afterStartScreenshot = await captureScreenshot(this.browserClient, currentState.testId, 1);
        if (afterStartScreenshot) {
          currentState = addScreenshot(currentState, afterStartScreenshot);
          currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Post-click screenshot captured', {
            index: 1,
            url: afterStartScreenshot,
          });
        }
      }

      // Simulate gameplay
      const gameplayDuration = getGameplayDuration(currentState.manifest || null, 45000); // Default 45s
      currentState = await this.simulateGameplay(currentState, gameplayDuration);

      // Phase 5: Monitoring - capture final screenshot
      currentState = updatePhase(currentState, 'monitoring');
      const finalScreenshot = await captureScreenshot(this.browserClient, currentState.testId, currentState.screenshots.length);
      if (finalScreenshot) {
        currentState = addScreenshot(currentState, finalScreenshot as string);
        currentState = addTimelineEvent(currentState, 'screenshot_captured', 'Final screenshot captured', {
          index: currentState.screenshots.length - 1,
          url: finalScreenshot,
        });
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
          test_id: currentState.testId,
          game_url: params.gameUrl,
          game_name: params.gameName,
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
        test_id: currentState.testId,
        game_url: params.gameUrl,
        game_name: params.gameName,
      });
      
      return { state: currentState, result: errorResult };
    }
  }


  /**
   * Simulate gameplay using GPT-4o-mini vision-based decision making.
   * 
   * Captures screenshots, sends them to GPT-4o-mini vision API to decide actions,
   * executes actions using Playwright, and stores screenshots in state.
   * 
   * @param {AgentState} state - Agent state
   * @param {number} durationMs - Duration to simulate gameplay in milliseconds
   * @returns {Promise<AgentState>} Updated agent state with screenshots from gameplay
   * @private
   */
  private async simulateGameplay(state: AgentState, durationMs: number): Promise<AgentState> {
    const page = this.browserClient.getPage();
    
    // Extract game context from manifest
    const gameType = state.manifest?.gameType || 'other';
    const controls = state.manifest?.controls || {
      primary: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
    };
    const gameplayGoal = getGameplayGoal(state.manifest || null);
    const aiDecisionInterval = getAiDecisionInterval(state.manifest || null);

    // Initialize OpenAI client
    const config = getConfig();
    if (config.llm.provider !== 'openai') {
      logger.error('OpenAI provider required for vision-based gameplay', {
        provider: config.llm.provider,
      });
      return state; // Return state unchanged if OpenAI not available
    }

    const openaiClient = new OpenAI({
      apiKey: config.llm.apiKey,
    });

    const gameContext: GameContext = {
      gameType,
      controls: controls.primary,
      goal: gameplayGoal,
    };

    logger.info('Starting vision-based gameplay simulation', {
      testId: state.testId,
      duration: durationMs,
      gameType,
      controls: controls.primary,
      gameplayGoal,
      aiDecisionInterval,
    });

    let currentState = state;
    currentState = addTimelineEvent(currentState, 'gameplay_start', 'Starting vision-based gameplay simulation', {
      duration: durationMs,
      gameType,
      controls: controls.primary,
      goal: gameplayGoal,
    });
    
    const startTime = Date.now();
    let decisionCount = 0;
    let screenshotIndex = currentState.screenshots.length;
    let previousScreenshotBase64: string | undefined = undefined;
    
    // Store screenshot buffers for batch upload after gameplay
    interface PendingScreenshot {
      buffer: Buffer;
      index: number;
      timestamp: number;
      decisionCycle: number;
    }
    const pendingScreenshots: PendingScreenshot[] = [];

    // AI decision loop - runs until duration expires
    while (Date.now() - startTime < durationMs) {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = durationMs - elapsedTime;
      
      try {
        decisionCount++;
        logger.info(`AI decision cycle ${decisionCount}`, {
          testId: currentState.testId,
          elapsedMs: elapsedTime,
          remainingMs: remainingTime,
          hasPreviousScreenshot: !!previousScreenshotBase64,
        });

        // 1. Capture screenshot
        const screenshotBuffer = await captureScreenshotBuffer(this.browserClient, currentState.testId, screenshotIndex);
        if (!screenshotBuffer) {
          logger.warn('Failed to capture screenshot, skipping decision cycle', {
            testId: currentState.testId,
            decisionNumber: decisionCount,
          });
          // Wait before next cycle
          const waitTime = Math.min(aiDecisionInterval, remainingTime);
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          continue;
        }

        // Convert to base64 for vision API
        const screenshotBase64 = screenshotBuffer.toString('base64');

        // 2. Decide action using vision (with previous screenshot for change detection)
        const action = await decideNextAction(screenshotBase64, gameContext, openaiClient, previousScreenshotBase64);
        
        // Store current screenshot as previous for next iteration
        previousScreenshotBase64 = screenshotBase64;

        logger.debug('Action decision made', {
          testId: currentState.testId,
          action: action.action,
          description: action.description,
        });

        // 3. Execute action
        try {
          if (action.action === 'click' && action.target) {
            // Use Stagehand to click the element based on natural language description
            const clickResult = await this.stagehandClient.clickElement(action.target);
            
            if (clickResult.success) {
              currentState = addTimelineEvent(currentState, 'gameplay_action', `Click action: ${action.description}`, {
                action: 'click',
                target: action.target,
                decisionCycle: decisionCount,
              });
              logger.info('Click action executed successfully', {
                testId: currentState.testId,
                target: action.target,
              });
            } else {
              // Stagehand failed to click - log and skip (as per plan requirement)
              logger.warn('Stagehand click action failed, skipping', {
                testId: currentState.testId,
                target: action.target,
                error: clickResult.error,
              });
              currentState = addTimelineEvent(currentState, 'gameplay_action_skipped', `Click action skipped: ${action.description}`, {
                action: 'click',
                target: action.target,
                decisionCycle: decisionCount,
                error: clickResult.error,
              });
            }
          } else if (action.action === 'key_press' && action.key) {
            // Press key on the page (standard Playwright)
            await page.keyboard.press(action.key);
            currentState = addTimelineEvent(currentState, 'gameplay_action', `Key press: ${action.key} - ${action.description}`, {
              action: 'key_press',
              key: action.key,
              decisionCycle: decisionCount,
            });
            logger.info('Key press action executed', {
              testId: currentState.testId,
              key: action.key,
            });
          } else if (action.action === 'wait' && action.duration !== undefined) {
            // Use setTimeout instead of page.waitForTimeout (deprecated in Playwright)
            await new Promise(resolve => setTimeout(resolve, action.duration));
            currentState = addTimelineEvent(currentState, 'gameplay_action', `Wait action: ${action.description}`, {
              action: 'wait',
              duration: action.duration,
              decisionCycle: decisionCount,
            });
            logger.info('Wait action executed', {
              testId: currentState.testId,
              duration: action.duration,
            });
          } else if (action.action === 'scroll') {
            // Scroll down by default
            await page.mouse.wheel(0, 300);
            currentState = addTimelineEvent(currentState, 'gameplay_action', `Scroll action: ${action.description}`, {
              action: 'scroll',
              decisionCycle: decisionCount,
            });
            logger.info('Scroll action executed', {
              testId: currentState.testId,
            });
          }
        } catch (actionError) {
          logger.warn('Action execution failed', {
            testId: currentState.testId,
            action: action.action,
            error: actionError instanceof Error ? actionError.message : String(actionError),
          });
          currentState = addTimelineEvent(currentState, 'error', `Action execution failed: ${action.action}`, {
            action: action.action,
            error: actionError instanceof Error ? actionError.message : String(actionError),
            decisionCycle: decisionCount,
          });
        }

        // 4. Store screenshot buffer for batch upload after gameplay
        // Store with timestamp and metadata for later upload
        pendingScreenshots.push({
          buffer: screenshotBuffer,
          index: screenshotIndex,
          timestamp: Date.now(),
          decisionCycle: decisionCount,
        });
        
        logger.debug('Screenshot buffer stored for batch upload', {
          testId: currentState.testId,
          index: screenshotIndex,
          decisionCycle: decisionCount,
          pendingCount: pendingScreenshots.length,
        });
        
        screenshotIndex++;

        // 5. Wait before next decision
        const waitTime = Math.min(aiDecisionInterval, remainingTime);
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } catch (error) {
        // Catch any unexpected errors in decision loop
        logger.error('Error in AI gameplay decision loop', {
          testId: currentState.testId,
          decisionNumber: decisionCount,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Wait a bit before trying again to avoid rapid error loops
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalDuration = Date.now() - startTime;
    
    logger.info('Vision-based gameplay simulation completed', {
      testId: currentState.testId,
      totalDecisions: decisionCount,
      totalDuration,
      screenshotsToUpload: pendingScreenshots.length,
    });

    // Upload all screenshots in parallel after gameplay completes
    logger.info('Starting batch upload of gameplay screenshots', {
      testId: currentState.testId,
      count: pendingScreenshots.length,
    });
    
    const uploadStartTime = Date.now();
    const uploadPromises = pendingScreenshots.map(async (pending) => {
      try {
        // Use the timestamp from when screenshot was captured
        const { uploadScreenshot } = await import('../storage/file-storage.js');
        const screenshotUrl = await uploadScreenshot(
          pending.buffer,
          currentState.testId,
          pending.index,
          pending.timestamp
        );
        
        return {
          url: screenshotUrl,
          index: pending.index,
          decisionCycle: pending.decisionCycle,
          timestamp: pending.timestamp,
        };
      } catch (uploadError) {
        logger.warn('Failed to upload screenshot in batch', {
          testId: currentState.testId,
          index: pending.index,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
        });
        return null;
      }
    });
    
    // Wait for all uploads to complete
    const uploadResults = await Promise.all(uploadPromises);
    const uploadDuration = Date.now() - uploadStartTime;
    
    // Sort results by index to maintain order
    const sortedResults = uploadResults
      .filter((result): result is NonNullable<typeof result> => result !== null)
      .sort((a, b) => a.index - b.index);
    
    // Add screenshots to state in order with correct timestamps
    // Use timeline startTime for consistency (it's the canonical test start time)
    const timelineStartTimeMs = new Date(currentState.timeline.startTime).getTime();
    for (const result of sortedResults) {
      currentState = addScreenshot(currentState, result.url);
      
      // Calculate elapsedMs from capture timestamp relative to test start
      const captureTimeMs = result.timestamp;
      const elapsedMs = captureTimeMs - timelineStartTimeMs;
      
      currentState = addTimelineEvent(
        currentState,
        'screenshot_captured',
        `Screenshot captured during gameplay (cycle ${result.decisionCycle})`,
        {
          index: result.index,
          url: result.url,
          decisionCycle: result.decisionCycle,
          timestamp: result.timestamp,
        },
        elapsedMs // Use custom elapsedMs based on capture timestamp
      );
    }
    
    const screenshotsCaptured = sortedResults.length;
    
    logger.info('Batch upload completed', {
      testId: currentState.testId,
      uploaded: screenshotsCaptured,
      failed: pendingScreenshots.length - screenshotsCaptured,
      uploadDurationMs: uploadDuration,
    });

    currentState = addTimelineEvent(currentState, 'gameplay_complete', 'Vision-based gameplay simulation completed', {
      totalDecisions: decisionCount,
      totalDurationMs: totalDuration,
      screenshotsCaptured,
      batchUploadDurationMs: uploadDuration,
    });

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
   * @param {number} durationMs - Test duration in milliseconds
   * @private
   */
  private async saveResultsToDatabase(
    state: AgentState,
    result: TestResult,
    params: QAAgentRunParams,
    durationMs: number
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

      // Browser session is local (no URL to capture)
      const sessionUrl = null;
      
      const db = getDatabase();
      
      // Check if a test run with this testId already exists (e.g., created by web API)
      const { data: existingTestRun } = await db
        .from('test_runs')
        .select('id')
        .eq('id', state.testId)
        .single();
      
      const executionMethod = existingTestRun ? 'web' : 'cli';
      
      if (existingTestRun) {
        // Update existing test run (created by web API)
        logger.info('Updating existing test run', { testRunId: state.testId });
        const { error: updateError } = await db
          .from('test_runs')
          // @ts-expect-error - Supabase type inference issue with partial updates
          .update({
            status: result.status,
            playability_score: result.playability_score,
            issues: result.issues,
            screenshots: result.screenshots,
            console_logs: result.console_logs,
            execution_method: executionMethod,
            duration_ms: durationMs,
            metadata: {
              testId: state.testId,
              gameUrl: params.gameUrl,
              gameName: params.gameName,
              timeline: state.timeline.events as any,
              browserbaseUrl: null,
              browserbaseSessionId: null,
            } as any,
          } as any)
          .eq('id', state.testId);
        
        if (updateError) {
          logger.error('Failed to update existing test run', {
            testId: state.testId,
            error: updateError.message,
          });
          throw new StorageError(`Failed to update test run: ${updateError.message}`, { testId: state.testId, error: updateError });
        }
      } else {
        // Create new test run (CLI execution)
        await saveTestRun({
          game_id: params.gameId,
          manifest_id: params.manifestId || null,
          status: result.status,
          playability_score: result.playability_score,
          issues: result.issues,
          screenshots: result.screenshots,
          console_logs: result.console_logs,
          execution_method: executionMethod,
          duration_ms: durationMs,
          metadata: {
            testId: state.testId,
            gameUrl: params.gameUrl,
            gameName: params.gameName,
            timeline: state.timeline.events as any,
            browserbaseUrl: null,
            browserbaseSessionId: null,
          } as any,
        });
      }

      // Update last_tested_at timestamp
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
