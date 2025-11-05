/**
 * File: src/browser/ui-pattern-detector.ts
 * 
 * UI pattern detection for game interaction using StageHand AI.
 * 
 * This module provides functions for detecting and interacting with game UI elements
 * using StageHand's AI-powered observe() and act() methods. All element-based detection
 * has been removed in favor of pure AI detection.
 * 
 * @module UIPatternDetector
 */

import type { BrowserClient } from './browser-client.js';
import type { Page } from '@browserbasehq/stagehand';
import type { ManifestData } from '../storage/types.js';
import { captureScreenshot } from './screenshot-capture.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * StageHand ObserveResult type (from @browserbasehq/stagehand).
 * Represents an actionable element discovered by AI.
 */
export interface ObserveResult {
  /** XPath selector to locate element */
  selector: string;
  /** Human-readable description of the element */
  description: string;
  /** Suggested action method (e.g., 'click', 'fill') */
  method?: string;
  /** Additional action parameters */
  arguments?: string[];
}

/**
 * Element location result using StageHand AI.
 */
export interface ElementLocation {
  /** StageHand ObserveResult for the element (null if not found) */
  element: ObserveResult | null;
  /** Method used to find the element */
  method: 'ai-detection' | 'not-found';
  /** Description used to find element */
  description?: string;
  /** Screenshot URL if element not found */
  failureScreenshot?: string | null;
  /** All buttons found on page (for diagnostics) */
  allButtonsFound?: ObserveResult[];
}

/**
 * Capture detailed failure information when start button not found.
 * 
 * Takes a screenshot, logs extensive details, and attempts to find all buttons
 * on the page for diagnostic purposes.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {string} testId - Test run identifier
 * @param {string[]} attemptedDescriptions - All descriptions that were tried
 * @returns {Promise<{screenshot: string | null, allButtons: ObserveResult[]}>} Failure diagnostics
 * @private
 */
async function captureStartButtonFailure(
  client: BrowserClient,
  testId: string,
  attemptedDescriptions: string[]
): Promise<{ screenshot: string | null; allButtons: ObserveResult[] }> {
  const page = client.getPage();
  
  logger.error('Start button not found by StageHand AI - capturing diagnostics', {
    testId,
    attemptedDescriptions,
  });

  // Capture screenshot showing page state
  let screenshot: string | null = null;
  try {
    screenshot = await captureScreenshot(client, testId, 999); // Use high number for failure screenshot
    logger.info('Failure screenshot captured', { 
      testId,
      screenshotUrl: screenshot 
    });
  } catch (screenshotError) {
    logger.error('Failed to capture failure screenshot', {
      testId,
      error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
    });
  }

  // Get page information for diagnostics
  let pageUrl = 'unknown';
  let pageTitle = 'unknown';
  try {
    pageUrl = page.url();
    pageTitle = await page.title();
  } catch (error) {
    logger.warn('Failed to get page info', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Try to observe ALL buttons on page for diagnostics
  let allButtons: ObserveResult[] = [];
  try {
    logger.info('Attempting to find all buttons on page for diagnostics', { testId });
    allButtons = await page.observe("Find all clickable buttons on the page");
    
    logger.info('All buttons found on page for diagnostics', {
      testId,
      buttonCount: allButtons.length,
      buttons: allButtons.map(btn => ({
        description: btn.description,
        method: btn.method,
        selector: btn.selector,
      })),
    });

    // Print to console for visibility
    console.log('\n' + '='.repeat(80));
    console.log('🔍 START BUTTON NOT FOUND - DIAGNOSTIC INFORMATION');
    console.log('='.repeat(80));
    console.log(`Test ID: ${testId}`);
    console.log(`Page URL: ${pageUrl}`);
    console.log(`Page Title: ${pageTitle}`);
    console.log(`\nAttempted Descriptions:`);
    attemptedDescriptions.forEach((desc, i) => {
      console.log(`  ${i + 1}. "${desc}"`);
    });
    console.log(`\nAll Buttons Found on Page (${allButtons.length}):`);
    allButtons.forEach((btn, i) => {
      console.log(`  ${i + 1}. ${btn.description}`);
      console.log(`     Method: ${btn.method || 'none'}`);
      console.log(`     Selector: ${btn.selector}`);
    });
    console.log(`\nFailure Screenshot: ${screenshot || 'not available'}`);
    console.log('='.repeat(80) + '\n');
  } catch (observeError) {
    logger.warn('Failed to observe all buttons for diagnostics', {
      testId,
      error: observeError instanceof Error ? observeError.message : String(observeError),
    });
  }

  return { screenshot, allButtons };
}

/**
 * Find start button using StageHand AI.
 * 
 * Uses StageHand's observe() API to find the start button with multiple
 * descriptive queries. If no button is found, captures detailed failure
 * information including screenshots and all buttons on the page.
 * 
 * Relies entirely on AI detection - no manifest configuration needed.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @returns {Promise<ElementLocation>} Element location result
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client);
 * if (location.element) {
 *   await clickElement(client, location);
 * }
 * ```
 */
export async function findStartButton(
  client: BrowserClient
): Promise<ElementLocation> {
  const page = client.getPage();
  const testId = 'unknown'; // Will be passed from caller in future

  logger.info('Finding start button using StageHand AI observe()', { testId });

  // Multiple descriptive queries to try
  const descriptions = [
    "Find the start game button",
    "Find the play button",
    "Find the begin button",
    "Find the button to start playing",
    "Find the start button",
  ];

  // Try each description
  for (const description of descriptions) {
    try {
      logger.info('Attempting to find start button with StageHand', {
        testId,
        description,
      });

      const results = await page.observe(description);
      
      if (results && results.length > 0) {
        // Filter for click-able buttons
        const clickableButton = results.find(r => r.method === 'click');
        
        if (clickableButton) {
          logger.info('Start button found using StageHand AI', {
            testId,
            description,
            buttonDescription: clickableButton.description,
            method: clickableButton.method,
            selector: clickableButton.selector,
          });

          return {
            element: clickableButton,
            method: 'ai-detection',
            description,
          };
        } else {
          logger.debug('Elements found but none are clickable buttons', {
            testId,
            description,
            resultCount: results.length,
          });
        }
      } else {
        logger.debug('No elements found for description', {
          testId,
          description,
        });
      }
    } catch (error) {
      logger.warn('StageHand observe() failed for description', {
        testId,
        description,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // No button found - capture failure diagnostics
  logger.warn('Start button not found using any StageHand description', {
    testId,
    attemptedCount: descriptions.length,
  });

  const failureInfo = await captureStartButtonFailure(client, testId, descriptions);

  return {
    element: null,
    method: 'not-found',
    failureScreenshot: failureInfo.screenshot,
    allButtonsFound: failureInfo.allButtons,
  };
}

/**
 * Click an element using StageHand's act() method.
 * 
 * Uses StageHand's AI-powered act() to click the element. This is more
 * reliable than direct Playwright clicking as it can handle dynamic pages.
 * 
 * @param {BrowserClient} client - Browser client instance
 * @param {ElementLocation} location - Element location from findStartButton
 * @returns {Promise<boolean>} True if click succeeded, false otherwise
 * @throws {BrowserError} If element is not available for clicking
 * 
 * @example
 * ```typescript
 * const location = await findStartButton(client);
 * if (location.element) {
 *   await clickElement(client, location);
 * }
 * ```
 */
export async function clickElement(
  client: BrowserClient,
  location: ElementLocation
): Promise<boolean> {
  if (!location.element) {
    throw new BrowserError('Cannot click element - element not available', {
      method: location.method,
      failureScreenshot: location.failureScreenshot,
    });
  }

  const page = client.getPage();
  const element = location.element;

  try {
    logger.info('Clicking element using StageHand act()', {
      method: location.method,
      description: element.description,
      selector: element.selector,
      actionMethod: element.method,
    });

    // Log element details
    console.log('\n📋 ELEMENT DETAILS (StageHand):');
    console.log(`   Description: ${element.description}`);
    console.log(`   Method: ${element.method}`);
    console.log(`   Selector: ${element.selector}`);
    console.log(`   Detection Method: ${location.method}`);
    console.log('');

    // Use StageHand's act() to click the element
    // This is more reliable than direct clicking as StageHand handles
    // scrolling, waiting, and element state automatically
    await page.act(element);

    logger.info('Element clicked successfully using StageHand', {
      description: element.description,
      selector: element.selector,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to click element using StageHand', {
      description: element.description,
      selector: element.selector,
      error: message,
    });
    throw new BrowserError(`Failed to click element: ${message}`, {
      description: element.description,
      selector: element.selector,
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

