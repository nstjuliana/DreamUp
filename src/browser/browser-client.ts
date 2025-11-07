/**
 * File: src/browser/browser-client.ts
 * 
 * Browser automation client using local Playwright.
 * 
 * This module provides a wrapper around Playwright for browser automation operations.
 * It handles session initialization, page navigation, waiting for page load, and cleanup.
 * Uses local Chromium browser with fixed viewport for consistent game testing.
 * 
 * @module BrowserClient
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Browser client for automation operations.
 */
export class BrowserClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  /**
   * Initialize browser session using page and context from Stagehand.
   * 
   * Uses the page and context instances created by Stagehand to ensure only one browser exists.
   * Sets up timeouts and configures the page for game testing.
   * 
   * @param {Page} page - Playwright page instance from Stagehand
   * @param {any} context - Playwright context instance from Stagehand
   * @returns {Promise<void>}
   * @throws {BrowserError} If session initialization fails
   * 
   * @example
   * ```typescript
   * const stagehand = new StagehandClient();
   * await stagehand.initialize();
   * const client = new BrowserClient();
   * await client.initializeSession(stagehand.getPage(), stagehand.getContext());
   * ```
   */
  async initializeSession(page?: Page, context?: any): Promise<void> {
    try {
      // If page and context provided (legacy Stagehand mode), use them
      // Otherwise, create new browser with standard Playwright
      if (page && context) {
        logger.info('Initializing browser session from provided page and context');
        this.page = page;
        this.context = context;
        
        if (this.context && typeof this.context.browser === 'function') {
          this.browser = this.context.browser();
        }
        
        // Set viewport if possible
        if (this.page && typeof this.page.setViewportSize === 'function') {
          await this.page.setViewportSize({ width: 1280, height: 720 });
        }
        
        // Set default timeout if possible
        if (this.page && typeof this.page.setDefaultTimeout === 'function') {
          this.page.setDefaultTimeout(60000);
        }
      } else {
        logger.info('Initializing new browser session with standard Playwright');
        
        // Determine headless mode: default to true unless debug mode is enabled
        // Debug mode is enabled via -d/--debug CLI flag or DEBUG=true environment variable
        const isDebugMode = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
        const headless = !isDebugMode;
        
        logger.info('Browser launch configuration', { headless, debugMode: isDebugMode });
        
        // Launch Chromium browser
        this.browser = await chromium.launch({
          headless: headless,
        });
        
        // Create new context
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        
        // Create new page
        this.page = await this.context.newPage();
        
        // Set default timeout
        this.page.setDefaultTimeout(60000);
      }
      
      logger.info('Browser session initialized', {
        hasPage: !!this.page,
        hasContext: !!this.context,
        hasBrowser: !!this.browser,
        viewport: '1280x720',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize browser session', { error: message });
      throw new BrowserError('Failed to initialize browser session', {
        error: message,
      });
    }
  }
  
  /**
   * Load game URL in browser.
   * 
   * Navigates to the specified game URL and waits for the page to be interactive.
   * Includes timeout handling and retry logic for network errors (up to 3 attempts
   * with exponential backoff).
   * 
   * @param {string} url - Game URL to load
   * @returns {Promise<void>}
   * @throws {BrowserError} If page load fails after all retries
   * 
   * @example
   * ```typescript
   * await client.loadGame('https://example.com/game');
   * ```
   */
  async loadGame(url: string): Promise<void> {
    if (!this.page) {
      throw new BrowserError('Browser session not initialized', {
        url,
      });
    }
    
    const MAX_RETRIES = 3;
    const RETRY_BACKOFF_BASE_MS = 1000; // 1 second
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info('Loading game URL', { url, attempt, maxRetries: MAX_RETRIES });
        
        // Navigate to URL with timeout
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000, // 60 seconds
        });
        
        logger.info('Game URL loaded successfully', { url, attempt });
        return; // Success - exit function
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message;
        
        if (attempt < MAX_RETRIES) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          logger.warn('Page load failed, retrying', {
            url,
            attempt,
            maxRetries: MAX_RETRIES,
            backoffMs,
            error: message,
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // All retries exhausted
          logger.error('Failed to load game URL after all retries', {
            url,
            attempts: MAX_RETRIES,
            error: message,
          });
        }
      }
    }
    
    // If we get here, all retries failed
    throw new BrowserError(`Failed to load game after ${MAX_RETRIES} attempts: ${url}`, {
      url,
      attempts: MAX_RETRIES,
      error: lastError?.message,
    });
  }
  
  /**
   * Wait for page to be fully loaded.
   * 
   * Intelligently waits for the page to be ready using a multi-stage approach:
   * 1. Wait for DOM content to be loaded (fast)
   * 2. Wait for a short network idle period (max 2s) or game container visibility
   * 3. Apply additional wait time if specified
   * 
   * This approach is faster and more reliable than waiting for full network idle,
   * which can take 30+ seconds for games with polling or WebSocket connections.
   * 
   * @param {number} [waitMs=3000] - Additional milliseconds to wait after load
   * @returns {Promise<void>}
   * @throws {BrowserError} If waiting fails
   * 
   * @example
   * ```typescript
   * await client.waitForLoad(3000);
   * ```
   */
  async waitForLoad(waitMs: number = 3000): Promise<void> {
    if (!this.page) {
      throw new BrowserError('Browser session not initialized');
    }
    
    try {
      logger.debug('Waiting for page to be ready', { waitMs });
      const startTime = Date.now();
      
      // Stage 1: Wait for DOM content to be loaded (fast, usually < 1s)
      await this.page.waitForLoadState('domcontentloaded', {
        timeout: 5000,
      }).catch(() => {
        logger.debug('DOM content load timeout - continuing anyway');
      });
      
      const domLoadTime = Date.now() - startTime;
      logger.debug('DOM content loaded', { elapsedMs: domLoadTime });
      
      // Stage 2: Try to detect game container/canvas visibility (fastest path)
      // This is more reliable than network idle for games
      const gameReady = await this.detectGameReady(2000).catch(() => false);
      
      if (gameReady) {
        const gameReadyTime = Date.now() - startTime;
        logger.debug('Game container detected as ready', { elapsedMs: gameReadyTime });
      } else {
        // Fallback: Wait for a short network idle period (max 2s)
        // This is much shorter than the default 30s timeout
        await this.page.waitForLoadState('networkidle', {
          timeout: 2000,
        }).catch(() => {
          logger.debug('Short network idle timeout - page likely ready anyway');
        });
      }
      
      const preWaitTime = Date.now() - startTime;
      logger.debug('Page load detection complete', { elapsedMs: preWaitTime });
      
      // Stage 3: Additional wait for game initialization (if specified)
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      
      const totalTime = Date.now() - startTime;
      logger.debug('Page is ready', { totalElapsedMs: totalTime });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Wait for load completed with errors', { error: message });
      // Don't throw - page might be usable even if not fully loaded
    }
  }
  
  /**
   * Detect if game container/canvas is ready and visible.
   * 
   * Checks for common game container selectors and canvas elements to
   * determine if the game has loaded, which is faster than waiting for
   * network idle.
   * 
   * @param {number} timeoutMs - Maximum time to wait for game container
   * @returns {Promise<boolean>} True if game container detected
   * @private
   */
  private async detectGameReady(timeoutMs: number): Promise<boolean> {
    if (!this.page) {
      return false;
    }
    
    const startTime = Date.now();
    const gameSelectors = [
      'section.scene', // Game engine scene container (prioritized)
      'section[class*="scene"]', // Variations of scene class
      'canvas',
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
    
    // Check each selector with a short timeout
    for (const selector of gameSelectors) {
      try {
        const locator = this.page.locator(selector).first();
        const count = await locator.count();
        
        if (count > 0) {
          // Check if element is visible and has reasonable size
          const box = await locator.boundingBox({ timeout: 1000 }).catch(() => null);
          if (box && box.width > 100 && box.height > 100) {
            // Wait for it to be visible
            await locator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
            const elapsed = Date.now() - startTime;
            logger.debug('Game container detected', { selector, elapsedMs: elapsed });
            return true;
          }
        }
      } catch {
        // Continue to next selector
        continue;
      }
      
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        break;
      }
    }
    
    return false;
  }
  
  /**
   * Get the current page instance.
   * 
   * Returns the Playwright page instance for advanced operations like
   * screenshot capture and console log collection.
   * 
   * @returns {Page} Playwright page instance
   * @throws {BrowserError} If no active page
   * 
   * @example
   * ```typescript
   * const page = client.getPage();
   * await page.screenshot({ path: 'screenshot.png' });
   * ```
   */
  getPage(): Page {
    if (!this.page) {
      throw new BrowserError('Browser session not initialized');
    }
    return this.page;
  }

  
  /**
   * Close browser session and cleanup resources.
   * 
   * Properly closes the browser session and releases all resources.
   * Should always be called when testing is complete, even if errors occurred.
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * try {
   *   await client.loadGame(url);
   * } finally {
   *   await client.closeSession();
   * }
   * ```
   */
  async closeSession(): Promise<void> {
    try {
      if (this.browser) {
        logger.info('Closing browser session');
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        logger.info('Browser session closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error closing browser session', { error: message });
      // Don't throw - cleanup should not fail the test
    }
  }
  
  /**
   * Check if session is active.
   * 
   * Returns true if the browser session is initialized and has an active page.
   * 
   * @returns {boolean} True if session is active
   */
  isActive(): boolean {
    return this.page !== null && this.browser !== null;
  }
}
