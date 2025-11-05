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
 * Uses a multi-strategy approach to capture only the game content area.
 * Returns the screenshot buffer without uploading to storage.
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
    logger.info('Capturing screenshot', { testId, index });
    
    // Get the page from browser client
    const page = client.getPage();
    
    // Create a timeout promise to prevent hanging (10 seconds, reduced from 15)
    // Playwright may wait for fonts to load, but we don't want to wait too long
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Screenshot timeout after 10 seconds'));
      }, 10000);
    });
    
    // Multi-strategy approach to find game content:
    // 1. Try common game container selectors (DOM-based games - prioritized)
    // 2. Try iframes (most common for embedded games)
    // 3. Try canvas elements (HTML5 games)
    // 4. Fall back to full page
    let screenshotBuffer: Buffer | Uint8Array;
    let strategySucceeded = false;
    
    // Strategy 1: Try common game container selectors (DOM-based games)
    if (!strategySucceeded) {
      try {
        const gameContainerSelectors = [
          'section.scene', // Game engine scene container (prioritized)
          'section[class*="scene"]', // Variations of scene class
          '#game',
          '#game-container',
          '#game-canvas',
          '.game',
          '.game-container',
          '.game-canvas',
          '[id*="game"]',
          '[class*="game"]',
          '#play-area',
          '#game-area',
          '.play-area',
          '.game-area',
        ];
        
        let gameContainer = null;
        for (const selector of gameContainerSelectors) {
          try {
            const count = await page.locator(selector).count();
            if (count > 0) {
              gameContainer = page.locator(selector).first();
              const box = await gameContainer.boundingBox();
              if (box && box.width > 100 && box.height > 100) {
                // Only use if it's reasonably sized (not a tiny element)
                logger.info('Game container found', { 
                  testId, 
                  selector,
                  width: box.width,
                  height: box.height,
                });
                break;
              }
              gameContainer = null;
            }
          } catch {
            continue;
          }
        }
        
        if (gameContainer) {
          await gameContainer.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
            logger.debug('Game container visibility timeout, proceeding anyway', { testId });
          });
          
          const screenshotPromise = gameContainer.screenshot({
            type: 'png',
            timeout: 5000,
            animations: 'disabled',
          });
          
          screenshotBuffer = await Promise.race([
            screenshotPromise,
            timeoutPromise,
          ]);
          
          logger.info('Screenshot captured from game container', { testId, index });
          strategySucceeded = true;
        }
      } catch (containerError) {
        logger.warn('Game container capture failed, trying next strategy', {
          testId,
          index,
          error: containerError instanceof Error ? containerError.message : String(containerError),
        });
      }
    }
    
    // Strategy 2: Try iframes (embedded games)
    if (!strategySucceeded) {
      try {
        const iframeCount = await page.locator('iframe').count();
        
        if (iframeCount > 0) {
          logger.info('Iframe found, attempting to capture iframe content', { 
            testId, 
            index, 
            iframeCount 
          });
          
          // If multiple iframes, find the largest one (most likely to be the game)
          let iframeLocator;
          if (iframeCount > 1) {
            logger.info('Multiple iframes detected, selecting largest iframe', { 
              testId, 
              iframeCount 
            });
            
            // Get all iframes and find the largest one by bounding box area
            const iframes = await page.locator('iframe').all();
            let largestIframe = iframes[0];
            let largestArea = 0;
            
            for (const iframe of iframes) {
              try {
                const box = await iframe.boundingBox();
                if (box) {
                  const area = box.width * box.height;
                  if (area > largestArea) {
                    largestArea = area;
                    largestIframe = iframe;
                  }
                }
              } catch {
                // Skip iframes that can't be measured
                continue;
              }
            }
            
            iframeLocator = largestIframe;
            logger.info('Selected largest iframe', { 
              testId, 
              area: largestArea 
            });
          } else {
            // Single iframe, use it directly
            iframeLocator = page.locator('iframe').first();
          }
          
          // Wait for iframe to be attached to the page (reduced timeout)
          await iframeLocator.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {
            logger.debug('Iframe attachment timeout, proceeding anyway', { testId });
          });
          
          // Get the content frame from the iframe element
          const iframeElement = await iframeLocator.elementHandle();
          const iframeFrame = iframeElement ? await iframeElement.contentFrame() : null;
          
          // Try to capture iframe content frame first (if available)
          if (iframeFrame && iframeFrame !== page.mainFrame()) {
            // Wait for iframe content to be loaded (reduced timeout)
            try {
              await iframeFrame.waitForLoadState('domcontentloaded', { timeout: 2000 });
            } catch {
              logger.debug('Iframe load state timeout, proceeding anyway', { testId });
            }
            
            // First try: Capture canvas inside iframe (most reliable for game engines)
            try {
              const canvasInFrame = iframeFrame.locator('canvas').first();
              const canvasCount = await canvasInFrame.count({ timeout: 1000 }).catch(() => 0);
              
              if (canvasCount > 0) {
                logger.info('Canvas found inside iframe, capturing canvas', { testId, index });
                const canvasScreenshotPromise = canvasInFrame.screenshot({
                  type: 'png',
                  timeout: 5000,
                  animations: 'disabled',
                });
                
                screenshotBuffer = await Promise.race([
                  canvasScreenshotPromise,
                  timeoutPromise,
                ]);
                
                logger.info('Screenshot captured from canvas inside iframe', { testId, index });
                strategySucceeded = true;
              }
            } catch (canvasError) {
              logger.debug('Canvas inside iframe capture failed, trying frame screenshot', {
                testId,
                error: canvasError instanceof Error ? canvasError.message : String(canvasError),
              });
            }
            
            // Second try: Capture screenshot of iframe's content frame
            if (!strategySucceeded) {
              try {
                // Check if screenshot method exists on frame
                if (typeof iframeFrame.screenshot === 'function') {
                  const screenshotPromise = iframeFrame.screenshot({
                    type: 'png',
                    timeout: 5000,
                    animations: 'disabled',
                  });
                  
                  screenshotBuffer = await Promise.race([
                    screenshotPromise,
                    timeoutPromise,
                  ]);
                  
                  logger.info('Screenshot captured from iframe content frame', { testId, index });
                  strategySucceeded = true;
                } else {
                  logger.debug('Frame.screenshot() not available, will try iframe element', { testId });
                }
              } catch (frameScreenshotError) {
                // Frame.screenshot() failed or not available, try iframe element instead
                logger.debug('Frame screenshot failed, will try iframe element', {
                  testId,
                  error: frameScreenshotError instanceof Error ? frameScreenshotError.message : String(frameScreenshotError),
                });
              }
            }
          }
          
          // If frame screenshot didn't work, try capturing the iframe element itself
          // Skip visibility check - iframe might be "not visible" but still renderable
          if (!strategySucceeded) {
            logger.debug('Capturing iframe element directly (skipping visibility check)', { testId });
            
            try {
              // Don't wait for visibility - just try to capture the iframe element
              // Many games use iframes that Playwright marks as "not visible" but are still renderable
              const screenshotPromise = iframeLocator.screenshot({
                type: 'png',
                timeout: 5000,
                animations: 'disabled',
              });
              
              screenshotBuffer = await Promise.race([
                screenshotPromise,
                timeoutPromise,
              ]);
              
              logger.info('Screenshot captured from iframe element', { testId, index });
              strategySucceeded = true;
            } catch (iframeElementError) {
              // Iframe element capture also failed, try capturing canvas inside iframe
              logger.debug('Iframe element capture failed, trying canvas inside iframe', {
                testId,
                error: iframeElementError instanceof Error ? iframeElementError.message : String(iframeElementError),
              });
              
              // Last resort: try to find canvas inside iframe content frame (if not already tried)
              if (iframeFrame && iframeFrame !== page.mainFrame() && !strategySucceeded) {
                try {
                  const canvasInFrame = iframeFrame.locator('canvas').first();
                  const canvasCount = await canvasInFrame.count({ timeout: 1000 }).catch(() => 0);
                  
                  if (canvasCount > 0) {
                    const canvasScreenshotPromise = canvasInFrame.screenshot({
                      type: 'png',
                      timeout: 5000,
                      animations: 'disabled',
                    });
                    
                    screenshotBuffer = await Promise.race([
                      canvasScreenshotPromise,
                      timeoutPromise,
                    ]);
                    
                    logger.info('Screenshot captured from canvas inside iframe (fallback)', { testId, index });
                    strategySucceeded = true;
                  }
                } catch (canvasError) {
                  logger.debug('Canvas inside iframe capture failed', {
                    testId,
                    error: canvasError instanceof Error ? canvasError.message : String(canvasError),
                  });
                }
              }
            }
          }
        }
      } catch (iframeError) {
        logger.warn('Iframe capture failed, trying next strategy', {
          testId,
          index,
          error: iframeError instanceof Error ? iframeError.message : String(iframeError),
        });
      }
    }
    
    // Strategy 3: Try canvas elements (HTML5 games)
    if (!strategySucceeded) {
      try {
        const canvasCount = await page.locator('canvas').count();
        
        if (canvasCount > 0) {
          logger.info('Canvas element found, capturing canvas', { 
            testId, 
            index, 
            canvasCount 
          });
          
          // If multiple canvases, find the largest one
          let canvasLocator;
          if (canvasCount > 1) {
            logger.info('Multiple canvases detected, selecting largest canvas', { 
              testId, 
              canvasCount 
            });
            
            const canvases = await page.locator('canvas').all();
            let largestCanvas = canvases[0];
            let largestArea = 0;
            
            for (const canvas of canvases) {
              try {
                const box = await canvas.boundingBox();
                if (box) {
                  const area = box.width * box.height;
                  if (area > largestArea) {
                    largestArea = area;
                    largestCanvas = canvas;
                  }
                }
              } catch {
                continue;
              }
            }
            
            canvasLocator = largestCanvas;
            logger.info('Selected largest canvas', { testId, area: largestArea });
          } else {
            canvasLocator = page.locator('canvas').first();
          }
          
          await canvasLocator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
            logger.debug('Canvas visibility timeout, proceeding anyway', { testId });
          });
          
          const screenshotPromise = canvasLocator.screenshot({
            type: 'png',
            timeout: 5000,
            animations: 'disabled',
          });
          
          screenshotBuffer = await Promise.race([
            screenshotPromise,
            timeoutPromise,
          ]);
          
          logger.info('Screenshot captured from canvas', { testId, index });
          strategySucceeded = true;
        }
      } catch (canvasError) {
        logger.warn('Canvas capture failed, trying next strategy', {
          testId,
          index,
          error: canvasError instanceof Error ? canvasError.message : String(canvasError),
        });
      }
    }
    
    // Strategy 4: Fall back to full page viewport
    if (!strategySucceeded) {
      logger.info('No game content found or all strategies failed, capturing page viewport', { testId, index });
      
      const screenshotPromise = page.screenshot({
        type: 'png',
        fullPage: false,
        timeout: 5000,
        animations: 'disabled',
      });
      
      screenshotBuffer = await Promise.race([
        screenshotPromise,
        timeoutPromise,
      ]);
    }
    
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

