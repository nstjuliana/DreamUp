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
 * Capture screenshot from browser and upload to storage.
 * 
 * Takes a screenshot of the current page state, converts it to a buffer,
 * and uploads it to Supabase Storage. Returns the public URL of the uploaded
 * screenshot. Handles failures gracefully - logs error and returns null rather
 * than throwing to avoid breaking the test flow.
 * 
 * @param {BrowserClient} client - Active browser client instance
 * @param {string} testId - Unique test run identifier
 * @param {number} [index=0] - Screenshot index for ordering
 * @returns {Promise<string | null>} Public URL of screenshot or null if failed
 * 
 * @example
 * ```typescript
 * const url = await captureScreenshot(browserClient, 'test-123', 0);
 * if (url) {
 *   console.log(`Screenshot captured: ${url}`);
 * }
 * ```
 */
export async function captureScreenshot(
  client: BrowserClient,
  testId: string,
  index: number = 0
): Promise<string | null> {
  try {
    logger.info('Capturing screenshot', { testId, index });
    
    // Get the page from browser client
    const page = client.getPage();
    
    // Create a timeout promise to prevent hanging (15 seconds)
    // Playwright may wait for fonts to load, which can cause delays
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Screenshot timeout after 15 seconds (likely waiting for fonts)'));
      }, 15000);
    });
    
    // Capture screenshot as buffer with race condition for timeout
    // Note: Playwright waits for fonts to load by default, which can cause timeouts
    // on some pages. The timeout prevents indefinite hanging.
    const screenshotPromise = page.screenshot({
      type: 'png',
      fullPage: false, // Capture viewport only for faster screenshots
      timeout: 15000, // 15 seconds timeout
      animations: 'disabled', // Disable animations for faster capture
    });
    
    const screenshotBuffer = await Promise.race([
      screenshotPromise,
      timeoutPromise,
    ]);
    
    // Convert to Buffer if it's a Uint8Array
    const buffer = Buffer.from(screenshotBuffer);
    
    // Upload to Supabase Storage
    const url = await uploadScreenshot(buffer, testId, index);
    
    logger.info('Screenshot captured and uploaded', { testId, index, url });
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to capture screenshot', {
      testId,
      index,
      error: message,
    });
    
    // Return null rather than throwing - screenshot failure shouldn't fail entire test
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

