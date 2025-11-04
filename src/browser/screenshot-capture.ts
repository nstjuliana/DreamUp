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
 * Uses a multi-strategy approach to capture only the game content area:
 * 1. **Game container selectors**: Tries common CSS selectors like #game, .game-container,
 *    #game-canvas, etc. Validates that the container is reasonably sized (>100x100px).
 *    Prioritized for DOM-based games.
 * 2. **Iframes**: Targets iframe elements (most common for embedded games). If multiple
 *    iframes exist, selects the largest one. Attempts to capture the iframe's content frame.
 * 3. **Canvas elements**: Targets HTML5 canvas elements (common for HTML5 games). If multiple
 *    canvases exist, selects the largest one.
 * 4. **Full page fallback**: If no game content is found, captures the entire page viewport.
 * 
 * Converts the screenshot to a buffer and uploads it to Supabase Storage. Returns the
 * public URL of the uploaded screenshot. Handles failures gracefully - logs error and
 * returns null rather than throwing to avoid breaking the test flow.
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
          await gameContainer.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
            logger.debug('Game container visibility timeout, proceeding anyway', { testId });
          });
          
          const screenshotPromise = gameContainer.screenshot({
            type: 'png',
            timeout: 15000,
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
          
          // Wait for iframe to be attached to the page
          await iframeLocator.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {
            logger.debug('Iframe attachment timeout, proceeding anyway', { testId });
          });
          
          // Get the content frame from the iframe element
          const iframeElement = await iframeLocator.elementHandle();
          const iframeFrame = iframeElement ? await iframeElement.contentFrame() : null;
          
          // Try to capture iframe content frame first (if available)
          if (iframeFrame && iframeFrame !== page.mainFrame()) {
            // Wait for iframe content to be loaded
            try {
              await iframeFrame.waitForLoadState('domcontentloaded', { timeout: 5000 });
            } catch {
              logger.debug('Iframe load state timeout, proceeding anyway', { testId });
            }
            
            // Try to capture screenshot of iframe's content frame
            // Note: Frame.screenshot() might not be available in all Playwright versions
            try {
              // Check if screenshot method exists on frame
              if (typeof iframeFrame.screenshot === 'function') {
                const screenshotPromise = iframeFrame.screenshot({
                  type: 'png',
                  timeout: 15000,
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
          
          // If frame screenshot didn't work, try capturing the iframe element itself
          if (!strategySucceeded) {
            logger.debug('Capturing iframe element directly', { testId });
            
            await iframeLocator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
              logger.debug('Iframe visibility timeout, proceeding anyway', { testId });
            });
            
            try {
              const screenshotPromise = iframeLocator.screenshot({
                type: 'png',
                timeout: 15000,
                animations: 'disabled',
              });
              
              screenshotBuffer = await Promise.race([
                screenshotPromise,
                timeoutPromise,
              ]);
              
              logger.info('Screenshot captured from iframe element', { testId, index });
              strategySucceeded = true;
            } catch (iframeElementError) {
              // Iframe element capture also failed, will try next strategy
              logger.debug('Iframe element capture failed', {
                testId,
                error: iframeElementError instanceof Error ? iframeElementError.message : String(iframeElementError),
              });
              throw iframeElementError; // Re-throw to trigger outer catch and move to next strategy
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
          
          await canvasLocator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
            logger.debug('Canvas visibility timeout, proceeding anyway', { testId });
          });
          
          const screenshotPromise = canvasLocator.screenshot({
            type: 'png',
            timeout: 15000,
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
        timeout: 15000,
        animations: 'disabled',
      });
      
      screenshotBuffer = await Promise.race([
        screenshotPromise,
        timeoutPromise,
      ]);
    }
    
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

