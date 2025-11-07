/**
 * File: src/cli/batch-output-formatter.ts
 * 
 * Batch result formatting for CLI output.
 * 
 * This module provides functions for formatting batch test results as JSON
 * for CLI output, matching the structure expected by the web UI.
 * 
 * @module BatchOutputFormatter
 */

import { logger } from '../utils/logger.js';
import type { BatchReport } from '../storage/types.js';
import type { BatchExecutionResult } from './batch-runner.js';

/**
 * Batch result interface for CLI output.
 */
export interface BatchResult {
  /** Batch report ID */
  batch_report_id: string;
  /** Batch name (if provided) */
  batch_name?: string;
  /** Overall batch status */
  status: 'running' | 'completed' | 'partial_failure';
  /** Total number of tests */
  total_tests: number;
  /** Number of passed tests */
  passed_tests: number;
  /** Number of failed tests */
  failed_tests: number;
  /** Number of error tests */
  error_tests: number;
  /** ISO 8601 timestamp when batch started */
  started_at: string;
  /** ISO 8601 timestamp when batch completed */
  completed_at?: string;
  /** Test execution duration in milliseconds */
  duration_ms?: number;
  /** Individual test results */
  test_results: Array<{
    url: string;
    status: 'pass' | 'fail' | 'error' | 'timeout';
    test_run_id?: string;
    playability_score?: number;
    error?: string;
    issues?: string[];
    screenshots?: string[];
    console_logs?: string | null;
    duration_ms?: number;
    game_url?: string;
    game_name?: string;
  }>;
}

/**
 * Format batch result as JSON string.
 * 
 * @param {BatchResult} result - Batch result object
 * @param {boolean} [pretty=true] - Whether to pretty-print with indentation
 * @returns {string} Formatted JSON string
 */
export function formatBatchResult(result: BatchResult, pretty: boolean = true): string {
  try {
    const indent = pretty ? 2 : 0;
    return JSON.stringify(result, null, indent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to format batch result as JSON', { error: message });
    
    // Fallback to basic stringification
    return JSON.stringify({
      batch_report_id: result.batch_report_id,
      status: 'error',
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      error_tests: 1,
      started_at: result.started_at,
      test_results: [],
      error: `Failed to format result: ${message}`,
    }, null, 2);
  }
}

/**
 * Output batch result to stdout.
 * 
 * Formats and outputs the batch result as JSON to stdout.
 * This is the primary output mechanism for CLI batch execution.
 * 
 * @param {BatchResult} result - Batch result object
 */
export function outputBatchResult(result: BatchResult): void {
  const json = formatBatchResult(result, true);
  console.log(json);
}

/**
 * Convert batch execution result to BatchResult format.
 * 
 * @param {BatchExecutionResult} executionResult - Batch execution result
 * @param {BatchReport} batchReport - Batch report from database
 * @returns {BatchResult} Formatted batch result
 */
export function convertToBatchResult(
  executionResult: BatchExecutionResult,
  batchReport: BatchReport
): BatchResult {
  const duration_ms = batchReport.completed_at && batchReport.started_at
    ? new Date(batchReport.completed_at).getTime() - new Date(batchReport.started_at).getTime()
    : undefined;

  return {
    batch_report_id: executionResult.batchReportId,
    batch_name: batchReport.batch_name || undefined,
    status: batchReport.status,
    total_tests: executionResult.totalTests,
    passed_tests: executionResult.passedTests,
    failed_tests: executionResult.failedTests,
    error_tests: executionResult.errorTests,
    started_at: batchReport.started_at,
    completed_at: batchReport.completed_at || undefined,
    duration_ms,
    test_results: executionResult.results.map((result) => ({
      url: result.url,
      status: result.result?.status || (result.error ? 'error' : 'fail'),
      test_run_id: result.testRunId,
      playability_score: result.result?.playability_score,
      error: result.error,
      issues: result.result?.issues,
      screenshots: result.result?.screenshots,
      console_logs: result.result?.console_logs,
      duration_ms: result.result?.duration_ms,
      game_url: result.result?.game_url,
      game_name: result.result?.game_name,
    })),
  };
}

