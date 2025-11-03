/**
 * File: src/browser/console-logger.ts
 * 
 * Console log collection from browser sessions.
 * 
 * This module provides functions for collecting console logs (errors, warnings, info)
 * from browser sessions and uploading them to Supabase Storage. Logs are captured
 * throughout the test session for debugging and issue detection.
 * 
 * @module ConsoleLogger
 */

import type { BrowserClient } from './browser-client.js';
import { uploadConsoleLogs } from '../storage/file-storage.js';
import { logger } from '../utils/logger.js';

/**
 * Console log entry interface.
 */
export interface ConsoleLogEntry {
  type: string;
  text: string;
  timestamp: string;
}

/**
 * Console log collection result.
 */
export interface ConsoleLogsResult {
  entries: ConsoleLogEntry[];
  storageUrl: string | null;
}

/**
 * Collect console logs from browser session.
 * 
 * Sets up listeners for console messages during the browser session,
 * collects all logs (errors, warnings, info), formats them as text,
 * and uploads to Supabase Storage. Returns both the log entries array
 * and the storage URL.
 * 
 * @param {BrowserClient} client - Active browser client instance
 * @param {string} testId - Unique test run identifier
 * @returns {Promise<ConsoleLogsResult>} Console logs and storage URL
 * 
 * @example
 * ```typescript
 * const result = await collectConsoleLogs(browserClient, 'test-123');
 * console.log(`Collected ${result.entries.length} console messages`);
 * ```
 */
export async function collectConsoleLogs(
  client: BrowserClient,
  testId: string
): Promise<ConsoleLogsResult> {
  const logEntries: ConsoleLogEntry[] = [];
  
  try {
    logger.debug('Setting up console log collection', { testId });
    
    // Get the page from browser client
    const page = client.getPage();
    
    // Set up console message listener
    // Type is inferred from Playwright's Page.on('console') event
    page.on('console', (msg) => {
      const entry: ConsoleLogEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      };
      logEntries.push(entry);
      
      // Log to our logger for debugging
      if (msg.type() === 'error') {
        logger.debug('Browser console error', { testId, text: msg.text() });
      }
    });
    
    // Set up page error listener
    page.on('pageerror', (error: Error) => {
      const entry: ConsoleLogEntry = {
        type: 'error',
        text: `Page Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      logEntries.push(entry);
      logger.debug('Browser page error', { testId, error: error.message });
    });
    
    logger.info('Console log collection enabled', { testId });
    
    return {
      entries: logEntries,
      storageUrl: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to set up console log collection', {
      testId,
      error: message,
    });
    
    // Return empty result rather than throwing
    return {
      entries: logEntries,
      storageUrl: null,
    };
  }
}

/**
 * Finalize and upload console logs.
 * 
 * Takes the collected console log entries, formats them as a readable text file,
 * and uploads to Supabase Storage. Returns the storage URL.
 * 
 * @param {ConsoleLogEntry[]} entries - Array of console log entries
 * @param {string} testId - Unique test run identifier
 * @returns {Promise<string | null>} Storage URL or null if upload fails
 * 
 * @example
 * ```typescript
 * const url = await finalizeConsoleLogs(logEntries, 'test-123');
 * if (url) {
 *   console.log(`Logs uploaded: ${url}`);
 * }
 * ```
 */
export async function finalizeConsoleLogs(
  entries: ConsoleLogEntry[],
  testId: string
): Promise<string | null> {
  try {
    if (entries.length === 0) {
      logger.info('No console logs to upload', { testId });
      return null;
    }
    
    // Format logs as text
    const logsText = formatLogsAsText(entries);
    
    // Upload to Supabase Storage
    const url = await uploadConsoleLogs(logsText, testId);
    
    logger.info('Console logs uploaded', {
      testId,
      entryCount: entries.length,
      url,
    });
    
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to upload console logs', {
      testId,
      error: message,
    });
    
    // Return null rather than throwing
    return null;
  }
}

/**
 * Format console log entries as readable text.
 * 
 * Converts the array of log entries into a formatted text string suitable
 * for viewing in a text editor or web UI. Preserves chronological order
 * of log entries. Includes timestamps and log types.
 * 
 * @param {ConsoleLogEntry[]} entries - Array of console log entries
 * @returns {string} Formatted log text
 */
function formatLogsAsText(entries: ConsoleLogEntry[]): string {
  const lines: string[] = [
    '='.repeat(80),
    'CONSOLE LOGS',
    `Total Entries: ${entries.length}`,
    `Collected: ${new Date().toISOString()}`,
    '='.repeat(80),
    '',
  ];
  
  // Count entries by type for summary
  const errorCount = entries.filter(e => e.type === 'error').length;
  const warningCount = entries.filter(e => e.type === 'warning').length;
  const otherCount = entries.length - errorCount - warningCount;
  
  if (errorCount > 0 || warningCount > 0 || otherCount > 0) {
    lines.push('SUMMARY:');
    lines.push(`  Errors: ${errorCount}`);
    lines.push(`  Warnings: ${warningCount}`);
    lines.push(`  Other: ${otherCount}`);
    lines.push('');
    lines.push('CHRONOLOGICAL LOG ENTRIES:');
    lines.push('-'.repeat(80));
    lines.push('');
  }
  
  // Preserve chronological order - output all entries in the order they occurred
  entries.forEach(entry => {
    // Format: [timestamp] [TYPE] message
    const typeLabel = entry.type.toUpperCase();
    lines.push(`[${entry.timestamp}] [${typeLabel}] ${entry.text}`);
  });
  
  if (entries.length > 0) {
    lines.push('');
  }
  
  lines.push('='.repeat(80));
  lines.push('END OF CONSOLE LOGS');
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

