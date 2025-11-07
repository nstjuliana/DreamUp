/**
 * File: src/cli/batch-runner.ts
 * 
 * Batch test execution runner for parallel testing.
 * 
 * This module handles reading URL lists, validating games/manifests,
 * and executing multiple tests in parallel with concurrency control.
 * 
 * @module BatchRunner
 */

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import { validateUrl } from '../utils/validation.js';
import { findGameByUrl, getActiveManifest, createBatchReport, updateBatchReport } from '../storage/database.js';
import type { TestResult } from './output-formatter.js';
import type { BatchReportInsert } from '../storage/types.js';

/**
 * Batch execution options.
 */
export interface BatchOptions {
  /** Path to file containing URLs (one per line) */
  urlListFile: string;
  /** Maximum number of concurrent processes */
  maxConcurrency: number;
  /** Optional batch name */
  batchName?: string;
}

/**
 * Individual test result from a child process.
 */
export interface BatchTestResult {
  url: string;
  success: boolean;
  testRunId?: string;
  result?: TestResult;
  error?: string;
}

/**
 * Batch execution result.
 */
export interface BatchExecutionResult {
  batchReportId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  results: BatchTestResult[];
}

/**
 * Read URLs from file (one per line).
 * 
 * @param {string} filePath - Path to file containing URLs
 * @returns {Promise<string[]>} Array of validated URLs
 * @throws {ValidationError} If file cannot be read or contains invalid URLs
 */
export function readUrlListFile(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Filter empty lines and comments
    
    if (lines.length === 0) {
      throw new ValidationError(`URL list file is empty: ${filePath}`);
    }

    // Validate each URL format
    const validatedUrls: string[] = [];
    for (const line of lines) {
      try {
        const validated = validateUrl(line);
        validatedUrls.push(validated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ValidationError(`Invalid URL in list file: ${line} - ${message}`);
      }
    }

    logger.info('URL list file read successfully', { filePath, urlCount: validatedUrls.length });
    return validatedUrls;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError(`Failed to read URL list file "${filePath}": ${message}`);
  }
}

/**
 * Validate that all games exist and have manifests.
 * 
 * @param {string[]} urls - Array of game URLs to validate
 * @returns {Promise<{ valid: string[]; invalid: Array<{ url: string; reason: string }> }>} Validation results
 */
export async function validateGameUrls(urls: string[]): Promise<{
  valid: string[];
  invalid: Array<{ url: string; reason: string }>;
}> {
  const valid: string[] = [];
  const invalid: Array<{ url: string; reason: string }> = [];

  for (const url of urls) {
    try {
      const game = await findGameByUrl(url);
      
      if (!game) {
        invalid.push({ url, reason: 'Game not found in database' });
        continue;
      }

      const manifest = await getActiveManifest(game.id);
      
      if (!manifest) {
        invalid.push({ url, reason: 'No active manifest found for game' });
        continue;
      }

      valid.push(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      invalid.push({ url, reason: `Validation error: ${message}` });
    }
  }

  return { valid, invalid };
}

/**
 * Execute a single test in a child process.
 * 
 * @param {string} url - Game URL to test
 * @returns {Promise<BatchTestResult>} Test result
 */
async function executeSingleTest(url: string): Promise<BatchTestResult> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), 'qa.ts');
    const isWindows = process.platform === 'win32';
    
    // On Windows, .cmd files can't be executed directly with spawn
    // Use node to run tsx's CLI entry point directly
    let command: string;
    let args: string[];
    
    // Try to find tsx's CLI entry point
    const tsxCliPath = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const tsxCliPathAlt = join(process.cwd(), 'node_modules', 'tsx', 'cli.mjs');
    
    if (existsSync(tsxCliPath) || existsSync(tsxCliPathAlt)) {
      // Use node to run tsx's CLI directly - this works cross-platform
      command = process.execPath; // Use the same node executable
      args = [existsSync(tsxCliPath) ? tsxCliPath : tsxCliPathAlt, scriptPath, url];
      logger.debug('Using tsx CLI via node', { command, tsxPath: args[0], url });
    } else {
      // Fallback: use npx (which handles Windows .cmd files internally)
      command = isWindows ? 'npx.cmd' : 'npx';
      args = ['tsx', scriptPath, url];
      logger.debug('Using npx fallback', { command, url });
    }
    
    logger.debug('Spawning test process', { command, argsCount: args.length, url });
    
    let child;
    try {
      child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DEBUG: process.env.DEBUG || 'false' },
      });
    } catch (spawnError) {
      const message = spawnError instanceof Error ? spawnError.message : String(spawnError);
      logger.error('Failed to spawn test process', { command, args, url, error: message });
      resolve({
        url,
        success: false,
        error: `Failed to spawn test process: ${message}`,
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      logger.error('Child process error', { url, error: error.message });
      resolve({
        url,
        success: false,
        error: `Child process error: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      try {
        // Try to parse JSON output from stdout
        // First, try parsing the entire stdout as JSON (in case it's pretty-printed multi-line)
        let result: TestResult | null = null;
        
        const trimmedStdout = stdout.trim();
        
        // Try 1: Parse entire stdout as JSON (handles pretty-printed multi-line JSON)
        try {
          const parsed = JSON.parse(trimmedStdout);
          if (parsed && typeof parsed === 'object' && 'status' in parsed) {
            result = parsed as TestResult;
          }
        } catch {
          // Not valid as single JSON, continue to line-by-line parsing
        }
        
        // Try 2: Look for the last valid JSON line (the actual test result)
        if (!result) {
          const lines = trimmedStdout.split('\n');
          
          // Try to find JSON starting from the end (most recent output)
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i]?.trim();
            if (!line) continue;
            
            // Try parsing the line as JSON
            try {
              const parsed = JSON.parse(line);
              // Check if it looks like a TestResult (has status field)
              if (parsed && typeof parsed === 'object' && 'status' in parsed) {
                result = parsed as TestResult;
                break;
              }
            } catch {
              // Not valid JSON, continue
              continue;
            }
          }
        }
        
        // Try 3: Try to extract JSON from stdout by finding the JSON object boundaries
        if (!result) {
          // Look for the last complete JSON object in the output
          // Find the last { and try to parse from there
          const lastBrace = trimmedStdout.lastIndexOf('{');
          if (lastBrace >= 0) {
            try {
              // Try to find the matching closing brace
              let braceCount = 0;
              let jsonStart = lastBrace;
              let jsonEnd = -1;
              
              for (let i = lastBrace; i < trimmedStdout.length; i++) {
                if (trimmedStdout[i] === '{') braceCount++;
                if (trimmedStdout[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                  }
                }
              }
              
              if (jsonEnd > jsonStart) {
                const jsonStr = trimmedStdout.substring(jsonStart, jsonEnd);
                const parsed = JSON.parse(jsonStr);
                if (parsed && typeof parsed === 'object' && 'status' in parsed) {
                  result = parsed as TestResult;
                }
              }
            } catch {
              // Failed to extract JSON, continue
            }
          }
        }

        if (result) {
          logger.info('Parsed test result', { 
            url, 
            status: result.status, 
            testId: result.test_id,
            exitCode: code,
            hasTestId: !!result.test_id
          });
          
          // A test can exit with code 0 even if status is 'fail' (that's expected)
          // Only consider it an error if status is 'error' or exit code is non-zero AND status is error
          const isSuccess = result.status !== 'error';
          
          resolve({
            url,
            success: isSuccess,
            testRunId: result.test_id,
            result,
          });
        } else {
          // No valid JSON found - log the output for debugging
          const lines = trimmedStdout.split('\n');
          logger.warn('No valid JSON found in test output', { 
            url, 
            exitCode: code, 
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            lastLines: lines.slice(-10).join('\n'),
            fullStdout: trimmedStdout.substring(0, 1000)
          });
          resolve({
            url,
            success: false,
            error: `Test process exited with code ${code}. No valid JSON output found. Last output: ${lines.slice(-5).join(' | ')}`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to parse test result', { url, error: message, stdout: stdout.substring(0, 500) });
        resolve({
          url,
          success: false,
          error: `Failed to parse test result: ${message}. Output: ${stdout.substring(0, 500)}`,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        url,
        success: false,
        error: `Failed to spawn test process: ${error.message}`,
      });
    });
  });
}

/**
 * Simple concurrency limiter using Promise.all with batching.
 * 
 * @param {T[]} items - Items to process
 * @param {number} concurrency - Max concurrent operations
 * @param {(item: T) => Promise<R>} fn - Function to execute for each item
 * @returns {Promise<R[]>} Results in same order as input
 */
async function pLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Execute batch of tests in parallel.
 * 
 * @param {BatchOptions} options - Batch execution options
 * @returns {Promise<BatchExecutionResult>} Batch execution results
 */
export async function executeBatch(options: BatchOptions): Promise<BatchExecutionResult> {
  const startTime = Date.now();
  
  // Read URLs from file
  const urls = readUrlListFile(options.urlListFile);
  logger.info('Starting batch execution', { urlCount: urls.length, maxConcurrency: options.maxConcurrency });

  // Validate all games exist and have manifests
  const { valid, invalid } = await validateGameUrls(urls);
  
  if (invalid.length > 0) {
    logger.warn('Some URLs failed validation', { invalidCount: invalid.length });
    for (const { url, reason } of invalid) {
      logger.warn('Invalid URL', { url, reason });
    }
  }

  if (valid.length === 0) {
    throw new ValidationError('No valid URLs found in list. All URLs must exist in database and have active manifests.');
  }

  // Create batch report record
  const batchReportData: BatchReportInsert = {
    batch_name: options.batchName || null,
    status: 'running',
    total_tests: valid.length,
    passed_tests: 0,
    failed_tests: 0,
    error_tests: 0,
    test_run_ids: [],
    execution_method: 'cli',
    metadata: {
      concurrency: options.maxConcurrency,
      game_urls: valid,
      invalid_urls: invalid,
    },
  };

  const batchReport = await createBatchReport(batchReportData);
  const batchReportId = batchReport.id;

  logger.info('Batch report created', { batchReportId, totalTests: valid.length });

  // Execute tests with concurrency limit
  const results: BatchTestResult[] = [];
  
  // Add invalid URLs as error results
  for (const { url, reason } of invalid) {
    results.push({
      url,
      success: false,
      error: reason,
    });
  }

  // Execute valid tests in parallel batches
  const testResults = await pLimit(valid, options.maxConcurrency, executeSingleTest);
  results.push(...testResults);

  // Aggregate results
  let passedTests = 0;
  let failedTests = 0;
  let errorTests = 0;
  const testRunIds: string[] = [];

  for (const result of results) {
    if (result.success) {
      passedTests++;
      if (result.testRunId) {
        testRunIds.push(result.testRunId);
      }
    } else if (result.result?.status === 'error' || result.error) {
      errorTests++;
    } else {
      failedTests++;
      if (result.testRunId) {
        testRunIds.push(result.testRunId);
      }
    }
  }

  // Determine final status
  const hasErrors = errorTests > 0 || invalid.length > 0;
  const hasFailures = failedTests > 0;
  const finalStatus: 'completed' | 'partial_failure' = hasErrors || hasFailures ? 'partial_failure' : 'completed';

  // Update batch report
  const duration_ms = Date.now() - startTime;
  await updateBatchReport(batchReportId, {
    status: finalStatus,
    passed_tests: passedTests,
    failed_tests: failedTests,
    error_tests: errorTests,
    test_run_ids: testRunIds,
    completed_at: new Date().toISOString(),
    metadata: {
      ...(batchReportData.metadata && typeof batchReportData.metadata === 'object' ? batchReportData.metadata : {}),
      duration_ms,
    },
  });

  logger.info('Batch execution completed', {
    batchReportId,
    totalTests: results.length,
    passedTests,
    failedTests,
    errorTests,
    duration_ms,
  });

  return {
    batchReportId,
    totalTests: results.length,
    passedTests,
    failedTests,
    errorTests,
    results,
  };
}

