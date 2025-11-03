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
import { findGameByUrl, saveTestRun, getActiveManifest, createGame, createManifest } from '../storage/database.js';
import { QAAgent } from '../agent/qa-agent.js';
import { outputResult, createErrorResult } from './output-formatter.js';
import { validateUrl } from '../utils/validation.js';
import { promptYesNo, promptText } from '../utils/prompt.js';
import { randomUUID } from 'crypto';

/**
 * Command options interface.
 */
export interface CommandOptions {
  /** Game URL (optional, can be positional argument) */
  url?: string;
  /** Manifest version to use (optional) */
  manifest?: string;
  /** Skip manifest usage flag */
  noManifest?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Execute QA test command.
 * 
 * Main command handler that runs QA tests on a game. Performs the following:
 * 1. Validates game URL
 * 2. Looks up game in database
 * 3. Retrieves active manifest (if available)
 * 4. Executes QA agent
 * 5. Saves results to database
 * 6. Outputs JSON to stdout
 * 
 * @param {string} gameUrlArg - Game URL from positional argument
 * @param {CommandOptions} options - Command options
 * @returns {Promise<void>}
 */
async function executeTestCommand(gameUrlArg: string, options: CommandOptions): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Get URL from argument or --url option
    const gameUrl = gameUrlArg || options.url;
    
    if (!gameUrl) {
      throw new ValidationError('Game URL is required');
    }
    
    // Validate URL format
    const validatedUrl = validateUrl(gameUrl);
    
    logger.info('Starting QA test', { gameUrl: validatedUrl, options });

    // Look up game in database
    let game = await findGameByUrl(validatedUrl);
    
    if (!game) {
      logger.info('Game not found in database', { gameUrl: validatedUrl });
      
      // Prompt user to create game entry
      const shouldCreate = await promptYesNo(
        `Game not found in database. Would you like to create an entry for "${validatedUrl}"?`
      );
      
      if (!shouldCreate) {
        logger.info('User declined to create game entry');
        const errorResult = createErrorResult(
          'Game not found in database. Please create the game first.',
          { game_url: validatedUrl }
        );
        
        outputResult(errorResult);
        process.exit(1);
      }
      
      // Extract game name from URL
      let gameName = '';
      try {
        const url = new URL(validatedUrl);
        // Try to get a meaningful name from the path
        const pathParts = url.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          // Use last path segment, capitalize first letter
          const lastPart = pathParts[pathParts.length - 1];
          gameName = lastPart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        } else {
          // Fallback to domain name
          gameName = url.hostname
            .split('.')[0]
            .charAt(0).toUpperCase() + url.hostname.split('.')[0].slice(1);
        }
      } catch {
        // If URL parsing fails, use a generic name
        gameName = 'New Game';
      }
      
      // Prompt for game name (with default)
      gameName = await promptText('Enter game name:', gameName);
      
      if (!gameName.trim()) {
        logger.error('Game name is required');
        const errorResult = createErrorResult(
          'Game name is required to create game entry.',
          { game_url: validatedUrl }
        );
        
        outputResult(errorResult);
        process.exit(1);
      }
      
      // Create game entry
      try {
        logger.info('Creating game entry', { gameUrl: validatedUrl, gameName });
        game = await createGame({
          game_url: validatedUrl,
          name: gameName.trim(),
          game_type: null, // User can update later via Web UI
          description: null,
        });
        
        logger.info('Game created successfully', { gameId: game.id, gameName: game.name });
        
        // Create a basic manifest for the game
        // MVP: Create minimal manifest so tests can run
        try {
          const basicManifest = {
            version: '1.0' as const,
            gameType: 'other' as const,
            controls: {
              primary: [],
            },
          };
          
          await createManifest({
            game_id: game.id,
            version_name: 'v1.0',
            manifest_data: basicManifest,
            is_active: true,
            created_by: 'cli',
            notes: 'Auto-generated basic manifest. Update via Web UI with full game details.',
          });
          
          logger.info('Basic manifest created for game', { gameId: game.id });
        } catch (manifestError) {
          // Log but don't fail - test can still run without manifest
          const message = manifestError instanceof Error ? manifestError.message : String(manifestError);
          logger.warn('Failed to create basic manifest', { gameId: game.id, error: message });
        }
        
      } catch (createError) {
        const message = createError instanceof Error ? createError.message : String(createError);
        logger.error('Failed to create game entry', { gameUrl: validatedUrl, error: message });
        
        const errorResult = createErrorResult(
          `Failed to create game entry: ${message}`,
          { game_url: validatedUrl }
        );
        
        outputResult(errorResult);
        process.exit(1);
      }
    }

    logger.info('Game found', { gameId: game.id, gameName: game.name });
    
    // Get active manifest if available (MVP: retrieve but don't use)
    let manifestId: string | null = null;
    if (!options.noManifest) {
      const manifest = await getActiveManifest(game.id);
      if (manifest) {
        manifestId = manifest.id;
        logger.info('Active manifest found', {
          manifestId: manifest.id,
          version: manifest.version_name,
        });
      } else {
        logger.info('No active manifest for game', { gameId: game.id });
      }
    }
    
    // Generate unique test ID
    const testId = randomUUID();
    
    // Execute QA agent
    logger.info('Executing QA agent', { testId, gameId: game.id });
    const agent = new QAAgent();
    const agentResult = await agent.run(validatedUrl, testId, game.name);
    
    // Save results to database
    try {
      await saveTestRun({
        game_id: game.id,
        manifest_id: manifestId,
        status: agentResult.result.status,
        playability_score: agentResult.result.playability_score,
        issues: JSON.stringify(agentResult.result.issues),
        screenshots: agentResult.result.screenshots,
        console_logs: agentResult.result.console_logs,
        execution_method: 'cli',
        duration_ms: agentResult.duration_ms,
        metadata: JSON.stringify({
          test_id: testId,
          browser: 'browserbase',
          manifest_used: manifestId !== null,
        }),
      });
      
      logger.info('Test results saved to database', { testId, gameId: game.id });
    } catch (saveError) {
      // Log error but don't fail the test
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      logger.error('Failed to save test results to database', {
        testId,
        error: message,
      });
    }
    
    // Output JSON result to stdout
    outputResult(agentResult.result);
    
    // Exit with appropriate code
    const exitCode = agentResult.success ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    
    if (error instanceof Error) {
      logger.error('Test command failed', { error: error.message, duration_ms });
      
      const errorResult = createErrorResult(error.message, { duration_ms });
      outputResult(errorResult);
    } else {
      logger.error('Test command failed with unknown error', { error, duration_ms });
      
      const errorResult = createErrorResult(String(error), { duration_ms });
      outputResult(errorResult);
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
    .argument('[game-url]', 'URL of the game to test (optional if using --url)')
    .option('-u, --url <url>', 'Game URL to test (alternative to positional argument)')
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

