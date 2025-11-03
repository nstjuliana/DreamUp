/**
 * File: src/utils/constants.ts
 * 
 * Application-wide constants for the DreamUp QA Pipeline.
 * 
 * This module centralizes all magic numbers, timeout values, and configuration
 * constants used throughout the application. Values are documented with their
 * source requirements.
 * 
 * @module Constants
 */

/**
 * Maximum execution time for a single test run (milliseconds).
 * Per spec: 5 minutes maximum execution time.
 */
export const MAX_EXECUTION_TIME_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Maximum number of retry attempts for failed operations.
 * Per spec: Retry up to 3 times for transient failures.
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Number of screenshots to capture during a test run.
 * Per spec: 3-5 screenshots per test, using 5 as maximum.
 */
export const SCREENSHOT_COUNT = 5;

/**
 * Interval between screenshots (milliseconds).
 * Calculated as: MAX_EXECUTION_TIME_MS / (SCREENSHOT_COUNT + 1)
 * This provides roughly even spacing throughout the test execution.
 */
export const SCREENSHOT_INTERVAL_MS = Math.floor(
  MAX_EXECUTION_TIME_MS / (SCREENSHOT_COUNT + 1)
);

/**
 * Default page load timeout (milliseconds).
 * Standard timeout for browser page loads before considering it a failure.
 */
export const PAGE_LOAD_TIMEOUT_MS = 30 * 1000; // 30 seconds

/**
 * Default wait time after clicking start button (milliseconds).
 * Allows game initialization before starting interaction.
 */
export const START_BUTTON_WAIT_MS = 3 * 1000; // 3 seconds

/**
 * Exponential backoff base multiplier for retries.
 * Retry delays: attempt 1 = 1s, attempt 2 = 2s, attempt 3 = 4s
 */
export const RETRY_BACKOFF_BASE_MS = 1000; // 1 second

/**
 * Default loading duration for games without manifest specification (milliseconds).
 * Conservative estimate to allow games to fully load.
 */
export const DEFAULT_LOADING_DURATION_MS = 5 * 1000; // 5 seconds

/**
 * Maximum console log size to store (characters).
 * Prevents storing extremely large console outputs.
 */
export const MAX_CONSOLE_LOG_SIZE = 100000; // 100KB

/**
 * Playability score thresholds.
 * Used to categorize test results based on LLM-generated scores.
 */
export const PLAYABILITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  FAIR: 50,
  POOR: 30,
} as const;

/**
 * Valid game types as defined in database schema.
 * Must match the CHECK constraint in games table.
 */
export const GAME_TYPES = [
  'puzzle',
  'platformer',
  'idle',
  'shooter',
  'rpg',
  'other',
] as const;

/**
 * Valid test run statuses as defined in database schema.
 * Must match the CHECK constraint in test_runs table.
 */
export const TEST_STATUSES = ['pass', 'fail', 'error', 'timeout'] as const;

/**
 * Valid execution methods as defined in database schema.
 * Must match the CHECK constraint in test_runs table.
 */
export const EXECUTION_METHODS = ['cli', 'lambda', 'web'] as const;

/**
 * Valid LLM providers supported by the application.
 */
export const LLM_PROVIDERS = ['openai', 'anthropic'] as const;

/**
 * Supabase Storage bucket names.
 */
export const STORAGE_BUCKETS = {
  SCREENSHOTS: 'screenshots',
  CONSOLE_LOGS: 'console-logs',
} as const;

/**
 * Default artifact paths for local storage fallback.
 */
export const ARTIFACT_PATHS = {
  ROOT: 'artifacts',
  SCREENSHOTS: 'artifacts/screenshots',
  LOGS: 'artifacts/logs',
} as const;

