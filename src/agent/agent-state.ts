/**
 * File: src/agent/agent-state.ts
 * 
 * Agent state management for QA test execution.
 * 
 * This module tracks the agent's state throughout test execution, including
 * current phase, test metadata, evidence collection, and error context.
 * Used for better error handling, logging, and debugging.
 * 
 * @module AgentState
 */

import type { ManifestData } from '../storage/types.js';

/**
 * Agent execution phase.
 */
export type AgentPhase =
  | 'initializing'
  | 'loading'
  | 'interacting'
  | 'monitoring'
  | 'evaluating'
  | 'reporting';

/**
 * Agent state interface.
 * 
 * Tracks the complete state of the QA agent during test execution.
 */
export interface AgentState {
  /** Current execution phase */
  phase: AgentPhase;

  /** Test metadata */
  testId: string;
  gameUrl: string;
  gameId?: string;
  manifestId?: string | null;
  manifest?: ManifestData | null;

  /** Timing information */
  startTime: number;
  endTime?: number;

  /** Evidence collection */
  screenshots: string[];
  consoleLogsUrl?: string | null;

  /** Error context */
  phaseFailed?: AgentPhase;
  errorMessage?: string;
  errorContext?: Record<string, unknown>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create initial agent state.
 * 
 * Initializes a new agent state with default values for a test run.
 * 
 * @param {Object} params - State initialization parameters
 * @param {string} params.testId - Unique test run identifier
 * @param {string} params.gameUrl - Game URL to test
 * @param {string} [params.gameId] - Game ID from database
 * @param {string} [params.manifestId] - Manifest ID if available
 * @param {ManifestData} [params.manifest] - Parsed manifest data if available
 * @returns {AgentState} Initial agent state
 * 
 * @example
 * ```typescript
 * const state = createAgentState({
 *   testId: 'test-123',
 *   gameUrl: 'https://example.com/game',
 *   gameId: 'game-uuid',
 * });
 * ```
 */
export function createAgentState(params: {
  testId: string;
  gameUrl: string;
  gameId?: string;
  manifestId?: string | null;
  manifest?: ManifestData | null;
}): AgentState {
  return {
    phase: 'initializing',
    testId: params.testId,
    gameUrl: params.gameUrl,
    gameId: params.gameId,
    manifestId: params.manifestId,
    manifest: params.manifest,
    startTime: Date.now(),
    screenshots: [],
    metadata: {},
  };
}

/**
 * Update agent phase.
 * 
 * Updates the current phase in the agent state.
 * 
 * @param {AgentState} state - Current agent state
 * @param {AgentPhase} phase - New phase to transition to
 * @returns {AgentState} Updated agent state
 * 
 * @example
 * ```typescript
 * state = updatePhase(state, 'loading');
 * ```
 */
export function updatePhase(state: AgentState, phase: AgentPhase): AgentState {
  return {
    ...state,
    phase,
  };
}

/**
 * Add screenshot to agent state.
 * 
 * Adds a screenshot URL to the evidence collection.
 * 
 * @param {AgentState} state - Current agent state
 * @param {string} screenshotUrl - URL of screenshot to add
 * @returns {AgentState} Updated agent state
 * 
 * @example
 * ```typescript
 * state = addScreenshot(state, 'https://storage.example.com/screenshot.png');
 * ```
 */
export function addScreenshot(state: AgentState, screenshotUrl: string): AgentState {
  return {
    ...state,
    screenshots: [...state.screenshots, screenshotUrl],
  };
}

/**
 * Set console logs URL.
 * 
 * Updates the console logs URL in the agent state.
 * 
 * @param {AgentState} state - Current agent state
 * @param {string | null} logsUrl - Console logs URL
 * @returns {AgentState} Updated agent state
 * 
 * @example
 * ```typescript
 * state = setConsoleLogsUrl(state, 'https://storage.example.com/logs.txt');
 * ```
 */
export function setConsoleLogsUrl(state: AgentState, logsUrl: string | null): AgentState {
  return {
    ...state,
    consoleLogsUrl: logsUrl,
  };
}

/**
 * Set error context.
 * 
 * Records error information in the agent state without changing phase.
 * 
 * @param {AgentState} state - Current agent state
 * @param {string} errorMessage - Error message
 * @param {Record<string, unknown>} [errorContext] - Additional error context
 * @returns {AgentState} Updated agent state
 * 
 * @example
 * ```typescript
 * state = setError(state, 'Failed to load page', { url: gameUrl, timeout: 30000 });
 * ```
 */
export function setError(
  state: AgentState,
  errorMessage: string,
  errorContext?: Record<string, unknown>
): AgentState {
  return {
    ...state,
    phaseFailed: state.phase,
    errorMessage,
    errorContext,
  };
}

/**
 * Finalize agent state.
 * 
 * Marks the test as complete and sets end time.
 * 
 * @param {AgentState} state - Current agent state
 * @returns {AgentState} Finalized agent state
 * 
 * @example
 * ```typescript
 * state = finalizeState(state);
 * const duration = state.endTime! - state.startTime;
 * ```
 */
export function finalizeState(state: AgentState): AgentState {
  return {
    ...state,
    phase: 'reporting',
    endTime: Date.now(),
  };
}

/**
 * Get execution duration.
 * 
 * Calculates the execution duration from the agent state.
 * 
 * @param {AgentState} state - Agent state
 * @returns {number} Duration in milliseconds
 * 
 * @example
 * ```typescript
 * const duration = getDuration(state);
 * console.log(`Test took ${duration}ms`);
 * ```
 */
export function getDuration(state: AgentState): number {
  const endTime = state.endTime || Date.now();
  return endTime - state.startTime;
}

/**
 * Check if agent state has errors.
 * 
 * @param {AgentState} state - Agent state
 * @returns {boolean} True if state has error information
 */
export function hasError(state: AgentState): boolean {
  return !!state.errorMessage || !!state.phaseFailed;
}

/**
 * Get error summary from state.
 * 
 * @param {AgentState} state - Agent state
 * @returns {Object | null} Error summary or null if no error
 */
export function getErrorSummary(state: AgentState): {
  phase: AgentPhase;
  message: string;
  context?: Record<string, unknown>;
} | null {
  if (!hasError(state)) {
    return null;
  }

  return {
    phase: state.phaseFailed || state.phase,
    message: state.errorMessage || 'Unknown error',
    context: state.errorContext,
  };
}



