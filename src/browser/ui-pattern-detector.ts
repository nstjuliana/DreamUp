/**
 * File: src/browser/ui-pattern-detector.ts
 * 
 * UI pattern detection for game interaction using GPT-4o-mini vision.
 * 
 * This module provides functions for detecting and interacting with game UI elements
 * using GPT-4o-mini vision API to analyze screenshots and determine click coordinates.
 * 
 * @module UIPatternDetector
 */

import type { BrowserClient } from './browser-client.js';
import type { Page } from 'playwright';
import type { ManifestData } from '../storage/types.js';
import { captureScreenshotBuffer, captureScreenshot } from './screenshot-capture.js';
import { findStartButtonCoordinates } from '../agent/vision-action-planner.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import OpenAI from 'openai';
import { getConfig } from '../utils/config.js';

/**
 * Button location result using vision AI.
 */
export interface ElementLocation {
  /** Button coordinates (null if not found) */
  coordinates: { x: number; y: number } | null;
  /** Method used to find the element */
  method: 'vision-detection' | 'not-found';
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
 * Find start button using GPT-4o-mini vision.
 * 
 * Captures a screenshot and uses GPT-4o-mini vision API to locate the start button.
 * Returns coordinates for clicking.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @returns {Promise<ElementLocation>} Element location result with coordinates
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client);
 * if (location.coordinates) {
 *   await clickElement(client, location);
 * }
 * ```
 */
export async function findStartButton(
  client: BrowserClient
): Promise<ElementLocation> {
  const testId = 'unknown'; // Will be passed from caller in future

  logger.info('Finding start button using GPT-4o-mini vision', { testId });

  try {
    // Capture screenshot buffer
    const screenshotBuffer = await captureScreenshotBuffer(client, testId, 0);
    if (!screenshotBuffer) {
      logger.error('Failed to capture screenshot for start button detection', { testId });
      const failureScreenshot = await captureStartButtonFailure(client, testId);
      return {
        coordinates: null,
        method: 'not-found',
        failureScreenshot,
      };
    }

    // Convert to base64
    const screenshotBase64 = screenshotBuffer.toString('base64');

    // Initialize OpenAI client
    const config = getConfig();
    if (config.llm.provider !== 'openai') {
      logger.error('OpenAI provider required for vision-based start button detection', {
        provider: config.llm.provider,
      });
      const failureScreenshot = await captureStartButtonFailure(client, testId);
      return {
        coordinates: null,
        method: 'not-found',
        failureScreenshot,
      };
    }

    const openaiClient = new OpenAI({
      apiKey: config.llm.apiKey,
    });

    // Find start button coordinates using vision
    const coordinates = await findStartButtonCoordinates(screenshotBase64, openaiClient);

    if (coordinates) {
      logger.info('Start button found using GPT-4o-mini vision', {
        testId,
        x: coordinates.x,
        y: coordinates.y,
      });

      return {
        coordinates,
        method: 'vision-detection',
      };
    } else {
      logger.warn('Start button not found using GPT-4o-mini vision', { testId });
      const failureScreenshot = await captureStartButtonFailure(client, testId);
      return {
        coordinates: null,
        method: 'not-found',
        failureScreenshot,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to find start button using vision', {
      testId,
      error: message,
    });
    const failureScreenshot = await captureStartButtonFailure(client, testId);
    return {
      coordinates: null,
      method: 'not-found',
      failureScreenshot,
    };
  }
}

/**
 * Click an element using coordinates.
 * 
 * Uses Playwright's mouse API to click at the specified coordinates.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {ElementLocation} location - Element location from findStartButton
 * @returns {Promise<boolean>} True if click succeeded, false otherwise
 * @throws {BrowserError} If coordinates are not available
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client);
 * if (location.coordinates) {
 *   await clickElement(client, location);
 * }
 * ```
 */
export async function clickElement(
  client: BrowserClient,
  location: ElementLocation
): Promise<boolean> {
  if (!location.coordinates) {
    throw new BrowserError('Cannot click element - coordinates not available', {
      method: location.method,
      failureScreenshot: location.failureScreenshot,
    });
  }

  const page = client.getPage();
  const { x, y } = location.coordinates;

  try {
    logger.info('Clicking element using coordinates', {
      method: location.method,
      x,
      y,
    });

    // Log element details
    console.log('\n📋 ELEMENT DETAILS (Vision):');
    console.log(`   Coordinates: (${x}, ${y})`);
    console.log(`   Detection Method: ${location.method}`);
    console.log('');

    // Click at coordinates
    await page.mouse.click(x, y);

    logger.info('Element clicked successfully', {
      x,
      y,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to click element at coordinates', {
      x,
      y,
      error: message,
    });
    throw new BrowserError(`Failed to click element: ${message}`, {
      x,
      y,
      error: message,
    });
  }
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

