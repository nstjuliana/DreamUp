/**
 * File: src/browser/stagehand-client.ts
 * 
 * Stagehand client wrapper for natural language-based click actions.
 * 
 * This module provides a wrapper around Stagehand for executing click actions
 * using natural language descriptions. Stagehand uses the same Playwright page
 * instance as BrowserClient to ensure a single browser instance.
 * 
 * @module StagehandClient
 */

import { Stagehand } from '@browserbasehq/stagehand';
import type { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

/**
 * Stagehand client for natural language click actions.
 */
export class StagehandClient {
  private stagehand: Stagehand | null = null;
  private page: Page | null = null;
  private context: any = null; // Store context separately

  /**
   * Initialize Stagehand and create the browser instance.
   * 
   * Stagehand creates the browser instance, which is then shared with BrowserClient.
   * This ensures only one browser instance exists.
   * 
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   * 
   * @example
   * ```typescript
   * const client = new StagehandClient();
   * await client.initialize();
   * const page = client.getPage();
   * ```
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Stagehand client (creating browser)');
      
      const config = getConfig();
      
      // Initialize Stagehand - it will create the browser instance
      this.stagehand = new Stagehand({
        env: 'LOCAL', // Use local Playwright, not Browserbase
        verbose: 2, // Increase logging to see what's happening
        domSettleTimeout: 3000, // Wait for DOM to settle (in ms)
      });

      // Initialize Stagehand (this creates the browser)
      const initResult = await this.stagehand.init();
      logger.debug('Stagehand init() completed', { 
        result: initResult,
        hasPageProperty: 'page' in this.stagehand,
        hasContextProperty: 'context' in this.stagehand,
      });
      
      // Get the context from Stagehand
      // Stagehand v3 doesn't expose page directly - we get it from context
      this.context = this.stagehand.context;
      
      if (!this.context) {
        throw new Error('Stagehand did not create a context');
      }
      
      // Get the page from the context (Stagehand v3 doesn't have stagehand.page)
      const pages = this.context.pages();
      if (!pages || pages.length === 0) {
        throw new Error('Stagehand context has no pages');
      }
      
      this.page = pages[0];
      
      logger.debug('Checking Stagehand page from context', {
        pageType: typeof this.page,
        pageValue: this.page ? 'exists' : 'null/undefined',
        contextType: typeof this.context,
        pagesCount: pages.length,
      });
      
      logger.info('Stagehand client initialized successfully', {
        hasPage: !!this.page,
        hasContext: !!this.context,
        pageType: typeof this.page,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize Stagehand client', { error: message });
      throw new Error(`Failed to initialize Stagehand: ${message}`);
    }
  }

  /**
   * Click an element using natural language description.
   * 
   * Uses Stagehand's `act()` function to identify and click elements based on
   * natural language descriptions (e.g., "Start button", "enemy character").
   * 
   * @param {string} target - Natural language description of what to click
   * @returns {Promise<{success: boolean, error?: string}>} Result indicating success or failure
   * 
   * @example
   * ```typescript
   * const result = await client.clickElement('Start button');
   * if (!result.success) {
   *   logger.warn('Failed to click:', result.error);
   * }
   * ```
   */
  async clickElement(target: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stagehand) {
      const error = 'Stagehand client not initialized';
      logger.error(error);
      return { success: false, error };
    }

    try {
      logger.info('Executing Stagehand click action', { target });
      
      // Use Stagehand's act() function with natural language instruction
      const instruction = `click on the ${target}`;
      await this.stagehand.act(instruction);
      
      logger.info('Stagehand click action executed successfully', { target });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Stagehand click action failed', {
        target,
        error: message,
      });
      // Return failure but don't throw - caller will skip the action
      return { success: false, error: message };
    }
  }

  /**
   * Get the Playwright page instance.
   * 
   * Returns the page instance that Stagehand is using, which is the same
   * instance provided by BrowserClient.
   * 
   * @returns {Page} Playwright page instance
   * @throws {Error} If Stagehand is not initialized
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Stagehand client not initialized - page not available');
    }
    return this.page;
  }

  /**
   * Get the Playwright browser context.
   * 
   * Returns the context instance from Stagehand.
   * 
   * @returns {any} Playwright context instance
   * @throws {Error} If Stagehand is not initialized
   */
  getContext(): any {
    if (!this.context) {
      throw new Error('Stagehand client not initialized - context not available');
    }
    return this.context;
  }

  /**
   * Check if Stagehand client is initialized.
   * 
   * @returns {boolean} True if initialized
   */
  isInitialized(): boolean {
    return this.stagehand !== null && this.page !== null;
  }

  /**
   * Cleanup Stagehand resources.
   * 
   * Should be called when done with the client. Note that the browser/page
   * cleanup is handled by BrowserClient, so we just reset our references here.
   * 
   * @returns {Promise<void>}
   */
  async cleanup(): Promise<void> {
    try {
      if (this.stagehand) {
        logger.info('Cleaning up Stagehand client');
        // Stagehand cleanup if needed (check Stagehand docs for cleanup method)
        // For now, just reset references
        this.stagehand = null;
        this.page = null;
        logger.info('Stagehand client cleaned up');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error during Stagehand cleanup', { error: message });
      // Don't throw - cleanup errors shouldn't fail the test
    }
  }
}

