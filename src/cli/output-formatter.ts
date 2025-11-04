/**
 * File: src/cli/output-formatter.ts
 * 
 * CLI output formatting utilities.
 * 
 * This module provides functions for formatting test results as JSON for CLI output.
 * Defines the TestResult interface and provides pretty-printing for terminal display.
 * Also includes timeline formatting for debugging purposes.
 * 
 * @module OutputFormatter
 */

import { logger } from '../utils/logger.js';
import { formatTimeline, type Timeline } from '../agent/timeline.js';

/**
 * Test result status type.
 */
export type TestStatus = 'pass' | 'fail' | 'error' | 'timeout';

/**
 * Test result interface matching project specification.
 * 
 * This is the structured output format for QA test results as specified
 * in the project requirements.
 */
export interface TestResult {
  /** Overall test status */
  status: TestStatus;
  
  /** AI-generated playability score (0-100) */
  playability_score: number;
  
  /** Array of issues detected during testing */
  issues: string[];
  
  /** Array of Supabase Storage URLs for screenshots */
  screenshots: string[];
  
  /** Supabase Storage URL for console logs */
  console_logs: string | null;
  
  /** ISO 8601 timestamp of test execution */
  timestamp: string;
  
  /** Test execution duration in milliseconds */
  duration_ms?: number;
  
  /** Game URL that was tested */
  game_url?: string;
  
  /** Game name */
  game_name?: string;
  
  /** Test run ID */
  test_id?: string;
}

/**
 * Format test result as JSON string.
 * 
 * Converts a TestResult object to a JSON string with proper formatting.
 * Includes indentation for readability in terminal output.
 * 
 * @param {TestResult} result - Test result object
 * @param {boolean} [pretty=true] - Whether to pretty-print with indentation
 * @returns {string} Formatted JSON string
 * 
 * @example
 * ```typescript
 * const json = formatResult(testResult);
 * console.log(json);
 * ```
 */
export function formatResult(result: TestResult, pretty: boolean = true): string {
  try {
    const indent = pretty ? 2 : 0;
    return JSON.stringify(result, null, indent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to format result as JSON', { error: message });
    
    // Fallback to basic stringification
    return JSON.stringify({
      status: 'error',
      playability_score: 0,
      issues: [`Failed to format result: ${message}`],
      screenshots: [],
      console_logs: null,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

/**
 * Output test result to stdout.
 * 
 * Formats and outputs the test result as JSON to stdout.
 * This is the primary output mechanism for CLI execution.
 * 
 * @param {TestResult} result - Test result object
 * 
 * @example
 * ```typescript
 * outputResult(testResult);
 * ```
 */
export function outputResult(result: TestResult): void {
  const json = formatResult(result, true);
  console.log(json);
}

/**
 * Create error result.
 * 
 * Helper function to create a TestResult object for error scenarios.
 * Used when the test cannot complete due to errors.
 * 
 * @param {string} errorMessage - Error message describing what went wrong
 * @param {Partial<TestResult>} [partial] - Optional partial result data
 * @returns {TestResult} Error result object
 * 
 * @example
 * ```typescript
 * const result = createErrorResult('Failed to load game', { game_url: url });
 * outputResult(result);
 * ```
 */
export function createErrorResult(
  errorMessage: string,
  partial?: Partial<TestResult>
): TestResult {
  return {
    status: 'error',
    playability_score: 0,
    issues: [errorMessage],
    screenshots: partial?.screenshots || [],
    console_logs: partial?.console_logs || null,
    timestamp: new Date().toISOString(),
    duration_ms: partial?.duration_ms,
    game_url: partial?.game_url,
    game_name: partial?.game_name,
    test_id: partial?.test_id,
  };
}

/**
 * Create timeout result.
 * 
 * Helper function to create a TestResult object for timeout scenarios.
 * Used when the test exceeds maximum execution time.
 * 
 * @param {Partial<TestResult>} [partial] - Optional partial result data
 * @returns {TestResult} Timeout result object
 * 
 * @example
 * ```typescript
 * const result = createTimeoutResult({ screenshots: urls });
 * outputResult(result);
 * ```
 */
export function createTimeoutResult(partial?: Partial<TestResult>): TestResult {
  return {
    status: 'timeout',
    playability_score: 0,
    issues: ['Test execution exceeded maximum time limit'],
    screenshots: partial?.screenshots || [],
    console_logs: partial?.console_logs || null,
    timestamp: new Date().toISOString(),
    duration_ms: partial?.duration_ms,
    game_url: partial?.game_url,
    game_name: partial?.game_name,
    test_id: partial?.test_id,
  };
}

/**
 * Create success result.
 * 
 * Helper function to create a TestResult object for successful test execution.
 * In MVP, uses a static playability score with a TODO comment.
 * 
 * @param {Object} data - Result data
 * @param {string[]} data.screenshots - Screenshot URLs
 * @param {string | null} data.console_logs - Console logs URL
 * @param {string[]} [data.issues=[]] - Optional issues detected
 * @param {Partial<TestResult>} [partial] - Optional additional result data
 * @returns {TestResult} Success result object
 * 
 * @example
 * ```typescript
 * const result = createSuccessResult({
 *   screenshots: screenshotUrls,
 *   console_logs: logsUrl,
 *   issues: []
 * });
 * ```
 */
export function createSuccessResult(
  data: {
    screenshots: string[];
    console_logs: string | null;
    issues?: string[];
  },
  partial?: Partial<TestResult>
): TestResult {
  // Determine status based on issues
  const hasErrors = data.issues && data.issues.length > 0;
  const status: TestStatus = hasErrors ? 'fail' : 'pass';
  
  return {
    status,
    playability_score: partial?.playability_score ?? 50,
    issues: data.issues || [],
    screenshots: data.screenshots,
    console_logs: data.console_logs,
    timestamp: new Date().toISOString(),
    duration_ms: partial?.duration_ms,
    game_url: partial?.game_url,
    game_name: partial?.game_name,
    test_id: partial?.test_id,
  };
}

/**
 * Output timeline to console for debugging.
 * 
 * Formats and outputs a test timeline to the console in a human-readable format.
 * Useful for debugging test execution and identifying performance bottlenecks.
 * 
 * @param {Timeline} timeline - Timeline to output
 * 
 * @example
 * ```typescript
 * outputTimeline(state.timeline);
 * ```
 */
export function outputTimeline(timeline: Timeline): void {
  const formatted = formatTimeline(timeline);
  console.log('\n' + formatted);
}

