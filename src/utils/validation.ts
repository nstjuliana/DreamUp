/**
 * File: src/utils/validation.ts
 * 
 * Input validation utilities.
 * 
 * This module provides validation functions for user inputs such as URLs,
 * file paths, and other parameters. Throws ValidationError for invalid inputs
 * to enable early failure with clear error messages.
 * 
 * @module Validation
 */

import { ValidationError } from './errors.js';
import { logger } from './logger.js';

/**
 * Validate URL format.
 * 
 * Checks if the provided string is a valid HTTP/HTTPS URL.
 * Throws ValidationError if the URL is invalid or uses an unsupported protocol.
 * 
 * @param {string} url - URL string to validate
 * @returns {string} The validated URL (normalized)
 * @throws {ValidationError} If URL is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const validUrl = validateUrl('https://example.com/game');
 *   console.log(`Valid URL: ${validUrl}`);
 * } catch (error) {
 *   console.error('Invalid URL:', error.message);
 * }
 * ```
 */
export function validateUrl(url: string): string {
  // Check if URL is provided
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL is required', { url });
  }
  
  // Trim whitespace
  const trimmedUrl = url.trim();
  
  if (trimmedUrl.length === 0) {
    throw new ValidationError('URL cannot be empty', { url });
  }
  
  // Try to parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch (error) {
    throw new ValidationError(`Invalid URL format: ${trimmedUrl}`, {
      url: trimmedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  
  // Check protocol
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ValidationError(
      `Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are supported.`,
      { url: trimmedUrl, protocol: parsedUrl.protocol }
    );
  }
  
  // Check if hostname exists
  if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
    throw new ValidationError('URL must have a valid hostname', {
      url: trimmedUrl,
    });
  }
  
  logger.debug('URL validated successfully', { url: parsedUrl.href });
  return parsedUrl.href;
}

/**
 * Validate test ID format.
 * 
 * Checks if the provided string is a valid UUID format for test IDs.
 * 
 * @param {string} testId - Test ID to validate
 * @returns {string} The validated test ID
 * @throws {ValidationError} If test ID is invalid
 * 
 * @example
 * ```typescript
 * const id = validateTestId('550e8400-e29b-41d4-a716-446655440000');
 * ```
 */
export function validateTestId(testId: string): string {
  if (!testId || typeof testId !== 'string') {
    throw new ValidationError('Test ID is required', { testId });
  }
  
  const trimmed = testId.trim();
  
  // UUID v4 regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidPattern.test(trimmed)) {
    throw new ValidationError('Test ID must be a valid UUID', {
      testId: trimmed,
    });
  }
  
  return trimmed;
}

/**
 * Validate manifest path format.
 * 
 * Checks if the provided manifest path is valid (for future use).
 * Currently just checks for non-empty string.
 * 
 * @param {string} manifestPath - Manifest file path to validate
 * @returns {string} The validated manifest path
 * @throws {ValidationError} If manifest path is invalid
 * 
 * @example
 * ```typescript
 * const path = validateManifestPath('./manifests/game.json');
 * ```
 */
export function validateManifestPath(manifestPath: string): string {
  if (!manifestPath || typeof manifestPath !== 'string') {
    throw new ValidationError('Manifest path is required', { manifestPath });
  }
  
  const trimmed = manifestPath.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError('Manifest path cannot be empty', {
      manifestPath,
    });
  }
  
  return trimmed;
}

/**
 * Validate positive integer.
 * 
 * Checks if the provided value is a positive integer.
 * Useful for validating timeout values, retry counts, etc.
 * 
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {number} The validated integer
 * @throws {ValidationError} If value is not a positive integer
 * 
 * @example
 * ```typescript
 * const timeout = validatePositiveInteger(5000, 'timeout');
 * ```
 */
export function validatePositiveInteger(
  value: number,
  fieldName: string
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} must be an integer`, {
      field: fieldName,
      value,
    });
  }
  
  if (value <= 0) {
    throw new ValidationError(`${fieldName} must be positive`, {
      field: fieldName,
      value,
    });
  }
  
  return value;
}

