/**
 * File: src/cli/commands.ts
 * 
 * CLI command definitions for the DreamUp QA Pipeline.
 * 
 * This module defines the CLI commands using Commander.js, including argument parsing,
 * validation, and command execution logic.
 * 
 * @module Commands
 */

import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import { findGameByUrl } from '../storage/database.js';

/**
 * Command options interface.
 */
export interface CommandOptions {
  /** Manifest version to use (optional) */
  manifest?: string;
  /** Skip manifest usage flag */
  noManifest?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Validate game URL format.
 * 
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 * @throws {ValidationError} If URL is invalid
 */
function validateGameUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    throw new ValidationError(`Invalid game URL: ${url}`, { url });
  }
}

/**
 * Execute QA test command.
 * 
 * Main command handler that runs QA tests on a game.
 * 
 * @param {string} gameUrl - Game URL to test
 * @param {CommandOptions} options - Command options
 * @returns {Promise<void>}
 */
async function executeTestCommand(gameUrl: string, options: CommandOptions): Promise<void> {
  try {
    // Validate URL
    validateGameUrl(gameUrl);
    
    logger.info('Starting QA test', { gameUrl, options });

    // Look up game in database
    const game = await findGameByUrl(gameUrl);
    
    if (!game) {
      logger.error('Game not found in database', { gameUrl });
      console.error(`\nError: Game not found in database.`);
      console.error(`Please create the game first using the Web UI or by adding it to the database.`);
      console.error(`Game URL: ${gameUrl}\n`);
      process.exit(1);
    }

    logger.info('Game found', { gameId: game.id, gameName: game.name });
    
    // Placeholder: Actual test execution will be implemented in MVP phase
    console.log('\n=== QA Test (Setup Phase - Placeholder) ===');
    console.log(`Game: ${game.name}`);
    console.log(`URL: ${gameUrl}`);
    console.log(`Type: ${game.game_type || 'unknown'}`);
    console.log(`Options:`, options);
    console.log('\nNote: Full test execution will be implemented in MVP phase.');
    console.log('===\n');
    
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Test command failed', { error: error.message, gameUrl });
      console.error(`\nError: ${error.message}\n`);
    }
    process.exit(1);
  }
}

/**
 * Create and configure CLI program.
 * 
 * Sets up the Commander.js program with all commands and options.
 * 
 * @returns {Command} Configured Commander program
 * 
 * @example
 * ```typescript
 * const program = createProgram();
 * await program.parseAsync(process.argv);
 * ```
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('dreamup-qa')
    .description('AI-powered browser game QA testing pipeline')
    .version('1.0.0');

  // Main test command
  program
    .argument('<game-url>', 'URL of the game to test')
    .option('-m, --manifest <version>', 'Use specific manifest version')
    .option('--no-manifest', 'Skip manifest usage')
    .option('-d, --debug', 'Enable debug logging')
    .action(executeTestCommand);

  return program;
}

/**
 * Run CLI with provided arguments.
 * 
 * Parses command-line arguments and executes the appropriate command.
 * 
 * @param {string[]} argv - Command-line arguments (typically process.argv)
 * @returns {Promise<void>}
 * 
 * @example
 * ```typescript
 * await runCLI(process.argv);
 * ```
 */
export async function runCLI(argv: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

