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
import { findGameByUrl, getManifestsForGame, getManifestByVersion, getActiveManifest, createGame, createManifest } from '../storage/database.js';
import { QAAgent } from '../agent/qa-agent.js';
import { outputResult, createErrorResult } from './output-formatter.js';
import { validateUrl } from '../utils/validation.js';
import { promptYesNo, promptText, promptSelect } from '../utils/prompt.js';
import { parseManifest, readManifestFromFile, isValidLocalFile } from '../utils/manifest-parser.js';
import { randomUUID } from 'crypto';

/**
 * Command options interface.
 */
export interface CommandOptions {
  /** Game URL (optional, can be positional argument) */
  url?: string;
  /** Manifest version to use (optional) */
  manifest?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Execute QA test command.
 * 
 * Main command handler that runs QA tests on a game. Performs the following:
 * 1. Validates game URL
 * 2. Looks up game in database
 * 3. Requires manifest selection:
 *    - If --manifest option provided, uses that version
 *    - If multiple manifests exist, prompts user to select
 *    - If single manifest exists, uses it automatically
 *    - If no manifest exists, errors out (manifest is required)
 * 4. Executes QA agent
 * 5. Outputs JSON to stdout
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

    // Manifest selection logic (MANIFEST IS REQUIRED)
    let manifestId: string | null = null;
    let parsedManifest = null;
    let selectedManifest: import('../storage/types.js').GameManifest | null = null;

    // Step 1: Check if manifest was provided as option
    if (options.manifest) {
      // Step 1a: Check if it's a valid local file first
      if (isValidLocalFile(options.manifest)) {
        logger.info('Manifest file path provided via option', {
          filePath: options.manifest,
        });

        try {
          parsedManifest = readManifestFromFile(options.manifest);
          logger.info('Manifest loaded from file successfully', {
            filePath: options.manifest,
            gameType: parsedManifest.gameType,
          });
          // When using local file, manifestId stays null (not linked to DB manifest)
        } catch (fileError) {
          const message = fileError instanceof Error ? fileError.message : String(fileError);
          logger.error('Failed to read manifest file', {
            filePath: options.manifest,
            error: message,
          });
          const errorResult = createErrorResult(
            `Failed to read manifest file "${options.manifest}": ${message}`,
            { game_url: validatedUrl, file_path: options.manifest }
          );
          outputResult(errorResult);
          process.exit(1);
        }
      } else {
        // Step 1b: Treat as DB version name
        logger.info('Manifest version provided via option (treating as DB version)', {
          gameId: game.id,
          version: options.manifest,
        });

        selectedManifest = await getManifestByVersion(game.id, options.manifest);
        
        if (!selectedManifest) {
          // Version not found - get all manifests and prompt user
          const allManifests = await getManifestsForGame(game.id);
          
          if (allManifests.length === 0) {
            // No manifests exist - error out
            const errorResult = createErrorResult(
              'No manifest found for this game. A manifest is required to run tests. Please create a manifest via Web UI or provide a local manifest file.',
              { game_url: validatedUrl, game_id: game.id }
            );
            outputResult(errorResult);
            process.exit(1);
          } else {
            // Show all available manifests and let user pick
            logger.info('Manifest version not found, prompting user to select from available manifests', {
              requestedVersion: options.manifest,
              availableCount: allManifests.length,
            });

            // Find active manifest index for default
            const activeIndex = allManifests.findIndex(m => m.is_active);
            const defaultIndex = activeIndex >= 0 ? activeIndex : 0;

            // Build options list
            const manifestOptions = allManifests.map((manifest) => ({
              label: `${manifest.version_name}${manifest.is_active ? ' (active)' : ''}${manifest.notes ? ` - ${manifest.notes}` : ''}`,
              value: manifest,
            }));

            try {
              const selectedIndex = await promptSelect(
                `Manifest version "${options.manifest}" not found. Select a manifest version:`,
                manifestOptions,
                defaultIndex
              );

              selectedManifest = allManifests[selectedIndex];
              manifestId = selectedManifest.id;
              
              logger.info('User selected manifest', {
                manifestId: selectedManifest.id,
                version: selectedManifest.version_name,
              });

              try {
                parsedManifest = parseManifest(selectedManifest.manifest_data);
                logger.info('Manifest parsed successfully', {
                  manifestId: selectedManifest.id,
                  version: selectedManifest.version_name,
                  gameType: parsedManifest.gameType,
                });
              } catch (parseError) {
                const message = parseError instanceof Error ? parseError.message : String(parseError);
                logger.error('Failed to parse manifest', {
                  manifestId: selectedManifest.id,
                  error: message,
                });
                const errorResult = createErrorResult(
                  `Failed to parse selected manifest: ${message}`,
                  { game_url: validatedUrl, manifest_version: selectedManifest.version_name }
                );
                outputResult(errorResult);
                process.exit(1);
              }
            } catch (promptError) {
              const message = promptError instanceof Error ? promptError.message : String(promptError);
              logger.error('Failed to prompt for manifest selection', {
                error: message,
              });
              const errorResult = createErrorResult(
                `Failed to select manifest: ${message}`,
                { game_url: validatedUrl }
              );
              outputResult(errorResult);
              process.exit(1);
            }
          }
        } else {
          // Found manifest in DB
          manifestId = selectedManifest.id;
          try {
            parsedManifest = parseManifest(selectedManifest.manifest_data);
            logger.info('Manifest parsed successfully', {
              manifestId: selectedManifest.id,
              version: selectedManifest.version_name,
              gameType: parsedManifest.gameType,
            });
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError);
            logger.error('Failed to parse manifest', {
              manifestId: selectedManifest.id,
              error: message,
            });
            const errorResult = createErrorResult(
              `Failed to parse manifest "${options.manifest}": ${message}`,
              { game_url: validatedUrl, manifest_version: options.manifest }
            );
            outputResult(errorResult);
            process.exit(1);
          }
        }
      }
    } else {
      // Step 2: No manifest provided - try to retrieve latest from Supabase
      logger.info('No manifest provided, attempting to retrieve from Supabase', {
        gameId: game.id,
      });
      
      // First, try to get active manifest
      let selectedManifest = await getActiveManifest(game.id);
      
      if (!selectedManifest) {
        // No active manifest - get all manifests and use the latest (first one, ordered by created_at desc)
        const allManifests = await getManifestsForGame(game.id);
        
        if (allManifests.length === 0) {
          // No manifests found - inform user and exit
          logger.error('No manifest found for this game', {
            gameId: game.id,
            gameUrl: validatedUrl,
          });
          const errorResult = createErrorResult(
            'No manifest found for this game. A manifest is required to run tests. Please create a manifest via Web UI or use --manifest flag to specify a manifest file or version.',
            { game_url: validatedUrl, game_id: game.id }
          );
          outputResult(errorResult);
          process.exit(1);
        }
        
        // Use the latest manifest (first in list, ordered by created_at desc)
        selectedManifest = allManifests[0];
        logger.info('Using latest manifest (no active manifest found)', {
          manifestId: selectedManifest.id,
          version: selectedManifest.version_name,
          totalManifests: allManifests.length,
        });
      } else {
        logger.info('Using active manifest', {
          manifestId: selectedManifest.id,
          version: selectedManifest.version_name,
        });
      }
      
      manifestId = selectedManifest.id;
      
      try {
        parsedManifest = parseManifest(selectedManifest.manifest_data);
        logger.info('Manifest parsed successfully', {
          manifestId: selectedManifest.id,
          version: selectedManifest.version_name,
          gameType: parsedManifest.gameType,
        });
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error('Failed to parse manifest', {
          manifestId: selectedManifest.id,
          version: selectedManifest.version_name,
          error: message,
        });
        const errorResult = createErrorResult(
          `Failed to parse manifest "${selectedManifest.version_name}" (ID: ${selectedManifest.id}): ${message}. Please fix the manifest via Web UI or use --manifest flag to specify a different manifest.`,
          { 
            game_url: validatedUrl, 
            manifest_id: selectedManifest.id,
            manifest_version: selectedManifest.version_name,
            error: message
          }
        );
        outputResult(errorResult);
        process.exit(1);
      }
    }
    
    // At this point, we must have a manifest
    // Note: manifestId can be null for local file manifests, so we only check parsedManifest
    if (!parsedManifest) {
      const errorResult = createErrorResult(
        'Failed to obtain valid manifest. Cannot proceed with test.',
        { game_url: validatedUrl }
      );
      outputResult(errorResult);
      process.exit(1);
    }
    
    // Generate unique test ID
    const testId = randomUUID();
    
    // Execute QA agent
    logger.info('Executing QA agent', { testId, gameId: game.id, hasManifest: !!parsedManifest });
    const agent = new QAAgent();
    const agentResult = await agent.run({
      gameUrl: validatedUrl,
      testId,
      gameId: game.id,
      manifestId,
      manifest: parsedManifest,
      gameName: game.name,
      gameType: game.game_type,
    });
    
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
    .option('-m, --manifest <path-or-version>', 'Use manifest from local file path or DB version name (e.g., "manifest.json" or "v1.0")')
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

