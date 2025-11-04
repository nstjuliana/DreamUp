/**
 * File: src/evaluation/llm-evaluator.ts
 * 
 * LLM-based game evaluation.
 * 
 * This module handles evaluation of game playability using LLM models (OpenAI/Anthropic).
 * It constructs prompts with evidence (screenshots, console logs), sends them to the LLM,
 * and parses the evaluation results. Uses Vercel AI SDK with structured outputs.
 * 
 * @module LLMEvaluator
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { EvaluationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';
import { buildEvaluationPrompt, buildSystemMessage, summarizeConsoleLogs, formatScreenshotsForLLM } from './prompt-builder.js';
import { parseEvaluationResponse, convertToTestStatus, createDefaultEvaluationResult, type ParsedEvaluationResult } from './result-parser.js';
import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_BASE_MS } from '../utils/constants.js';

/**
 * Evidence for LLM evaluation.
 */
export interface EvaluationEvidence {
  /** Array of screenshot URLs */
  screenshotUrls: string[];
  /** Console logs */
  consoleLogs: string;
  /** Game metadata */
  gameMetadata: {
    name: string;
    type: string | null;
    url: string;
  };
  /** Optional manifest data for context */
  manifest?: import('../storage/types.js').ManifestData | null;
}

/**
 * LLM evaluation result.
 */
export interface EvaluationResult {
  /** Pass/fail/error status */
  status: 'pass' | 'fail' | 'error' | 'timeout';
  /** Playability score (0-100) */
  playabilityScore: number;
  /** Array of identified issues */
  issues: string[];
  /** Reasoning from LLM */
  reasoning: string;
}

/**
 * LLMEvaluator class - Evaluates game playability using LLM.
 * 
 * Constructs comprehensive prompts with visual and textual evidence,
 * sends them to configured LLM provider, and parses structured responses.
 * 
 * Evaluation criteria:
 * - Game loads successfully
 * - Game is interactive and responsive
 * - No critical console errors
 * - Visual elements render correctly
 * - Game mechanics function as expected
 * 
 * @example
 * ```typescript
 * const evaluator = new LLMEvaluator();
 * const result = await evaluator.evaluate(evidence);
 * console.log(`Playability score: ${result.playabilityScore}`);
 * ```
 */
export class LLMEvaluator {
  private config: ReturnType<typeof getConfig>['llm'];

  /**
   * Create LLM evaluator instance.
   */
  constructor() {
    this.config = getConfig().llm;
    logger.debug('LLM Evaluator initialized', {
      provider: this.config.provider,
      model: this.config.model,
    });
  }

  /**
   * Evaluate game playability.
   * 
   * Sends evidence to LLM for analysis and returns structured evaluation.
   * Uses Vercel AI SDK with structured outputs (Zod schema) for type-safe responses.
   * Includes retry logic with exponential backoff.
   * 
   * @param {EvaluationEvidence} evidence - Evidence to evaluate
   * @returns {Promise<EvaluationResult>} Evaluation results
   * @throws {EvaluationError} If evaluation fails after all retries
   * 
   * @example
   * ```typescript
   * const result = await evaluator.evaluate({
   *   screenshotUrls: ['url1', 'url2'],
   *   consoleLogs: 'logs...',
   *   gameMetadata: { name: 'Game', type: 'platformer', url: 'https://...' }
   * });
   * ```
   */
  async evaluate(evidence: EvaluationEvidence): Promise<EvaluationResult> {
    if (this.config.provider !== 'openai') {
      logger.warn('OpenAI provider required for full evaluation, using fallback', {
        provider: this.config.provider,
      });
      return this.fallbackEvaluation(evidence);
    }

    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info('Starting LLM evaluation', {
          provider: this.config.provider,
          model: this.config.model || 'gpt-4o',
          screenshotCount: evidence.screenshotUrls.length,
          hasManifest: !!evidence.manifest,
          attempt,
          maxRetries: MAX_RETRY_ATTEMPTS,
        });

        // Summarize console logs to fit within token limits
        const summarizedLogs = summarizeConsoleLogs(evidence.consoleLogs, 5000);

        // Build prompt
        const prompt = buildEvaluationPrompt({
          screenshotUrls: evidence.screenshotUrls,
          consoleLogs: summarizedLogs,
          gameMetadata: evidence.gameMetadata,
          manifest: evidence.manifest || null,
        });

        // Format screenshots for vision model
        const imageInputs = await formatScreenshotsForLLM(evidence.screenshotUrls);

        // Determine model to use (default to gpt-4o for vision support)
        const modelName = this.config.model || 'gpt-4o';

        // Import schema
        const { EvaluationResultSchema } = await import('./result-parser.js');

        // Use Vercel AI SDK generateObject with structured outputs
        // For vision models, use messages format with image inputs
        const { object } = await generateObject({
          model: openai(modelName, {
            apiKey: this.config.apiKey,
          }),
          schema: EvaluationResultSchema,
          messages: [
            {
              role: 'system' as const,
              content: buildSystemMessage(),
            },
            {
              role: 'user' as const,
              content: imageInputs.length > 0
                ? [
                    { type: 'text' as const, text: prompt },
                    ...imageInputs,
                  ]
                : prompt,
            },
          ],
        });

        // Parse and validate response
        const parsed = parseEvaluationResponse(object);
        const testStatus = convertToTestStatus(parsed);

        const result: EvaluationResult = {
          status: testStatus,
          playabilityScore: parsed.playability_score,
          issues: parsed.issues,
          reasoning: parsed.reasoning,
        };

        logger.info('LLM evaluation complete', {
          status: result.status,
          score: result.playabilityScore,
          issueCount: result.issues.length,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message;

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          logger.warn('LLM evaluation failed, retrying', {
            attempt,
            maxRetries: MAX_RETRY_ATTEMPTS,
            backoffMs,
            error: message,
          });

          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          logger.error('LLM evaluation failed after all retries', {
            attempts: MAX_RETRY_ATTEMPTS,
            error: message,
          });
        }
      }
    }

    // All retries failed - use fallback
    logger.warn('Using fallback evaluation after LLM failures');
    return this.fallbackEvaluation(evidence);
  }


  /**
   * Fallback heuristic evaluation.
   * 
   * Provides basic evaluation when LLM is unavailable or fails.
   * Uses simple heuristics based on available evidence.
   * 
   * @param {EvaluationEvidence} evidence - Evidence to evaluate
   * @returns {EvaluationResult} Heuristic evaluation
   */
  async fallbackEvaluation(evidence: EvaluationEvidence): Promise<EvaluationResult> {
    logger.warn('Using fallback heuristic evaluation');

    const hasScreenshots = evidence.screenshotUrls.length > 0;
    const hasCriticalErrors = evidence.consoleLogs.toLowerCase().includes('error');

    let score = 50; // Base score
    if (hasScreenshots) {
      score += 25; // Screenshots captured = game rendered
    }
    if (!hasCriticalErrors) {
      score += 25; // No errors = possibly functional
    }

    const issues: string[] = [];
    if (hasCriticalErrors) {
      issues.push('Console errors detected');
    }
    if (!hasScreenshots) {
      issues.push('No screenshots captured - game may not have loaded');
      score = Math.min(score, 30); // Penalize heavily for no screenshots
    }

    const status: 'pass' | 'fail' | 'error' = score >= 70 ? 'pass' : score >= 50 ? 'fail' : 'error';

    return {
      status,
      playabilityScore: Math.max(0, Math.min(100, score)),
      issues,
      reasoning: 'Fallback heuristic evaluation (LLM unavailable or failed). Basic checks: screenshots captured, console errors checked.',
    };
  }
}

