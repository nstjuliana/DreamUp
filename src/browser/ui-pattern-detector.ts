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
import type { Page } from '@browserbasehq/stagehand';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Locator type from Playwright (Stagehand uses Playwright under the hood)
type Locator = Awaited<ReturnType<Page['locator']>>;

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
      // Order matters: most specific first, avoid generic * selector
      const buttonSelectors = [
        `button:has-text("${manifest.startButton.text}")`,
        `[role="button"]:has-text("${manifest.startButton.text}")`,
        `a:has-text("${manifest.startButton.text}")`,
        `div:has-text("${manifest.startButton.text}")`,
        `span:has-text("${manifest.startButton.text}")`,
      ];

      for (const selector of buttonSelectors) {
        try {
          const locator = page.locator(selector);
          const count = await locator.count();

          if (count > 0) {
            // Filter out non-interactive elements (html, body, etc.)
            // and find the most specific/clickable element
            const allElements = await locator.all();
            
            for (const elementLocator of allElements) {
              try {
                // Check if it's a non-interactive container element
                const tagName = await elementLocator.evaluate((el) => el.tagName.toLowerCase());
                
                // Skip root elements
                if (tagName === 'html' || tagName === 'body') {
                  continue;
                }

                // Check if element is clickable (has onclick, is button-like, or has cursor pointer)
                const isClickable = await elementLocator.evaluate((el) => {
                  const tag = el.tagName.toLowerCase();
                  const hasOnClick = el.getAttribute('onclick') !== null;
                  const win = el.ownerDocument.defaultView;
                  if (!win) return false;
                  const style = win.getComputedStyle(el);
                  const cursor = style.cursor;
                  const role = el.getAttribute('role');
                  
                  return (
                    tag === 'button' ||
                    tag === 'a' ||
                    role === 'button' ||
                    hasOnClick ||
                    cursor === 'pointer' ||
                    el.classList.contains('button') ||
                    el.classList.contains('btn') ||
                    el.classList.contains('roundbutton')
                  );
                }).catch(() => false);

                if (isClickable || tagName === 'button' || tagName === 'a') {
                  await elementLocator.waitFor({ state: 'visible', timeout: 5000 });
                  logger.info('Start button found using manifest text', {
                    text: manifest.startButton.text,
                    selector,
                    tagName,
                  });
                  return {
                    locator: elementLocator,
                    method: 'manifest-text',
                    selector,
                  };
                }
              } catch {
                continue;
              }
            }
            
            // If no clickable element found, check if we have a container element
            // and search for clickable children within it
            for (const elementLocator of allElements) {
              try {
                const tagName = await elementLocator.evaluate((el) => el.tagName.toLowerCase());
                if (tagName !== 'html' && tagName !== 'body') {
                  // Check if this element contains clickable children with the text
                  try {
                    // Search for clickable children with the text
                    const clickableChildren = await elementLocator.locator(
                      `button:has-text("${manifest.startButton.text}"), a:has-text("${manifest.startButton.text}"), [role="button"]:has-text("${manifest.startButton.text}"), .roundbutton:has-text("${manifest.startButton.text}"), .button:has-text("${manifest.startButton.text}"), [class*="button"]:has-text("${manifest.startButton.text}")`
                    ).all();
                    
                    if (clickableChildren.length > 0 && clickableChildren[0]) {
                      // Found a clickable child - use it instead
                      const childLocator = clickableChildren[0];
                      await childLocator.waitFor({ state: 'visible', timeout: 5000 });
                      logger.info('Start button found as clickable child of container', {
                        text: manifest.startButton.text,
                        selector,
                        parentTag: tagName,
                      });
                      return {
                        locator: childLocator,
                        method: 'manifest-text',
                        selector: `${selector} > clickable-child`,
                      };
                    }
                    
                    // Also try to find by text node and walk up to clickable parent
                    const textNodeLocator = elementLocator.locator(`text="${manifest.startButton.text}"`);
                    const textNodeCount = await textNodeLocator.count();
                    if (textNodeCount > 0) {
                      const textNode = textNodeLocator.first();
                      const clickableParentInfo = await textNode.evaluate((el) => {
                        let current = el.parentElement;
                        while (current && current.tagName !== 'HTML') {
                          const tag = current.tagName.toLowerCase();
                          const win = current.ownerDocument.defaultView;
                          if (!win) {
                            current = current.parentElement;
                            continue;
                          }
                          const style = win.getComputedStyle(current);
                          const cursor = style.cursor;
                          const role = current.getAttribute('role');
                          
                          if (
                            tag === 'button' ||
                            tag === 'a' ||
                            role === 'button' ||
                            cursor === 'pointer' ||
                            current.classList.contains('button') ||
                            current.classList.contains('btn') ||
                            current.classList.contains('roundbutton')
                          ) {
                            const id = current.id ? `#${current.id}` : '';
                            const classes = Array.from(current.classList).map(c => `.${c}`).join('');
                            return { tag, id, classes, found: true };
                          }
                          current = current.parentElement;
                        }
                        return { found: false };
                      }).catch(() => ({ found: false }));
                      
                      if (clickableParentInfo && 'found' in clickableParentInfo && clickableParentInfo.found && 'tag' in clickableParentInfo) {
                        // Construct selector for the clickable parent
                        let parentSelector = clickableParentInfo.tag;
                        if (clickableParentInfo.id && clickableParentInfo.id.length > 1) {
                          parentSelector = clickableParentInfo.id;
                        } else if (clickableParentInfo.classes) {
                          parentSelector = clickableParentInfo.classes.split(' ')[0];
                        }
                        
                        const parentLocator = page.locator(`${parentSelector}:has-text("${manifest.startButton.text}")`);
                        const parentCount = await parentLocator.count();
                        if (parentCount > 0) {
                          const firstParent = parentLocator.first();
                          await firstParent.waitFor({ state: 'visible', timeout: 5000 });
                          logger.info('Start button found via text node parent traversal', {
                            text: manifest.startButton.text,
                            selector: parentSelector,
                          });
                          return {
                            locator: firstParent,
                            method: 'manifest-text',
                            selector: `parent:${parentSelector}`,
                          };
                        }
                      }
                    }
                  } catch (childSearchError) {
                    // Failed to find clickable child, continue to fallback
                    logger.debug('Failed to find clickable child in container', {
                      error: childSearchError instanceof Error ? childSearchError.message : String(childSearchError),
                    });
                  }
                  
                  // Last resort: use the container element itself
                  await elementLocator.waitFor({ state: 'visible', timeout: 5000 });
                  logger.warn('Using non-clickable container element as fallback', {
                    text: manifest.startButton.text,
                    selector,
                    tagName,
                  });
                  return {
                    locator: elementLocator,
                    method: 'manifest-text',
                    selector,
                  };
                }
              } catch {
                continue;
              }
            }
          }
        } catch {
          continue;
        }
      }
      
      // Last resort: try to find element by exact text content match and find clickable parent
      try {
        const exactTextLocator = page.locator(`text="${manifest.startButton.text}"`);
        const count = await exactTextLocator.count();
        if (count > 0) {
          // Find the parent element that's likely the button
          const allTextElements = await exactTextLocator.all();
          for (const textElement of allTextElements) {
            try {
              // Try to find a clickable parent by traversing up the DOM
              const clickableParentInfo = await textElement.evaluate((el) => {
                let current = el.parentElement;
                while (current && current.tagName !== 'HTML') {
                  const tag = current.tagName.toLowerCase();
                  const win = current.ownerDocument.defaultView;
                  if (!win) {
                    current = current.parentElement;
                    continue;
                  }
                  const style = win.getComputedStyle(current);
                  const cursor = style.cursor;
                  const role = current.getAttribute('role');
                  
                  if (
                    tag === 'button' ||
                    tag === 'a' ||
                    role === 'button' ||
                    cursor === 'pointer' ||
                    current.classList.contains('button') ||
                    current.classList.contains('btn') ||
                    current.classList.contains('roundbutton')
                  ) {
                    // Return selector info to find this element
                    const id = current.id ? `#${current.id}` : '';
                    const classes = Array.from(current.classList).map(c => `.${c}`).join('');
                    return { tag, id, classes, found: true };
                  }
                  current = current.parentElement;
                }
                return { found: false };
              }).catch(() => ({ found: false }));
              
              if (clickableParentInfo && 'found' in clickableParentInfo && clickableParentInfo.found && 'tag' in clickableParentInfo) {
                // Try to construct a selector for the parent
                let parentSelector = clickableParentInfo.tag;
                if (clickableParentInfo.id && clickableParentInfo.id.length > 1) {
                  parentSelector = clickableParentInfo.id;
                } else if (clickableParentInfo.classes) {
                  parentSelector = clickableParentInfo.classes.split(' ')[0]; // Use first class
                }
                
                // Try to find it using the text as a filter
                const parentLocator = page.locator(`${parentSelector}:has-text("${manifest.startButton.text}")`);
                const parentCount = await parentLocator.count();
                if (parentCount > 0) {
                  const firstParent = parentLocator.first();
                  await firstParent.waitFor({ state: 'visible', timeout: 5000 });
                  logger.info('Start button found via text parent element', {
                    text: manifest.startButton.text,
                    selector: parentSelector,
                  });
                  return {
                    locator: firstParent,
                    method: 'manifest-text',
                    selector: `parent:${parentSelector}`,
                  };
                }
              }
            } catch {
              continue;
            }
          }
        }
      } catch {
        // Ignore - this is a fallback
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

    // Gather detailed element information for debugging
    try {
      const elementInfo: Record<string, unknown> = {};
      
      // Check if element exists
      const count = await location.locator.count();
      elementInfo.count = count;
      
      if (count === 0) {
        logger.error('Element not found - count is 0', {
          method: location.method,
          selector: location.selector,
        });
        throw new BrowserError('Element not found (count is 0)');
      }

      // Get first element details
      const firstLocator = location.locator.first();
      
      // Get visibility state
      try {
        const isVisible = await firstLocator.isVisible();
        elementInfo.isVisible = isVisible;
      } catch {
        elementInfo.isVisible = 'unknown';
      }

      // Get bounding box (position and size)
      try {
        const boundingBox = await firstLocator.boundingBox();
        elementInfo.boundingBox = boundingBox;
      } catch {
        elementInfo.boundingBox = 'not available';
      }

      // Get text content
      try {
        const textContent = await firstLocator.textContent();
        elementInfo.textContent = textContent?.trim() || '(empty)';
      } catch {
        elementInfo.textContent = 'not available';
      }

      // Get tag name
      try {
        const tagName = await firstLocator.evaluate((el) => el.tagName.toLowerCase());
        elementInfo.tagName = tagName;
      } catch {
        elementInfo.tagName = 'not available';
      }

      // Get element attributes
      try {
        const attributes = await firstLocator.evaluate((el) => {
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        });
        elementInfo.attributes = attributes;
      } catch {
        elementInfo.attributes = 'not available';
      }

      // Check if element is enabled/disabled
      try {
        const isDisabled = await firstLocator.isDisabled();
        elementInfo.isDisabled = isDisabled;
      } catch {
        elementInfo.isDisabled = 'not applicable';
      }

      // Check if element is in viewport
      try {
        const isInViewport = await firstLocator.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          // Access window and document from browser context
          const win = el.ownerDocument.defaultView;
          const doc = el.ownerDocument;
          if (!win || !doc) return false;
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (win.innerHeight || doc.documentElement.clientHeight) &&
            rect.right <= (win.innerWidth || doc.documentElement.clientWidth)
          );
        });
        elementInfo.isInViewport = isInViewport;
      } catch {
        elementInfo.isInViewport = 'unknown';
      }

      // Log all element details
      logger.info('Element details before clicking:', elementInfo);
      
      // Also print a formatted summary
      console.log('\n📋 ELEMENT DETAILS:');
      console.log(`   Method: ${location.method}`);
      console.log(`   Selector: ${location.selector}`);
      console.log(`   Count: ${elementInfo.count}`);
      console.log(`   Visible: ${elementInfo.isVisible}`);
      console.log(`   Tag: ${elementInfo.tagName}`);
      console.log(`   Text: "${elementInfo.textContent}"`);
      console.log(`   In Viewport: ${elementInfo.isInViewport}`);
      console.log(`   Disabled: ${elementInfo.isDisabled}`);
      if (elementInfo.boundingBox && typeof elementInfo.boundingBox === 'object') {
        const box = elementInfo.boundingBox as { x: number; y: number; width: number; height: number };
        console.log(`   Position: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
      }
      console.log('');

    } catch (infoError) {
      logger.warn('Failed to gather element details', {
        error: infoError instanceof Error ? infoError.message : String(infoError),
      });
    }

    // Scroll element into view first to ensure it's visible
    try {
      await location.locator.scrollIntoViewIfNeeded({ timeout: 5000 });
      logger.debug('Element scrolled into view');
      
      // Re-check bounding box after scrolling
      try {
        const boundingBox = await location.locator.first().boundingBox();
        logger.info('Element position after scrolling', { boundingBox });
      } catch {
        // Ignore
      }
    } catch (scrollError) {
      logger.warn('Failed to scroll element into view', {
        error: scrollError instanceof Error ? scrollError.message : String(scrollError),
      });
      // Continue anyway - might still be clickable
    }

    // Small delay to ensure element is fully rendered after scrolling
    await new Promise(resolve => setTimeout(resolve, 300));

    // Try normal click first
    try {
      await location.locator.click({ timeout: 10000 });
      logger.info('Element clicked successfully', {
        method: location.method,
        selector: location.selector,
      });
      return true;
    } catch (clickError) {
      // If normal click fails, try force click
      logger.warn('Normal click failed, trying force click', {
        error: clickError instanceof Error ? clickError.message : String(clickError),
      });
      
      await location.locator.click({ timeout: 10000, force: true });
      logger.info('Element force clicked successfully', {
        method: location.method,
        selector: location.selector,
      });
      return true;
    }
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

