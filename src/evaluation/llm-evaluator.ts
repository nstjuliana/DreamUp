/**
 * File: src/evaluation/llm-evaluator.ts
 * 
 * LLM-based game evaluation.
 * 
 * This module handles evaluation of game playability using LLM models (OpenAI/Anthropic).
 * It constructs prompts with evidence (screenshots, console logs), sends them to the LLM,
 * and parses the evaluation results.
 * 
 * @module LLMEvaluator
 */

import { EvaluationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

/**
 * Evidence for LLM evaluation.
 */
export interface EvaluationEvidence {
  /** Array of screenshot URLs or buffers */
  screenshots: string[];
  /** Console logs */
  consoleLogs: string;
  /** Game metadata */
  gameMetadata: {
    name: string;
    type: string | null;
    url: string;
  };
  /** Optional manifest data for context */
  manifest?: Record<string, unknown>;
}

/**
 * LLM evaluation result.
 */
export interface EvaluationResult {
  /** Pass/fail status */
  status: 'pass' | 'fail' | 'error' | 'timeout';
  /** Playability score (0-100) */
  playabilityScore: number;
  /** Array of identified issues */
  issues: string[];
  /** Reasoning from LLM */
  reasoning: string;
  /** Confidence level (0-1) */
  confidence: number;
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
   * 
   * @param {EvaluationEvidence} evidence - Evidence to evaluate
   * @returns {Promise<EvaluationResult>} Evaluation results
   * @throws {EvaluationError} If evaluation fails
   * 
   * @example
   * ```typescript
   * const result = await evaluator.evaluate({
   *   screenshots: ['url1', 'url2'],
   *   consoleLogs: 'logs...',
   *   gameMetadata: { name: 'Game', type: 'platformer', url: 'https://...' }
   * });
   * ```
   */
  async evaluate(evidence: EvaluationEvidence): Promise<EvaluationResult> {
    try {
      logger.info('Starting LLM evaluation', {
        provider: this.config.provider,
        screenshotCount: evidence.screenshots.length,
        hasManifest: !!evidence.manifest,
      });

      // Placeholder: LLM API integration will be implemented in MVP phase
      // For now, return mock evaluation
      
      const result: EvaluationResult = {
        status: 'pass',
        playabilityScore: 75,
        issues: [],
        reasoning: 'Placeholder evaluation - full implementation coming in MVP phase',
        confidence: 0.8,
      };

      logger.info('LLM evaluation complete', {
        status: result.status,
        score: result.playabilityScore,
        issueCount: result.issues.length,
      });

      return result;
    } catch (error) {
      throw new EvaluationError(
        `LLM evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        { evidence, error }
      );
    }
  }

  /**
   * Build evaluation prompt.
   * 
   * Constructs comprehensive prompt with evidence and context.
   * 
   * @param {EvaluationEvidence} evidence - Evidence to include
   * @returns {string} Formatted prompt
   */
  private _buildPrompt(evidence: EvaluationEvidence): string {
    // Placeholder: Prompt engineering will be done in MVP phase
    logger.debug('Building evaluation prompt', {
      gameName: evidence.gameMetadata.name,
      gameType: evidence.gameMetadata.type,
    });

    return `Evaluate the playability of this browser game...`;
  }

  /**
   * Parse LLM response.
   * 
   * Extracts structured evaluation from LLM response.
   * 
   * @param {string} response - Raw LLM response
   * @returns {EvaluationResult} Parsed evaluation
   * @throws {EvaluationError} If response parsing fails
   */
  private _parseResponse(response: string): EvaluationResult {
    // Placeholder: Response parsing will be implemented in MVP phase
    logger.debug('Parsing LLM response', { responseLength: response.length });

    return {
      status: 'pass',
      playabilityScore: 75,
      issues: [],
      reasoning: 'Placeholder',
      confidence: 0.8,
    };
  }

  /**
   * Determine test status from playability score.
   * 
   * @param {number} score - Playability score (0-100)
   * @param {string[]} issues - Identified issues
   * @returns {'pass' | 'fail'} Test status
   */
  private _determineStatus(score: number, issues: string[]): 'pass' | 'fail' {
    // Placeholder: Status determination logic will be refined in MVP phase
    const criticalIssues = issues.filter((issue) =>
      issue.toLowerCase().includes('critical') || issue.toLowerCase().includes('crash')
    );

    if (criticalIssues.length > 0 || score < 50) {
      return 'fail';
    }

    return 'pass';
  }

  /**
   * Fallback heuristic evaluation.
   * 
   * Provides basic evaluation when LLM is unavailable.
   * 
   * @param {EvaluationEvidence} evidence - Evidence to evaluate
   * @returns {EvaluationResult} Heuristic evaluation
   */
  async fallbackEvaluation(evidence: EvaluationEvidence): Promise<EvaluationResult> {
    logger.warn('Using fallback heuristic evaluation');

    // Placeholder: Heuristic evaluation will be implemented in MVP phase
    // Basic checks: screenshots captured, no critical console errors

    const hasScreenshots = evidence.screenshots.length > 0;
    const hasCriticalErrors = evidence.consoleLogs.toLowerCase().includes('error');

    let score = 50; // Base score
    if (hasScreenshots) score += 25;
    if (!hasCriticalErrors) score += 25;

    return {
      status: score >= 50 ? 'pass' : 'fail',
      playabilityScore: score,
      issues: hasCriticalErrors ? ['Console errors detected'] : [],
      reasoning: 'Fallback heuristic evaluation (LLM unavailable)',
      confidence: 0.5,
    };
  }
}

