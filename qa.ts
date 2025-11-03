#!/usr/bin/env bun

/**
 * File: qa.ts
 * 
 * Main CLI entry point for the DreamUp QA Pipeline.
 * 
 * This is the primary command-line interface for running QA tests on browser games.
 * It initializes the application, loads configuration, and delegates to the CLI module.
 * 
 * Usage:
 *   bun run qa.ts <game-url> [options]
 *   bun run qa.ts --help
 * 
 * @module QA
 */

import { runCLI } from './src/cli/commands.js';
import { logger, LogLevel } from './src/utils/logger.js';
import { getConfig } from './src/utils/config.js';
import { initializeDatabase } from './src/storage/database.js';

/**
 * Initialize application.
 * 
 * Loads configuration, initializes database connection, and sets up logging.
 */
function initialize(): void {
  try {
    // Load and validate configuration
    const config = getConfig();
    
    // Configure logger based on environment
    const logLevel = process.env.DEBUG === 'true' ? LogLevel.DEBUG : LogLevel.INFO;
    logger.configure({ level: logLevel });
    
    // Initialize database connection
    initializeDatabase();
    
    logger.debug('Application initialized', {
      supabaseUrl: config.supabase.url,
      llmProvider: config.llm.provider,
    });
  } catch (error) {
    console.error('\n❌ Initialization failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    } else {
      console.error(`   ${String(error)}\n`);
    }
    console.error('Please check your environment configuration and try again.');
    console.error('See ENV_SETUP.md for required environment variables.\n');
    process.exit(1);
  }
}

/**
 * Main entry point.
 * 
 * Initializes the application and runs the CLI.
 */
async function main(): Promise<void> {
  // Initialize application
  initialize();
  
  // Run CLI
  await runCLI(process.argv);
}

// Execute main function
main().catch((error) => {
  logger.error('Unhandled error', { error: error.message });
  console.error('\n❌ An unexpected error occurred:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
});

