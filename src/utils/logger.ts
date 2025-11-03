/**
 * File: src/utils/logger.ts
 * 
 * Logging utility for the DreamUp QA Pipeline.
 * 
 * This module provides structured logging with different log levels (debug, info, warn, error).
 * Logs include timestamps and optional context objects for better debugging.
 * 
 * @module Logger
 */

/**
 * Log levels in order of severity.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Logger configuration interface.
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Whether to include timestamps */
  timestamps: boolean;
  /** Whether to colorize output (for CLI) */
  colors: boolean;
}

/**
 * Default logger configuration.
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  timestamps: true,
  colors: true,
};

/**
 * Current logger configuration.
 */
let config: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * ANSI color codes for terminal output.
 */
const COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m', // Green
  WARN: '\x1b[33m', // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
} as const;

/**
 * Log level priorities for filtering.
 */
const LOG_PRIORITIES: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Configure the logger.
 * 
 * @param {Partial<LoggerConfig>} newConfig - Configuration options to override
 * 
 * @example
 * ```typescript
 * configure({ level: LogLevel.DEBUG, colors: false });
 * ```
 */
export function configure(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Format a log message with timestamp and level.
 * 
 * @param {LogLevel} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted message
 */
function formatMessage(level: LogLevel, message: string): string {
  const timestamp = config.timestamps ? `[${new Date().toISOString()}] ` : '';
  const levelStr = config.colors
    ? `${COLORS[level]}${level}${COLORS.RESET}`
    : level;
  return `${timestamp}${levelStr}: ${message}`;
}

/**
 * Check if a log level should be output based on current configuration.
 * 
 * @param {LogLevel} level - Log level to check
 * @returns {boolean} Whether to output this log level
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITIES[level] >= LOG_PRIORITIES[config.level];
}

/**
 * Format context object for logging.
 * 
 * @param {Record<string, unknown>} [context] - Context object
 * @returns {string} Formatted context string
 */
function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(context)}`;
}

/**
 * Log a debug message.
 * 
 * @param {string} message - Message to log
 * @param {Record<string, unknown>} [context] - Optional context object
 * 
 * @example
 * ```typescript
 * logger.debug('Browser session initialized', { sessionId: '123' });
 * ```
 */
export function debug(message: string, context?: Record<string, unknown>): void {
  if (shouldLog(LogLevel.DEBUG)) {
    console.log(formatMessage(LogLevel.DEBUG, message) + formatContext(context));
  }
}

/**
 * Log an info message.
 * 
 * @param {string} message - Message to log
 * @param {Record<string, unknown>} [context] - Optional context object
 * 
 * @example
 * ```typescript
 * logger.info('Starting QA test', { testId: '123', gameUrl: 'example.com' });
 * ```
 */
export function info(message: string, context?: Record<string, unknown>): void {
  if (shouldLog(LogLevel.INFO)) {
    console.log(formatMessage(LogLevel.INFO, message) + formatContext(context));
  }
}

/**
 * Log a warning message.
 * 
 * @param {string} message - Message to log
 * @param {Record<string, unknown>} [context] - Optional context object
 * 
 * @example
 * ```typescript
 * logger.warn('Retry attempt', { attempt: 2, maxRetries: 3 });
 * ```
 */
export function warn(message: string, context?: Record<string, unknown>): void {
  if (shouldLog(LogLevel.WARN)) {
    console.warn(formatMessage(LogLevel.WARN, message) + formatContext(context));
  }
}

/**
 * Log an error message.
 * 
 * @param {string} message - Message to log
 * @param {Record<string, unknown>} [context] - Optional context object
 * 
 * @example
 * ```typescript
 * logger.error('Test failed', { testId: '123', error: error.message });
 * ```
 */
export function error(message: string, context?: Record<string, unknown>): void {
  if (shouldLog(LogLevel.ERROR)) {
    console.error(formatMessage(LogLevel.ERROR, message) + formatContext(context));
  }
}

/**
 * Default logger export with all log methods.
 */
export const logger = {
  configure,
  debug,
  info,
  warn,
  error,
  LogLevel,
};

