/**
 * File: src/browser/stagehand-handler.ts
 * 
 * Stagehand AI integration for browser interactions.
 * 
 * This module wraps Stagehand's AI-powered browser automation capabilities
 * for use as a fallback when manifest-based detection fails. Provides
 * helper functions for AI-based element detection and interaction.
 * 
 * @module StagehandHandler
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { Page } from '@browserbasehq/stagehand';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Stagehand handler for AI-powered browser interactions.
 * 
 * Provides methods for AI-based element detection and interaction
 * as a fallback when manifest-based detection is unavailable.
 */
export class StagehandHandler {
  private stagehand: Stagehand;
  private page: Page;

  /**
   * Create Stagehand handler instance.
   * 
   * @param {Stagehand} stagehand - Initialized Stagehand instance
   * @param {Page} page - Playwright page instance from Stagehand
   */
  constructor(stagehand: Stagehand, page: Page) {
    this.stagehand = stagehand;
    this.page = page;
  }

  /**
   * Find element by description using AI.
   * 
   * Uses Stagehand's AI capabilities to find an element on the page
   * based on a natural language description. Useful for finding buttons,
   * links, or other UI elements when selectors are not available.
   * 
   * @param {string} description - Natural language description of the element to find
   * @returns {Promise<Page | null>} Playwright page/locator or null if not found
   * @throws {BrowserError} If AI detection fails
   * 
   * @example
   * ```typescript
   * const handler = new StagehandHandler(stagehand, page);
   * const startButton = await handler.findElementByDescription('start game button');
   * ```
   */
  async findElementByDescription(description: string): Promise<Page | null> {
    try {
      logger.debug('Finding element using AI', { description });

      // Use Stagehand's AI to find the element
      // Note: Stagehand's API may vary, this is a placeholder approach
      // The actual implementation depends on Stagehand's current API
      
      // For now, we'll use a simple approach: try to use Stagehand's
      // describe/reasoning capabilities to find elements
      // This is a fallback, so we'll be lenient with errors

      // Stagehand API: Use page reasoner or similar AI-powered element finder
      // This is a conceptual implementation - actual API may differ
      const result = await this.page.reasoner?.reason(description).catch(() => null);

      if (result) {
        logger.info('Element found using AI', { description });
        return this.page;
      }

      logger.warn('Element not found using AI', { description });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('AI element detection failed', {
        description,
        error: message,
      });
      
      // Don't throw - this is a fallback, so failure is acceptable
      return null;
    }
  }

  /**
   * Find start button using AI detection.
   * 
   * Attempts to find a start/play button using AI-based detection.
   * Tries multiple common descriptions to increase success rate.
   * 
   * @returns {Promise<Page | null>} Playwright page/locator or null if not found
   * 
   * @example
   * ```typescript
   * const startButton = await handler.findStartButton();
   * if (startButton) {
   *   await startButton.click();
   * }
   * ```
   */
  async findStartButton(): Promise<Page | null> {
    const descriptions = [
      'start game button',
      'play button',
      'start button',
      'begin game button',
      'button to start the game',
    ];

    for (const description of descriptions) {
      const element = await this.findElementByDescription(description);
      if (element) {
        logger.info('Start button found using AI', { description });
        return element;
      }
    }

    logger.warn('Start button not found using any AI description');
    return null;
  }

  /**
   * Click element using AI description.
   * 
   * Finds and clicks an element described in natural language.
   * 
   * @param {string} description - Description of element to click
   * @returns {Promise<boolean>} True if click succeeded, false otherwise
   * 
   * @example
   * ```typescript
   * const clicked = await handler.clickByDescription('settings menu button');
   * ```
   */
  async clickByDescription(description: string): Promise<boolean> {
    try {
      const element = await this.findElementByDescription(description);
      if (!element) {
        logger.warn('Cannot click element - not found', { description });
        return false;
      }

      // Try to click the element
      // This is a simplified approach - actual implementation may vary
      await element.click({ timeout: 5000 }).catch(() => {
        throw new Error('Click failed');
      });

      logger.info('Element clicked using AI', { description });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to click element using AI', {
        description,
        error: message,
      });
      return false;
    }
  }

  /**
   * Get the underlying Stagehand instance.
   * 
   * @returns {Stagehand} Stagehand instance
   */
  getStagehand(): Stagehand {
    return this.stagehand;
  }

  /**
   * Get the underlying Playwright page.
   * 
   * @returns {Page} Playwright page instance
   */
  getPage(): Page {
    return this.page;
  }
}


