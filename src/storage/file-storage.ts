/**
 * File: src/storage/file-storage.ts
 * 
 * File storage operations for screenshots and console logs.
 * 
 * This module handles uploading and managing artifacts (screenshots, logs) in Supabase Storage.
 * Includes fallback to local filesystem if Supabase Storage is unavailable.
 * 
 * @module FileStorage
 */

import { getDatabase } from './database.js';
import { StorageError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { STORAGE_BUCKETS, ARTIFACT_PATHS } from '../utils/constants.js';

/**
 * Upload screenshot to Supabase Storage.
 * 
 * Uploads a screenshot buffer to Supabase Storage and returns the public URL.
 * 
 * @param {string} testRunId - Test run ID for organizing screenshots
 * @param {Buffer} imageBuffer - Screenshot image buffer
 * @param {number} index - Screenshot index (for ordering)
 * @returns {Promise<string>} Public URL of uploaded screenshot
 * @throws {StorageError} If upload fails
 * 
 * @example
 * ```typescript
 * const url = await uploadScreenshot('test-123', imageBuffer, 0);
 * console.log(`Screenshot uploaded: ${url}`);
 * ```
 */
export async function uploadScreenshot(
  testRunId: string,
  imageBuffer: Buffer,
  index: number
): Promise<string> {
  const db = getDatabase();
  const fileName = `${testRunId}/screenshot-${String(index).padStart(3, '0')}.png`;
  
  try {
    const { error } = await db.storage
      .from(STORAGE_BUCKETS.SCREENSHOTS)
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload screenshot', { testRunId, index, error: error.message });
      throw new StorageError(`Failed to upload screenshot: ${error.message}`, {
        testRunId,
        index,
        error,
      });
    }

    // Get public URL
    const { data: urlData } = db.storage
      .from(STORAGE_BUCKETS.SCREENSHOTS)
      .getPublicUrl(fileName);

    logger.debug('Screenshot uploaded', { testRunId, index, url: urlData.publicUrl });
    return urlData.publicUrl;
  } catch (error) {
    logger.error('Screenshot upload error', { testRunId, index, error });
    throw new StorageError('Screenshot upload failed', { testRunId, index, error });
  }
}

/**
 * Upload console logs to Supabase Storage.
 * 
 * Uploads console logs as a text file to Supabase Storage.
 * 
 * @param {string} testRunId - Test run ID for organizing logs
 * @param {string} logs - Console logs content
 * @returns {Promise<string>} Public URL of uploaded logs
 * @throws {StorageError} If upload fails
 * 
 * @example
 * ```typescript
 * const url = await uploadConsoleLogs('test-123', logContent);
 * console.log(`Logs uploaded: ${url}`);
 * ```
 */
export async function uploadConsoleLogs(
  testRunId: string,
  logs: string
): Promise<string> {
  const db = getDatabase();
  const fileName = `${testRunId}/console.log`;
  
  try {
    const { error } = await db.storage
      .from(STORAGE_BUCKETS.CONSOLE_LOGS)
      .upload(fileName, logs, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload console logs', { testRunId, error: error.message });
      throw new StorageError(`Failed to upload console logs: ${error.message}`, {
        testRunId,
        error,
      });
    }

    // Get public URL
    const { data: urlData } = db.storage
      .from(STORAGE_BUCKETS.CONSOLE_LOGS)
      .getPublicUrl(fileName);

    logger.debug('Console logs uploaded', { testRunId, url: urlData.publicUrl });
    return urlData.publicUrl;
  } catch (error) {
    logger.error('Console logs upload error', { testRunId, error });
    throw new StorageError('Console logs upload failed', { testRunId, error });
  }
}

/**
 * Delete test run artifacts from storage.
 * 
 * Removes all screenshots and logs associated with a test run.
 * 
 * @param {string} testRunId - Test run ID
 * @returns {Promise<void>}
 * @throws {StorageError} If deletion fails
 * 
 * @example
 * ```typescript
 * await deleteTestArtifacts('test-123');
 * ```
 */
export async function deleteTestArtifacts(testRunId: string): Promise<void> {
  const db = getDatabase();
  
  try {
    // Delete screenshots
    const { error: screenshotError } = await db.storage
      .from(STORAGE_BUCKETS.SCREENSHOTS)
      .remove([`${testRunId}/`]);

    if (screenshotError) {
      logger.warn('Failed to delete screenshots', { testRunId, error: screenshotError.message });
    }

    // Delete console logs
    const { error: logsError } = await db.storage
      .from(STORAGE_BUCKETS.CONSOLE_LOGS)
      .remove([`${testRunId}/console.log`]);

    if (logsError) {
      logger.warn('Failed to delete console logs', { testRunId, error: logsError.message });
    }

    logger.debug('Test artifacts deleted', { testRunId });
  } catch (error) {
    logger.error('Error deleting test artifacts', { testRunId, error });
    throw new StorageError('Failed to delete test artifacts', { testRunId, error });
  }
}

/**
 * Save screenshot to local filesystem (fallback).
 * 
 * Saves screenshot to local artifacts directory when Supabase Storage is unavailable.
 * 
 * @param {string} testRunId - Test run ID
 * @param {Buffer} imageBuffer - Screenshot image buffer
 * @param {number} index - Screenshot index
 * @returns {Promise<string>} Local file path
 * 
 * @example
 * ```typescript
 * const path = await saveScreenshotLocally('test-123', buffer, 0);
 * ```
 */
export async function saveScreenshotLocally(
  testRunId: string,
  _imageBuffer: Buffer,
  index: number
): Promise<string> {
  // Placeholder: Implementation would use Node.js fs module
  // For now, just return a mock path
  const fileName = `screenshot-${String(index).padStart(3, '0')}.png`;
  const filePath = `${ARTIFACT_PATHS.SCREENSHOTS}/${testRunId}/${fileName}`;
  
  logger.debug('Screenshot saved locally (placeholder)', { testRunId, index, filePath });
  return filePath;
}

/**
 * Save console logs to local filesystem (fallback).
 * 
 * Saves console logs to local artifacts directory when Supabase Storage is unavailable.
 * 
 * @param {string} testRunId - Test run ID
 * @param {string} logs - Console logs content
 * @returns {Promise<string>} Local file path
 * 
 * @example
 * ```typescript
 * const path = await saveLogsLocally('test-123', logContent);
 * ```
 */
export async function saveLogsLocally(
  testRunId: string,
  _logs: string
): Promise<string> {
  // Placeholder: Implementation would use Node.js fs module
  // For now, just return a mock path
  const filePath = `${ARTIFACT_PATHS.LOGS}/${testRunId}/console.log`;
  
  logger.debug('Console logs saved locally (placeholder)', { testRunId, filePath });
  return filePath;
}

