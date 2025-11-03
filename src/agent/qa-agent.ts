/**
 * File: src/agent/qa-agent.ts
 * 
 * QA agent orchestrator for browser game testing.
 * 
 * This module provides the main QA agent that orchestrates the entire testing workflow:
 * Initialize browser → Load game → Capture evidence → Collect logs → Close session.
 * Handles timeouts, errors, and ensures proper cleanup of resources.
 * 
 * @module QAAgent
 */

import { BrowserClient } from '../browser/browser-client.js';
import { captureScreenshot } from '../browser/screenshot-capture.js';
import { collectConsoleLogs, finalizeConsoleLogs } from '../browser/console-logger.js';
import type { ConsoleLogEntry } from '../browser/console-logger.js';
import type { TestResult } from '../cli/output-formatter.js';
import { createSuccessResult, createErrorResult, createTimeoutResult } from '../cli/output-formatter.js';
import { QAAgentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { MAX_EXECUTION_TIME_MS } from '../utils/constants.js';

/**
 * QA agent execution result.
 */
export interface AgentResult {
  success: boolean;
  result: TestResult;
  duration_ms: number;
}

/**
 * QA Agent for autonomous game testing.
 * 
 * Orchestrates the complete testing workflow including browser initialization,
 * game loading, evidence capture, and result generation.
 */
export class QAAgent {
  private browserClient: BrowserClient;
  private consoleLogEntries: ConsoleLogEntry[] = [];
  
  constructor() {
    this.browserClient = new BrowserClient();
  }
  
  /**
   * Run QA test for a game.
   * 
   * Executes the complete QA workflow:
   * 1. Initialize browser session
   * 2. Load game URL
   * 3. Wait for initial render
   * 4. Capture screenshot
   * 5. Collect console logs
   * 6. Close browser session
   * 7. Return structured result
   * 
   * Includes timeout handling (5 minutes max) and proper cleanup even on errors.
   * 
   * @param {string} gameUrl - URL of the game to test
   * @param {string} testId - Unique identifier for this test run
   * @param {string} [gameName] - Optional game name for result context
   * @returns {Promise<AgentResult>} Test execution result
   * 
   * @example
   * ```typescript
   * const agent = new QAAgent();
   * const result = await agent.run('https://example.com/game', 'test-123', 'Example Game');
   * console.log(`Test status: ${result.result.status}`);
   * ```
   */
  async run(
    gameUrl: string,
    testId: string,
    gameName?: string
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let screenshotUrl: string | null = null;
    let consoleLogsUrl: string | null = null;
    
    try {
      logger.info('Starting QA test', { testId, gameUrl, gameName });
      
      // Set up timeout
      const timeoutPromise = this.createTimeout(testId);
      const testPromise = this.executeTest(gameUrl, testId);
      
      // Race between test execution and timeout
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      const duration_ms = Date.now() - startTime;
      
      logger.info('QA test completed', {
        testId,
        status: result.status,
        duration_ms,
      });
      
      return {
        success: result.status === 'pass' || result.status === 'fail',
        result: {
          ...result,
          duration_ms,
          game_url: gameUrl,
          game_name: gameName,
          test_id: testId,
        },
        duration_ms,
      };
    } catch (error) {
      const duration_ms = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.error('QA test failed with error', {
        testId,
        error: message,
        duration_ms,
      });
      
      // Return error result
      return {
        success: false,
        result: createErrorResult(message, {
          screenshots: screenshotUrl ? [screenshotUrl] : [],
          console_logs: consoleLogsUrl,
          duration_ms,
          game_url: gameUrl,
          game_name: gameName,
          test_id: testId,
        }),
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
   * @param {string} gameUrl - Game URL to test
   * @param {string} testId - Test run identifier
   * @returns {Promise<TestResult>} Test result
   * @private
   */
  private async executeTest(
    gameUrl: string,
    testId: string
  ): Promise<TestResult> {
    let screenshotUrl: string | null = null;
    let consoleLogsUrl: string | null = null;
    const issues: string[] = [];
    
    try {
      // Step 1: Initialize browser session
      logger.info('Initializing browser session', { testId });
      await this.browserClient.initializeSession();
      
      // Step 2: Set up console log collection
      logger.info('Setting up console log collection', { testId });
      const logsResult = await collectConsoleLogs(this.browserClient, testId);
      this.consoleLogEntries = logsResult.entries;
      
      // Step 3: Load game URL
      logger.info('Loading game', { testId, gameUrl });
      await this.browserClient.loadGame(gameUrl);
      
      // Step 4: Wait for initial render
      logger.info('Waiting for game to load', { testId });
      await this.browserClient.waitForLoad(5000); // Wait 5 seconds after load
      
      // Step 5: Capture screenshot
      logger.info('Capturing screenshot', { testId });
      screenshotUrl = await captureScreenshot(this.browserClient, testId, 0);
      
      if (!screenshotUrl) {
        issues.push('Failed to capture screenshot');
      }
      
      // Step 6: Finalize console logs
      logger.info('Finalizing console logs', { testId });
      consoleLogsUrl = await finalizeConsoleLogs(this.consoleLogEntries, testId);
      
      // Step 7: Check for console errors
      const errorLogs = this.consoleLogEntries.filter(e => e.type === 'error');
      if (errorLogs.length > 0) {
        issues.push(`${errorLogs.length} console error(s) detected`);
        // Add first few errors to issues
        errorLogs.slice(0, 3).forEach(log => {
          issues.push(`Console error: ${log.text}`);
        });
      }
      
      // Step 8: Create result
      logger.info('Test execution completed successfully', { testId });
      
      return createSuccessResult(
        {
          screenshots: screenshotUrl ? [screenshotUrl] : [],
          console_logs: consoleLogsUrl,
          issues,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Test execution failed', { testId, error: message });
      
      return createErrorResult(message, {
        screenshots: screenshotUrl ? [screenshotUrl] : [],
        console_logs: consoleLogsUrl,
      });
    }
  }
  
  /**
   * Create timeout promise.
   * 
   * Returns a promise that rejects after the maximum execution time.
   * Used to enforce the 5-minute timeout requirement.
   * 
   * @param {string} testId - Test run identifier
   * @returns {Promise<never>} Promise that rejects on timeout
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
