/**
 * File: src/utils/errors.ts
 * 
 * Custom error classes for the DreamUp QA Pipeline.
 * 
 * This module defines a hierarchy of error classes for different error scenarios
 * throughout the application. Each error class extends QAAgentError and includes
 * optional context for debugging.
 * 
 * @module Errors
 */

/**
 * Base error class for all QA Agent errors.
 * 
 * All custom errors in the application should extend this class.
 * Includes optional context object for additional debugging information.
 * 
 * @param {string} message - Error message describing what went wrong
 * @param {Record<string, unknown>} [context] - Optional context with additional details
 * 
 * @example
 * ```typescript
 * throw new QAAgentError('Something went wrong', { testId: '123', url: 'example.com' });
 * ```
 */
export class QAAgentError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QAAgentError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when browser automation fails.
 * 
 * Used for errors related to Browserbase, Stagehand, page loading,
 * screenshot capture, or any browser-related operations.
 * 
 * @example
 * ```typescript
 * throw new BrowserError('Failed to load page', { url: gameUrl, timeout: 30000 });
 * ```
 */
export class BrowserError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'BrowserError';
  }
}

/**
 * Error thrown when LLM evaluation fails.
 * 
 * Used for errors related to LLM API calls, response parsing,
 * or evaluation logic failures.
 * 
 * @example
 * ```typescript
 * throw new EvaluationError('LLM API request failed', { model: 'gpt-4', statusCode: 500 });
 * ```
 */
export class EvaluationError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'EvaluationError';
  }
}

/**
 * Error thrown when storage operations fail.
 * 
 * Used for errors related to database operations (Supabase),
 * file storage (screenshots, logs), or data persistence issues.
 * 
 * @example
 * ```typescript
 * throw new StorageError('Failed to save test results', { testId: '123', table: 'test_runs' });
 * ```
 */
export class StorageError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when input validation fails.
 * 
 * Used for errors related to invalid user inputs, configuration errors,
 * or missing required parameters.
 * 
 * @example
 * ```typescript
 * throw new ValidationError('Invalid game URL', { url: userInput });
 * ```
 */
export class ValidationError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when configuration is invalid or missing.
 * 
 * Used for errors related to environment variables, missing API keys,
 * or invalid configuration values.
 * 
 * @example
 * ```typescript
 * throw new ConfigurationError('Missing required environment variable: SUPABASE_URL');
 * ```
 */
export class ConfigurationError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'ConfigurationError';
  }
}

