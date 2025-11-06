/**
 * File: src/browser/ui-pattern-detector.ts
 * 
 * UI pattern detection for game interaction using Stagehand.
 * 
 * This module provides functions for detecting and interacting with game UI elements
 * using Stagehand's natural language click capabilities.
 * 
 * @module UIPatternDetector
 */

import type { BrowserClient } from './browser-client.js';
import type { Page } from 'playwright';
import type { ManifestData } from '../storage/types.js';
import { captureScreenshot } from './screenshot-capture.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { StagehandClient } from './stagehand-client.js';

/**
 * Button location result using Stagehand.
 */
export interface ElementLocation {
  /** Whether the element was found and clicked successfully */
  success: boolean;
  /** Method used to find/click the element */
  method: 'stagehand-click' | 'not-found';
  /** Screenshot URL if element not found */
  failureScreenshot?: string | null;
}

/**
 * Capture failure screenshot when start button not found.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {string} testId - Test run identifier
 * @returns {Promise<string | null>} Screenshot URL or null if failed
 * @private
 */
async function captureStartButtonFailure(
  client: BrowserClient,
  testId: string
): Promise<string | null> {
  try {
    const screenshot = await captureScreenshot(client, testId, 999); // Use high number for failure screenshot
    logger.info('Failure screenshot captured', { 
      testId,
      screenshotUrl: screenshot 
    });
    return screenshot;
  } catch (screenshotError) {
    logger.error('Failed to capture failure screenshot', {
      testId,
      error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
    });
    return null;
  }
}

/**
 * Find and click start button using Stagehand.
 * 
 * Uses Stagehand's natural language capabilities to identify and click the start button.
 * Attempts common variations like "start button", "play button", "begin button".
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {StagehandClient} stagehandClient - Stagehand client instance
 * @param {string} testId - Test run identifier for logging and screenshots
 * @returns {Promise<ElementLocation>} Element location result indicating success/failure
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client, stagehandClient, 'test-123');
 * if (location.success) {
 *   logger.info('Start button clicked successfully');
 * }
 * ```
 */
export async function findStartButton(
  client: BrowserClient,
  stagehandClient: StagehandClient,
  testId: string
): Promise<ElementLocation> {
  logger.info('Finding start button using Stagehand', { testId });

  // Common variations of start button descriptions
  const startButtonVariations = [
    'start button',
    'play button',
    'begin button',
    'start',
    'play',
    'begin',
  ];

  // Try each variation until one succeeds
  for (const variation of startButtonVariations) {
    try {
      logger.debug('Attempting to click start button', { testId, variation });
      
      const result = await stagehandClient.clickElement(variation);
      
      if (result.success) {
        logger.info('Start button clicked successfully using Stagehand', {
          testId,
          variation,
        });
        return {
          success: true,
          method: 'stagehand-click',
        };
      } else {
        logger.debug('Start button click failed, trying next variation', {
          testId,
          variation,
          error: result.error,
        });
      }
    } catch (error) {
      logger.debug('Error attempting to click start button', {
        testId,
        variation,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to next variation
    }
  }

  // All variations failed
  logger.warn('Start button not found using Stagehand - trying all variations', { testId });
  const failureScreenshot = await captureStartButtonFailure(client, testId);
  return {
    success: false,
    method: 'not-found',
    failureScreenshot,
  };
}

/**
 * Show visual click indicator overlay on page.
 * 
 * Injects a visual overlay (crosshair and circle) at the specified coordinates
 * to help debug click targeting issues.
 * 
 * @param {Page} page - Playwright page instance
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<void>}
 */
export async function showClickIndicator(page: Page, x: number, y: number): Promise<void> {
  const overlayId = 'dreamup-click-indicator';
  const overlayHTML = `
    <div id="${overlayId}" style="
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
      display: block;
    ">
      <!-- Circle indicator -->
      <div style="
        position: absolute;
        left: ${x - 15}px;
        top: ${y - 15}px;
        width: 30px;
        height: 30px;
        border: 3px solid #ff0000;
        border-radius: 50%;
        background: rgba(255, 0, 0, 0.2);
        pointer-events: none;
        box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
      "></div>
      <!-- Crosshair lines -->
      <div style="
        position: absolute;
        left: ${x - 1}px;
        top: ${y - 20}px;
        width: 2px;
        height: 40px;
        background: #ff0000;
        pointer-events: none;
        box-shadow: 0 0 5px rgba(255, 0, 0, 0.8);
      "></div>
      <div style="
        position: absolute;
        left: ${x - 20}px;
        top: ${y - 1}px;
        width: 40px;
        height: 2px;
        background: #ff0000;
        pointer-events: none;
        box-shadow: 0 0 5px rgba(255, 0, 0, 0.8);
      "></div>
      <!-- Coordinate label -->
      <div style="
        position: absolute;
        left: ${x + 20}px;
        top: ${y - 20}px;
        background: rgba(0, 0, 0, 0.8);
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
      ">(${x}, ${y})</div>
    </div>
  `;

  await page.evaluate((html: string) => {
    // Remove existing indicator if present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (globalThis as any).document;
    const existing = doc.getElementById('dreamup-click-indicator');
    if (existing) {
      existing.remove();
    }
    // Add new indicator
    doc.body.insertAdjacentHTML('beforeend', html);
  }, overlayHTML);

  // Wait briefly for the indicator to be visible
  await page.waitForTimeout(100);
}

/**
 * Hide visual click indicator overlay.
 * 
 * Removes the click indicator overlay from the page.
 * 
 * @param {Page} page - Playwright page instance
 * @returns {Promise<void>}
 */
export async function hideClickIndicator(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (globalThis as any).document;
    const indicator = doc.getElementById('dreamup-click-indicator');
    if (indicator) {
      indicator.remove();
    }
  });
}

/**
 * Click an element using Stagehand (deprecated - kept for compatibility).
 * 
 * This function is kept for backward compatibility but is no longer needed
 * since findStartButton now handles clicking directly via Stagehand.
 * 
 * @deprecated Use StagehandClient.clickElement() directly instead
 */
export async function clickElement(
  client: BrowserClient,
  location: ElementLocation,
  options: { testId?: string; screenshotIndex?: number } = {}
): Promise<{ success: boolean; indicatorScreenshotUrl?: string }> {
  // If already successful (from findStartButton), just return success
  if (location.success) {
    return { success: true };
  }
  
  // Otherwise, element was not found
  throw new BrowserError('Cannot click element - element not found', {
    method: location.method,
    failureScreenshot: location.failureScreenshot,
  });
}

/**
 * Detect current game state using manifest gameStates.
 * 
 * Attempts to identify the current game screen/state by checking for
 * indicators defined in the manifest's gameStates array.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {ManifestData} manifest - Manifest with gameStates defined
 * @returns {Promise<string | null>} Current game state name or null if not detected
 * 
 * @example
 * ```typescript
 * const state = await detectGameState(client, manifest);
 * if (state === 'main-menu') {
 *   // Handle main menu
 * }
 * ```
 */
export async function detectGameState(
  client: BrowserClient,
  manifest: ManifestData
): Promise<string | null> {
  if (!manifest.gameStates || manifest.gameStates.length === 0) {
    return null;
  }

  const page = client.getPage();

  for (const gameState of manifest.gameStates) {
    if (!gameState.indicators) {
      continue;
    }

    let matches = 0;
    let totalChecks = 0;

    // Check text indicators
    if (gameState.indicators.text && gameState.indicators.text.length > 0) {
      for (const text of gameState.indicators.text) {
        totalChecks++;
        try {
          const locator = page.locator(`text="${text}"`);
          const count = await locator.count();
          if (count > 0) {
            matches++;
          }
        } catch {
          // Text not found, continue
        }
      }
    }

    // Check element indicators
    if (gameState.indicators.elements && gameState.indicators.elements.length > 0) {
      for (const selector of gameState.indicators.elements) {
        totalChecks++;
        try {
          const locator = page.locator(selector);
          const count = await locator.count();
          if (count > 0) {
            matches++;
          }
        } catch {
          // Element not found, continue
        }
      }
    }

    // If majority of indicators match, consider this state detected
    if (totalChecks > 0 && matches / totalChecks >= 0.5) {
      logger.info('Game state detected', {
        state: gameState.name,
        matches,
        totalChecks,
      });
      return gameState.name;
    }
  }

  return null;
}

