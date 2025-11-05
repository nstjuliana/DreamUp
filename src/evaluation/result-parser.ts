/**
 * File: src/evaluation/result-parser.ts
 * 
 * LLM response parsing with Zod schema validation.
 * 
 * This module provides Zod schemas for structured LLM outputs and functions
 * to parse and validate LLM responses. Ensures type-safe evaluation results.
 * 
 * @module ResultParser
 */

import { z } from 'zod';
import { EvaluationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Zod schema for LLM evaluation result.
 * 
 * Defines the expected structure of LLM evaluation responses.
 * Used with OpenAI SDK's structured outputs (JSON schema) feature.
 */
export const EvaluationResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'error']),
  playability_score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * Parsed evaluation result type.
 */
export type ParsedEvaluationResult = z.infer<typeof EvaluationResultSchema>;

/**
 * Parse LLM evaluation response.
 * 
 * Validates and parses an LLM response against the EvaluationResultSchema.
 * Ensures the response matches the expected structure and all fields are valid.
 * 
 * @param {unknown} response - Raw LLM response to parse
 * @returns {ParsedEvaluationResult} Parsed and validated evaluation result
 * @throws {EvaluationError} If response doesn't match schema
 * 
 * @example
 * ```typescript
 * const result = parseEvaluationResponse(llmResponse);
 * console.log(`Playability score: ${result.playability_score}`);
 * ```
 */
export function parseEvaluationResponse(response: unknown): ParsedEvaluationResult {
  try {
    logger.debug('Parsing LLM evaluation response', {
      responseType: typeof response,
    });

    // If response is already an object, validate it directly
    if (typeof response === 'object' && response !== null) {
      const parsed = EvaluationResultSchema.parse(response);
      logger.debug('Evaluation response parsed successfully', {
        status: parsed.status,
        score: parsed.playability_score,
        issueCount: parsed.issues.length,
      });
      return parsed;
    }

    // If response is a string, try to parse as JSON
    if (typeof response === 'string') {
      try {
        const json = JSON.parse(response);
        const parsed = EvaluationResultSchema.parse(json);
        logger.debug('Evaluation response parsed from JSON string', {
          status: parsed.status,
          score: parsed.playability_score,
        });
        return parsed;
      } catch (parseError) {
        throw new EvaluationError('Failed to parse JSON response', {
          response,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    }

    throw new EvaluationError('Invalid response type', {
      responseType: typeof response,
      response,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('LLM response validation failed', {
        errors: error.errors,
        response,
      });
      throw new EvaluationError('LLM response does not match expected schema', {
        zodErrors: error.errors,
        response,
      });
    }

    if (error instanceof EvaluationError) {
      throw error;
    }

    throw new EvaluationError('Failed to parse evaluation response', {
      error: error instanceof Error ? error.message : String(error),
      response,
    });
  }
}

/**
 * Convert parsed evaluation result to test status.
 * 
 * Maps the parsed evaluation result status to a TestStatus that matches
 * the database schema and output format.
 * 
 * @param {ParsedEvaluationResult} result - Parsed evaluation result
 * @returns {'pass' | 'fail' | 'error'} Test status
 */
export function convertToTestStatus(result: ParsedEvaluationResult): 'pass' | 'fail' | 'error' {
  // Map evaluation status to test status
  // 'pass' from LLM -> 'pass' in test
  // 'fail' from LLM -> 'fail' in test (playable but issues)
  // 'error' from LLM -> 'error' in test (unplayable)
  return result.status;
}

/**
 * Validate playability score.
 * 
 * Ensures the playability score is within valid range (0-100).
 * 
 * @param {number} score - Playability score to validate
 * @returns {number} Validated score (clamped to 0-100)
 */
export function validatePlayabilityScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Create default evaluation result.
 * 
 * Creates a default evaluation result for fallback scenarios.
 * 
 * @param {string} reason - Reason for default result
 * @returns {ParsedEvaluationResult} Default evaluation result
 */
export function createDefaultEvaluationResult(reason: string): ParsedEvaluationResult {
  return {
    status: 'error',
    playability_score: 0,
    issues: [`Evaluation unavailable: ${reason}`],
    reasoning: reason,
  };
}



