/**
 * File: src/utils/manifest-parser.ts
 * 
 * Manifest parsing and validation utilities.
 * 
 * This module handles parsing and validation of game manifest data from the database
 * or local JSON files. It converts JSONB manifest_data or file contents into typed
 * ManifestData structures and validates that the manifest matches the expected schema.
 * 
 * @module ManifestParser
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import type { ManifestData, GameState } from '../storage/types.js';
import type { Json } from '../storage/types.js';
import { ValidationError } from './errors.js';
import { logger } from './logger.js';

/**
 * Read manifest from local file.
 * 
 * Reads a manifest JSON file from the root directory and parses it.
 * 
 * @param {string} filePath - Path to manifest file (relative to root or absolute)
 * @returns {ManifestData} Parsed and validated manifest data
 * @throws {ValidationError} If file doesn't exist, can't be read, or is invalid
 * 
 * @example
 * ```typescript
 * const manifest = readManifestFromFile('game-manifest.json');
 * ```
 */
export function readManifestFromFile(filePath: string): ManifestData {
  try {
    // Check if file exists
    let fullPath: string;
    if (existsSync(filePath)) {
      // Use provided path directly if it exists
      fullPath = filePath;
    } else {
      // Try relative to root directory
      const rootPath = join(process.cwd(), filePath);
      if (existsSync(rootPath)) {
        fullPath = rootPath;
      } else {
        throw new ValidationError(`Manifest file not found: ${filePath}`, {
          filePath,
          rootPath,
        });
      }
    }

    logger.info('Reading manifest from file', { fullPath });

    // Read file
    const fileContent = readFileSync(fullPath, 'utf-8');
    
    // Parse JSON
    let manifestData: Json;
    try {
      manifestData = JSON.parse(fileContent);
    } catch (parseError) {
      throw new ValidationError(`Invalid JSON in manifest file: ${filePath}`, {
        filePath: fullPath,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

    // Parse and validate manifest structure
    return parseManifest(manifestData);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to read manifest file: ${filePath}`, {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if a path is a valid local file.
 * 
 * Checks if the provided path exists as a file in the filesystem.
 * Checks both absolute paths and paths relative to the project root.
 * 
 * @param {string} path - Path to check
 * @returns {boolean} True if path exists as a file
 * 
 * @example
 * ```typescript
 * if (isValidLocalFile('manifest.json')) {
 *   const manifest = readManifestFromFile('manifest.json');
 * }
 * ```
 */
export function isValidLocalFile(path: string): boolean {
  try {
    // Check absolute path first
    if (existsSync(path)) {
      const stats = statSync(path);
      return stats.isFile();
    }

    // Check relative to root directory
    const rootPath = join(process.cwd(), path);
    if (existsSync(rootPath)) {
      const stats = statSync(rootPath);
      return stats.isFile();
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Parse manifest data from database JSONB field.
 * 
 * Converts the JSONB manifest_data field from the database into a typed
 * ManifestData object. Validates the structure and provides helpful error
 * messages if the manifest is invalid.
 * 
 * @param {Json} manifestData - Raw manifest data from database (JSONB)
 * @returns {ManifestData} Parsed and validated manifest data
 * @throws {ValidationError} If manifest is invalid or missing required fields
 * 
 * @example
 * ```typescript
 * const manifest = parseManifest(gameManifest.manifest_data);
 * console.log(`Game type: ${manifest.gameType}`);
 * ```
 */
export function parseManifest(manifestData: Json): ManifestData {
  if (!manifestData || typeof manifestData !== 'object') {
    throw new ValidationError('Manifest data must be an object', {
      manifestData,
    });
  }

  const manifest = manifestData as Record<string, unknown>;

  // Validate version
  if (manifest.version !== '1.0') {
    throw new ValidationError(`Unsupported manifest version: ${manifest.version}`, {
      version: manifest.version,
      expectedVersion: '1.0',
    });
  }

  // Validate gameType
  const validGameTypes = ['puzzle', 'platformer', 'idle', 'shooter', 'rpg', 'other'];
  if (!manifest.gameType || typeof manifest.gameType !== 'string') {
    throw new ValidationError('Manifest must include gameType', {
      manifest,
    });
  }

  if (!validGameTypes.includes(manifest.gameType)) {
    throw new ValidationError(`Invalid gameType: ${manifest.gameType}`, {
      gameType: manifest.gameType,
      validTypes: validGameTypes,
    });
  }

  // Validate controls (required)
  if (!manifest.controls || typeof manifest.controls !== 'object') {
    throw new ValidationError('Manifest must include controls object', {
      manifest,
    });
  }

  const controls = manifest.controls as Record<string, unknown>;
  if (!Array.isArray(controls.primary) || controls.primary.length === 0) {
    throw new ValidationError('Manifest controls.primary must be a non-empty array', {
      controls,
    });
  }

  // Validate primary controls are strings
  if (!controls.primary.every((key: unknown) => typeof key === 'string')) {
    throw new ValidationError('All controls.primary keys must be strings', {
      controls,
    });
  }



  // Validate gameStates if present
  let gameStates: GameState[] | undefined;
  if (manifest.gameStates) {
    if (!Array.isArray(manifest.gameStates)) {
      throw new ValidationError('Manifest gameStates must be an array', {
        gameStates: manifest.gameStates,
      });
    }

    gameStates = manifest.gameStates.map((state: unknown) => {
      if (typeof state !== 'object' || state === null) {
        throw new ValidationError('Each gameState must be an object', {
          state,
        });
      }

      const s = state as Record<string, unknown>;
      if (!s.name || typeof s.name !== 'string') {
        throw new ValidationError('Each gameState must have a name string', {
          state: s,
        });
      }

      return {
        name: s.name as string,
        description: (s.description as string) || '',
        expectedDuration: s.expectedDuration as number | undefined,
        indicators: s.indicators as GameState['indicators'] | undefined,
      };
    });
  }

  // Build validated manifest
  const parsed: ManifestData = {
    version: '1.0',
    gameType: manifest.gameType as ManifestData['gameType'],
    controls: {
      primary: controls.primary as string[],
      secondary: Array.isArray(controls.secondary)
        ? (controls.secondary as string[]).filter((k: unknown) => typeof k === 'string')
        : undefined,
      mouse: controls.mouse === true,
      mouseActions: Array.isArray(controls.mouseActions)
        ? (controls.mouseActions as string[]).filter((a: unknown) =>
            typeof a === 'string' && ['click', 'drag', 'scroll'].includes(a)
          )
        : undefined,
    },
    gameStates,
    loadingDuration: typeof manifest.loadingDuration === 'number' ? manifest.loadingDuration : undefined,
    gameplayDuration: typeof manifest.gameplayDuration === 'number' ? manifest.gameplayDuration : undefined,
    gameplayGoal: typeof manifest.gameplayGoal === 'string' ? manifest.gameplayGoal : undefined,
    aiDecisionInterval: typeof manifest.aiDecisionInterval === 'number' ? manifest.aiDecisionInterval : undefined,
    notes: typeof manifest.notes === 'string' ? manifest.notes : undefined,
  };

  logger.debug('Manifest parsed successfully', {
    gameType: parsed.gameType,
    gameStateCount: parsed.gameStates?.length || 0,
  });

  return parsed;
}

/**
 * Validate manifest controls for a specific game type.
 * 
 * Performs additional validation based on game type to ensure controls
 * are appropriate for the game genre.
 * 
 * @param {ManifestData} manifest - Parsed manifest data
 * @returns {boolean} True if controls are valid for game type
 */
export function validateControlsForGameType(manifest: ManifestData): boolean {
  const { gameType, controls } = manifest;

  // Basic validation passed in parseManifest, this is just type-specific checks
  switch (gameType) {
    case 'platformer':
      // Platformers typically need arrow keys or WASD
      const hasMovement = controls.primary.some((key) =>
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key)
      );
      if (!hasMovement && !controls.mouse) {
        logger.warn('Platformer game may need movement controls (arrow keys or WASD)', {
          controls: controls.primary,
        });
      }
      break;

    case 'puzzle':
      // Puzzles often use mouse clicks
      if (!controls.mouse && controls.primary.length === 0) {
        logger.warn('Puzzle game may need mouse clicks', {
          controls,
        });
      }
      break;

    // Other game types don't have strict requirements
    default:
      break;
  }

  return true;
}

/**
 * Get gameplay duration from manifest or return default.
 * 
 * Returns the gameplay duration specified in the manifest, or a default
 * duration (30-60 seconds) if not specified.
 * 
 * @param {ManifestData | null} manifest - Parsed manifest data or null
 * @param {number} defaultDurationMs - Default duration in milliseconds
 * @returns {number} Gameplay duration in milliseconds
 */
export function getGameplayDuration(manifest: ManifestData | null, defaultDurationMs: number = 45000): number {
  if (manifest?.gameplayDuration && manifest.gameplayDuration > 0) {
    return manifest.gameplayDuration;
  }
  return defaultDurationMs;
}

/**
 * Get gameplay goal from manifest or return default.
 * 
 * Returns the custom gameplay goal specified in the manifest for AI-powered
 * gameplay simulation, or a default goal if not specified.
 * 
 * @param {ManifestData | null} manifest - Parsed manifest data or null
 * @returns {string} Gameplay goal for AI agent
 * 
 * @example
 * ```typescript
 * const goal = getGameplayGoal(manifest);
 * console.log(`AI goal: ${goal}`);
 * ```
 */
export function getGameplayGoal(manifest: ManifestData | null): string {
  if (manifest?.gameplayGoal && manifest.gameplayGoal.trim().length > 0) {
    return manifest.gameplayGoal;
  }
  return 'Keep playing as long as possible without dying or losing';
}

/**
 * Get AI decision interval from manifest or return default.
 * 
 * Returns the AI decision interval (milliseconds between AI decisions during
 * gameplay) specified in the manifest, or the default interval of 2000ms.
 * 
 * @param {ManifestData | null} manifest - Parsed manifest data or null
 * @returns {number} AI decision interval in milliseconds
 * 
 * @example
 * ```typescript
 * const interval = getAiDecisionInterval(manifest);
 * console.log(`AI will make decisions every ${interval}ms`);
 * ```
 */
export function getAiDecisionInterval(manifest: ManifestData | null): number {
  if (manifest?.aiDecisionInterval && manifest.aiDecisionInterval > 0) {
    return manifest.aiDecisionInterval;
  }
  return 2000; // Default: 2 seconds
}

