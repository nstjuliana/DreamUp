/**
 * File: src/browser/screenshot-capture.ts
 * 
 * Screenshot capture utilities for browser testing.
 * 
 * This module provides functions for capturing screenshots from browser sessions
 * and uploading them to Supabase Storage. Handles errors gracefully to avoid
 * failing the entire test if screenshot capture fails.
 * 
 * @module ScreenshotCapture
 */

import type { BrowserClient } from './browser-client.js';
import { uploadScreenshot } from '../storage/file-storage.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Capture screenshot buffer from browser (without uploading).
 * 
 * Captures the page viewport screenshot and returns the buffer without uploading to storage.
 * 
 * @param {BrowserClient} client - Active browser client instance
 * @param {string} testId - Unique test run identifier
 * @param {number} [index=0] - Screenshot index for ordering
 * @returns {Promise<Buffer | null>} Screenshot buffer or null if failed
 */
export async function captureScreenshotBuffer(
  client: BrowserClient,
  testId: string,
  index: number = 0
): Promise<Buffer | null> {
  try {
    const captureStartTime = Date.now();
    logger.info('Capturing screenshot (viewport)', { testId, index });
    
    // Get the page from browser client
    const page = client.getPage();
    
    // Create a timeout promise to prevent hanging (10 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Screenshot timeout after 10 seconds'));
      }, 10000);
    });
    
    // Always capture the viewport
    const screenshotPromise = page.screenshot({
      type: 'png',
      fullPage: false,
      timeout: 5000,
      animations: 'disabled',
    });
    
    const screenshotBuffer = await Promise.race([
      screenshotPromise,
      timeoutPromise,
    ]);
    
    // Convert to Buffer if it's a Uint8Array
    const buffer = Buffer.from(screenshotBuffer);
    const captureDuration = Date.now() - captureStartTime;
    
    logger.info('Screenshot buffer created', { 
      testId, 
      index, 
      bufferSize: buffer.length,
      captureDurationMs: captureDuration 
    });
    
    return buffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to capture screenshot buffer', {
      testId,
      index,
      error: message,
    });
    
    return null;
  }
}

/**
 * Capture screenshot from browser and upload to storage.
 * 
 * Uses captureScreenshotBuffer internally and then uploads to storage.
 * Returns the public URL of the uploaded screenshot.
 * 
 * @param {BrowserClient} client - Active browser client instance
 * @param {string} testId - Unique test run identifier
 * @param {number} [index=0] - Screenshot index for ordering
 * @returns {Promise<string | null>} Public URL of screenshot or null if failed
 */
export async function captureScreenshot(
  client: BrowserClient,
  testId: string,
  index: number = 0
): Promise<string | null> {
  try {
    const captureStartTime = Date.now();
    
    // Capture screenshot buffer
    const buffer = await captureScreenshotBuffer(client, testId, index);
    if (!buffer) {
      return null;
    }
    
    const captureDuration = Date.now() - captureStartTime;
    logger.info('Screenshot buffer created, uploading to storage', { 
      testId, 
      index, 
      bufferSize: buffer.length,
      captureDurationMs: captureDuration 
    });
    
    // Upload to Supabase Storage
    const uploadStartTime = Date.now();
    const url = await uploadScreenshot(buffer, testId, index);
    const uploadDuration = Date.now() - uploadStartTime;
    
    const totalDuration = Date.now() - captureStartTime;
    logger.info('Screenshot captured and uploaded', { 
      testId, 
      index, 
      url, 
      captureDurationMs: captureDuration,
      uploadDurationMs: uploadDuration,
      totalDurationMs: totalDuration
    });
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to capture screenshot', {
      testId,
      index,
      error: message,
    });
    
    return null;
  }
}

/**
 * Capture multiple screenshots with delay between captures.
 * 
 * Captures a series of screenshots with a specified delay between each capture.
 * Useful for capturing game state changes over time.
 * Returns array of screenshot URLs (null entries for failed captures).
 * 
 * @param {BrowserClient} client - Active browser client instance
 * @param {string} testId - Unique test run identifier
 * @param {number} count - Number of screenshots to capture
 * @param {number} delayMs - Delay in milliseconds between screenshots
 * @returns {Promise<(string | null)[]>} Array of screenshot URLs
 * 
 * @example
 * ```typescript
 * const urls = await captureMultipleScreenshots(client, 'test-123', 3, 2000);
 * console.log(`Captured ${urls.filter(u => u !== null).length} screenshots`);
 * ```
 */
export async function captureMultipleScreenshots(
  client: BrowserClient,
  testId: string,
  count: number,
  delayMs: number
): Promise<(string | null)[]> {
  const screenshots: (string | null)[] = [];
  
  for (let i = 0; i < count; i++) {
    const url = await captureScreenshot(client, testId, i);
    screenshots.push(url);
    
    // Wait before next screenshot (except for last one)
    if (i < count - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = screenshots.filter(url => url !== null).length;
  logger.info('Multiple screenshots captured', {
    testId,
    requested: count,
    successful: successCount,
  });
  
  return screenshots;
}

