/**
 * File: src/browser/ui-pattern-detector.ts
 * 
 * UI pattern detection for game interaction.
 * 
 * This module provides functions for detecting and interacting with game UI elements.
 * It supports both manifest-based detection (using selectors/text/position) and
 * AI-based fallback detection using Stagehand. Prioritizes manifest data when available.
 * 
 * @module UIPatternDetector
 */

import type { BrowserClient } from './browser-client.js';
import type { ManifestData } from '../storage/types.js';
import type { Locator } from '@browserbasehq/stagehand';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Element location result.
 */
export interface ElementLocation {
  /** Playwright locator for the element */
  locator: Locator | null;
  /** Method used to find the element */
  method: 'manifest-selector' | 'manifest-text' | 'manifest-position' | 'ai-detection' | 'not-found';
  /** Selector used (if applicable) */
  selector?: string;
}

/**
 * Find start button using manifest or AI fallback.
 * 
 * Attempts to find the start button using manifest configuration first,
 * then falls back to AI detection if manifest fails or is not available.
 * 
 * Strategy:
 * 1. If manifest has startButton.selector → use selector
 * 2. If manifest has startButton.text → search for button with text
 * 3. If manifest has startButton.position → search by position
 * 4. Fall back to AI detection via Stagehand
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {ManifestData | null} manifest - Optional manifest data
 * @returns {Promise<ElementLocation>} Element location result
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client, manifest);
 * if (location.element) {
 *   await clickElement(client, location.element);
 * }
 * ```
 */
export async function findStartButton(
  client: BrowserClient,
  manifest: ManifestData | null
): Promise<ElementLocation> {
  const page = client.getPage();

  // Strategy 1: Try manifest selector
  if (manifest?.startButton?.selector) {
    try {
      logger.info('Attempting to find start button using manifest selector', {
        selector: manifest.startButton.selector,
      });

      const locator = page.locator(manifest.startButton.selector);
      const count = await locator.count();

      if (count > 0) {
        const firstLocator = locator.first();
        await firstLocator.waitFor({ state: 'visible', timeout: 5000 });
        logger.info('Start button found using manifest selector', {
          selector: manifest.startButton.selector,
        });
        return {
          locator: firstLocator,
          method: 'manifest-selector',
          selector: manifest.startButton.selector,
        };
      }
    } catch (error) {
      logger.warn('Manifest selector failed, trying next strategy', {
        selector: manifest.startButton.selector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 2: Try manifest text
  if (manifest?.startButton?.text) {
    try {
      logger.info('Attempting to find start button using manifest text', {
        text: manifest.startButton.text,
      });

      // Try common button selectors with text matching
      const buttonSelectors = [
        `button:has-text("${manifest.startButton.text}")`,
        `[role="button"]:has-text("${manifest.startButton.text}")`,
        `a:has-text("${manifest.startButton.text}")`,
        `*:has-text("${manifest.startButton.text}")`,
      ];

      for (const selector of buttonSelectors) {
        try {
          const locator = page.locator(selector);
          const count = await locator.count();

          if (count > 0) {
            const firstLocator = locator.first();
            await firstLocator.waitFor({ state: 'visible', timeout: 5000 });
            logger.info('Start button found using manifest text', {
              text: manifest.startButton.text,
              selector,
            });
            return {
              locator: firstLocator,
              method: 'manifest-text',
              selector,
            };
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      logger.warn('Manifest text search failed, trying next strategy', {
        text: manifest.startButton.text,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 3: Try manifest position (less reliable, basic implementation)
  if (manifest?.startButton?.position) {
    try {
      logger.info('Attempting to find start button using manifest position', {
        position: manifest.startButton.position,
      });

      // Position-based detection is heuristic - look for buttons in the specified area
      // This is a simplified implementation
      const positionSelectors = {
        center: 'button',
        top: 'body > *:first-child button',
        bottom: 'body > *:last-child button',
      };

      const selector = positionSelectors[manifest.startButton.position as keyof typeof positionSelectors] || 'button';
      const locator = page.locator(selector);
      const count = await locator.count();

      if (count > 0) {
        // Select the first visible button
        const buttons = await locator.all();
        for (const button of buttons) {
          try {
            await button.waitFor({ state: 'visible', timeout: 2000 });
            logger.info('Start button found using manifest position', {
              position: manifest.startButton.position,
            });
            return {
              locator: button,
              method: 'manifest-position',
              selector,
            };
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      logger.warn('Manifest position search failed, trying AI fallback', {
        position: manifest.startButton.position,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 4: Fall back to AI detection
  logger.info('Attempting to find start button using AI detection');
  try {
    // Note: This requires Stagehand instance, which we need to get from BrowserClient
    // For now, we'll use a simplified approach - actual implementation may need
    // to access Stagehand instance differently
    
    // Create Stagehand handler (this will need access to the Stagehand instance)
    // For now, we'll try basic AI-based element finding
    // The actual implementation depends on how BrowserClient exposes Stagehand
    
    // Since we don't have direct access to Stagehand from BrowserClient,
    // we'll implement a basic text-based search as fallback
    const commonStartTexts = ['start', 'play', 'begin', 'go', 'launch'];
    
    for (const text of commonStartTexts) {
      try {
        const selector = `button:has-text("${text}"), [role="button"]:has-text("${text}")`;
        const locator = page.locator(selector);
        const count = await locator.count();

        if (count > 0) {
          const firstLocator = locator.first();
          await firstLocator.waitFor({ state: 'visible', timeout: 5000 });
          logger.info('Start button found using text fallback', { text });
          return {
            locator: firstLocator,
            method: 'ai-detection',
            selector,
          };
        }
      } catch {
        continue;
      }
    }

    logger.warn('Start button not found using any method');
    return {
      locator: null,
      method: 'not-found',
    };
  } catch (error) {
    logger.error('AI detection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      locator: null,
      method: 'not-found',
    };
  }
}

/**
 * Click an element using Playwright.
 * 
 * Generic helper function for clicking elements found by any method.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {ElementLocation} location - Element location from findStartButton or similar
 * @returns {Promise<boolean>} True if click succeeded, false otherwise
 * @throws {BrowserError} If element is not available for clicking
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client, manifest);
 * if (location.element) {
 *   await clickElement(client, location);
 * }
 * ```
 */
export async function clickElement(
  client: BrowserClient,
  location: ElementLocation
): Promise<boolean> {
  if (!location.locator) {
    throw new BrowserError('Cannot click element - locator not available', {
      method: location.method,
    });
  }

  try {
    logger.info('Clicking element', {
      method: location.method,
      selector: location.selector,
    });

    await location.locator.click({ timeout: 10000 });
    logger.info('Element clicked successfully', {
      method: location.method,
      selector: location.selector,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to click element', {
      method: location.method,
      selector: location.selector,
      error: message,
    });
    throw new BrowserError(`Failed to click element: ${message}`, {
      method: location.method,
      selector: location.selector,
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
          const count = await locator.count({ timeout: 2000 });
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
          const count = await locator.count({ timeout: 2000 });
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

