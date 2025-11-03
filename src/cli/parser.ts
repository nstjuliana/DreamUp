/**
 * File: src/cli/parser.ts
 * 
 * CLI argument parsing utilities.
 * 
 * This module provides utilities for parsing and validating CLI arguments
 * before they are passed to command handlers.
 * 
 * @module Parser
 */

import { ValidationError } from '../utils/errors.js';

/**
 * Parsed CLI arguments interface.
 */
export interface ParsedArguments {
  gameUrl: string;
  manifestVersion?: string;
  skipManifest: boolean;
  debug: boolean;
}

/**
 * Parse game URL from command-line arguments.
 * 
 * Extracts and validates the game URL from CLI arguments.
 * 
 * @param {string} urlArg - URL argument to parse
 * @returns {string} Validated URL
 * @throws {ValidationError} If URL is invalid
 * 
 * @example
 * ```typescript
 * const url = parseGameUrl('https://example.com/game');
 * ```
 */
export function parseGameUrl(urlArg: string): string {
  if (!urlArg || urlArg.trim() === '') {
    throw new ValidationError('Game URL is required');
  }

  const trimmedUrl = urlArg.trim();
  
  // Validate URL format
  try {
    const url = new URL(trimmedUrl);
    
    // Ensure it's HTTP or HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ValidationError(
        `Invalid URL protocol: ${url.protocol}. Must be http: or https:`,
        { url: trimmedUrl, protocol: url.protocol }
      );
    }
    
    return trimmedUrl;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Invalid URL format: ${trimmedUrl}`,
      { url: trimmedUrl, error }
    );
  }
}

/**
 * Parse manifest version argument.
 * 
 * Validates manifest version string if provided.
 * 
 * @param {string | undefined} versionArg - Manifest version argument
 * @returns {string | undefined} Validated version or undefined
 * @throws {ValidationError} If version format is invalid
 * 
 * @example
 * ```typescript
 * const version = parseManifestVersion('v1.0');
 * ```
 */
export function parseManifestVersion(versionArg: string | undefined): string | undefined {
  if (!versionArg) {
    return undefined;
  }

  const trimmedVersion = versionArg.trim();
  
  if (trimmedVersion === '') {
    throw new ValidationError('Manifest version cannot be empty');
  }

  return trimmedVersion;
}

/**
 * Parse all CLI arguments.
 * 
 * Consolidates parsing and validation of all CLI arguments.
 * 
 * @param {string} gameUrl - Game URL argument
 * @param {object} options - CLI options
 * @returns {ParsedArguments} Parsed and validated arguments
 * @throws {ValidationError} If any arguments are invalid
 * 
 * @example
 * ```typescript
 * const args = parseArguments('https://example.com/game', { manifest: 'v1.0', debug: true });
 * ```
 */
export function parseArguments(
  gameUrl: string,
  options: {
    manifest?: string;
    noManifest?: boolean;
    debug?: boolean;
  }
): ParsedArguments {
  return {
    gameUrl: parseGameUrl(gameUrl),
    manifestVersion: parseManifestVersion(options.manifest),
    skipManifest: options.noManifest || false,
    debug: options.debug || false,
  };
}

/**
 * Validate parsed arguments for conflicts.
 * 
 * Checks for conflicting argument combinations.
 * 
 * @param {ParsedArguments} args - Parsed arguments to validate
 * @throws {ValidationError} If arguments conflict
 * 
 * @example
 * ```typescript
 * validateArgumentConflicts(parsedArgs);
 * ```
 */
export function validateArgumentConflicts(args: ParsedArguments): void {
  // Cannot specify both manifest version and skip manifest
  if (args.manifestVersion && args.skipManifest) {
    throw new ValidationError(
      'Cannot use both --manifest and --no-manifest options',
      { manifestVersion: args.manifestVersion, skipManifest: args.skipManifest }
    );
  }
}

