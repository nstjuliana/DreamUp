/**
 * File: src/browser/browser-client.ts
 * 
 * Browser automation client using Browserbase and Stagehand.
 * 
 * This module provides a wrapper around Stagehand for browser automation operations.
 * It handles session initialization, page navigation, waiting for page load, and cleanup.
 * Uses Browserbase for remote browser infrastructure.
 * 
 * @module BrowserClient
 */

import { Stagehand } from '@browserbasehq/stagehand';
import type { Page } from '@browserbasehq/stagehand';
import { getConfig } from '../utils/config.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { MAX_EXECUTION_TIME_MS } from '../utils/constants.js';

/**
 * Browser client for automation operations.
 */
export class BrowserClient {
  private stagehand: Stagehand | null = null;
  private page: Page | null = null;
  private sessionId: string | null = null;
  
  /**
   * Initialize browser session.
   * 
   * Creates a new Browserbase session using Stagehand and initializes the browser.
   * Sets up timeouts and configures the browser for game testing.
   * 
   * @returns {Promise<void>}
   * @throws {BrowserError} If session initialization fails
   * 
   * @example
   * ```typescript
   * const client = new BrowserClient();
   * await client.initializeSession();
   * ```
   */
  async initializeSession(): Promise<void> {
    const config = getConfig();
    
    try {
      logger.info('Initializing browser session');
      
      // Initialize Stagehand with Browserbase
      this.stagehand = new Stagehand({
        apiKey: config.browserbase.apiKey,
        projectId: config.browserbase.projectId,
        env: 'BROWSERBASE',
        enableCaching: false,
        verbose: process.env.DEBUG === 'true' ? 1 : 0,
      });
      
      // Initialize the browser
      await this.stagehand.init();
      
      // Get the page instance
      this.page = this.stagehand.page;
      
      // Try to extract session ID for live viewing
      // Stagehand may expose this through the browser context or internal properties
      try {
        // Method 1: Try to get from browser context
        // @ts-ignore - accessing internal property that may exist
        const browserContext = this.page.context();
        // @ts-ignore - Browserbase may attach session info
        let sessionInfo = browserContext?._browserbaseSessionId || browserContext?.sessionId;
        
        // Method 2: Try to get from Stagehand instance properties
        if (!sessionInfo) {
          // @ts-ignore - Stagehand may expose session ID
          sessionInfo = this.stagehand?.sessionId || this.stagehand?._sessionId || null;
        }
        
        // Method 3: Try to extract from browser context's browser instance
        if (!sessionInfo && browserContext) {
          // @ts-ignore - Browser instance may have session info
          const browser = browserContext.browser();
          if (browser) {
            // @ts-ignore
            sessionInfo = browser._sessionId || browser.sessionId || null;
          }
        }
        
        // Method 4: Try to get from page URL (Browserbase sessions sometimes expose it)
        if (!sessionInfo) {
          try {
            const pageUrl = this.page.url();
            // Browserbase session URLs might contain session ID
            const sessionMatch = pageUrl.match(/session[_-]?id[=:]([a-zA-Z0-9_-]+)/i);
            if (sessionMatch && sessionMatch[1]) {
              sessionInfo = sessionMatch[1];
            }
          } catch {
            // Ignore URL extraction errors
          }
        }
        
        if (sessionInfo) {
          this.sessionId = String(sessionInfo);
          logger.debug('Session ID extracted successfully', { sessionId: this.sessionId });
        } else {
          this.sessionId = null;
          logger.debug('Session ID not found - will need to use Browserbase dashboard');
        }
      } catch (error) {
        // Session ID extraction failed - not critical
        this.sessionId = null;
        logger.debug('Session ID extraction failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Set default timeout
      await this.page.setDefaultTimeout(60000); // 60 seconds for operations
      
      const sessionUrl = this.getSessionUrl();
      logger.info('Browser session initialized', {
        hasPage: !!this.page,
        sessionId: this.sessionId,
        liveViewUrl: sessionUrl || 'Not available',
      });
      
      if (sessionUrl) {
        logger.info('\n' + '='.repeat(60));
        logger.info('🌐 LIVE BROWSER VIEW AVAILABLE 🌐');
        logger.info('='.repeat(60));
        logger.info(`\nWatch the browser in real-time:\n${sessionUrl}\n`);
        logger.info('📋 Instructions:');
        logger.info('   1. Copy the URL above');
        logger.info('   2. Open it in your web browser');
        logger.info('   3. You\'ll see the browser session in real-time');
        logger.info('='.repeat(60) + '\n');
      } else {
        logger.info('\n' + '='.repeat(60));
        logger.info('💡 HOW TO VIEW LIVE BROWSER SESSION');
        logger.info('='.repeat(60));
        logger.info('\nSession ID auto-detection failed, but you can still view it:');
        logger.info('\n📋 Method 1: Browserbase Dashboard');
        logger.info('   1. Go to: https://www.browserbase.com/sessions');
        logger.info('   2. Log in to your Browserbase account');
        logger.info('   3. Find the most recent session (it should be running now)');
        logger.info('   4. Click on it to view live');
        logger.info('\n📋 Method 2: Check Browser Logs');
        logger.info('   The session ID may appear in verbose logs if DEBUG=true');
        logger.info('='.repeat(60) + '\n');
      }
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
   * Waits for the page to reach a stable state with network idle.
   * This ensures the game has finished loading before capturing evidence.
   * 
   * @param {number} [waitMs=5000] - Additional milliseconds to wait after load
   * @returns {Promise<void>}
   * @throws {BrowserError} If waiting fails
   * 
   * @example
   * ```typescript
   * await client.waitForLoad(3000);
   * ```
   */
  async waitForLoad(waitMs: number = 5000): Promise<void> {
    if (!this.page) {
      throw new BrowserError('Browser session not initialized');
    }
    
    try {
      logger.debug('Waiting for page to be ready', { waitMs });
      
      // Wait for network to be idle
      await this.page.waitForLoadState('networkidle', {
        timeout: 30000,
      }).catch(() => {
        // Ignore timeout - page might have ongoing animations/polling
        logger.debug('Network idle timeout - continuing anyway');
      });
      
      // Additional wait for game initialization
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      
      logger.debug('Page is ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Wait for load completed with errors', { error: message });
      // Don't throw - page might be usable even if not fully loaded
    }
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
   * Get the Stagehand instance.
   * 
   * Returns the Stagehand instance for AI-powered browser operations
   * like observe() and act().
   * 
   * @returns {Stagehand} Stagehand instance
   * @throws {BrowserError} If no active session
   * 
   * @example
   * ```typescript
   * const stagehand = client.getStagehand();
   * const buttons = await stagehand.page.observe("Find the start button");
   * ```
   */
  getStagehand(): Stagehand {
    if (!this.stagehand) {
      throw new BrowserError('Browser session not initialized');
    }
    return this.stagehand;
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
      if (this.stagehand) {
        logger.info('Closing browser session');
        await this.stagehand.close();
        this.stagehand = null;
        this.page = null;
        this.sessionId = null;
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
    return this.page !== null && this.stagehand !== null;
  }

  /**
   * Get the Browserbase session URL for live viewing.
   * 
   * Returns a URL that can be opened in a browser to view the session live.
   * Only available if session ID was successfully extracted.
   * 
   * @returns {string | null} Browserbase session URL or null if not available
   * 
   * @example
   * ```typescript
   * const url = client.getSessionUrl();
   * if (url) {
   *   console.log(`View session: ${url}`);
   * }
   * ```
   */
  getSessionUrl(): string | null {
    if (!this.sessionId) {
      return null;
    }
    return `https://www.browserbase.com/sessions/${this.sessionId}`;
  }

  /**
   * Get the Browserbase session ID.
   * 
   * @returns {string | null} Session ID or null if not available
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}
