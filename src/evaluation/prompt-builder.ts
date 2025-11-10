/**
 * File: src/evaluation/prompt-builder.ts
 * 
 * LLM prompt construction for game evaluation.
 * 
 * This module builds structured prompts for LLM evaluation of game playability.
 * Includes screenshot context, console log analysis, and manifest information
 * to provide comprehensive context for assessment.
 * 
 * @module PromptBuilder
 */

import type { ManifestData } from '../storage/types.js';
import { logger } from '../utils/logger.js';

/**
 * Evaluation evidence for prompt construction.
 */
export interface EvaluationEvidence {
  /** Screenshot URLs to analyze */
  screenshotUrls: string[];
  /** Console logs text */
  consoleLogs: string;
  /** Game metadata */
  gameMetadata: {
    name: string;
    type: string | null;
    url: string;
  };
  /** Optional manifest data for context */
  manifest?: ManifestData | null;
}

/**
 * Build evaluation prompt for LLM.
 * 
 * Creates a comprehensive prompt that includes:
 * - Evaluation criteria
 * - Screenshot descriptions/context
 * - Console log analysis
 * - Manifest context (if available)
 * - Expected output format
 * 
 * @param {EvaluationEvidence} evidence - Evidence to include in prompt
 * @returns {string} Formatted prompt for LLM
 * 
 * @example
 * ```typescript
 * const prompt = buildEvaluationPrompt({
 *   screenshotUrls: ['url1', 'url2'],
 *   consoleLogs: 'logs...',
 *   gameMetadata: { name: 'Game', type: 'platformer', url: 'https://...' }
 * });
 * ```
 */
export function buildEvaluationPrompt(evidence: EvaluationEvidence): string {
  const { screenshotUrls, consoleLogs, gameMetadata, manifest } = evidence;

  let prompt = `You are evaluating a browser game for playability. Analyze the provided evidence and assess whether the game is playable.

## Game Information
- **Name**: ${gameMetadata.name}
- **Type**: ${gameMetadata.type || 'Unknown'}
- **URL**: ${gameMetadata.url}

## Evaluation Criteria (Priority Order)

**IMPORTANT: Evaluation Weighting**
1. **Screenshots are PRIMARY evidence** (70% weight) - Most screenshots should appear different, showing game progression
2. **Console warnings are MINOR** (5% weight) - Warnings alone should NOT cause failure
3. **Critical errors + broken screenshots = failure** - Only fail if critical errors exist AND screenshots show the game is broken

Evaluate the game based on these criteria:

1. **Screenshot Analysis (PRIMARY - 70% weight)**
   - Do the screenshots show the game rendering correctly?
   - Do most screenshots appear different, indicating the game is progressing/changing?
   - Are visual elements visible and properly sized across screenshots?
   - Is there any obvious loading failure, blank screen, or frozen state?
   - **A game with varied, functional-looking screenshots should generally PASS, even with console warnings**

2. **Controls Are Responsive**
   - Can players interact with the game?
   - Do buttons/keyboard inputs appear to work?
   - Is there evidence of user interaction in the screenshots?

3. **Console Log Analysis (SECONDARY - 30% weight)**
   - **Warnings**: These are minor issues and should only result in a small score penalty (1-5 points). Warnings alone should NOT cause a failure.
   - **Critical Errors**: Only consider these significant if they are combined with broken screenshots (blank screens, frozen state, obvious rendering failures). Critical errors with functional screenshots may indicate non-blocking issues.
   - Distinguish between:
     - **Non-critical warnings**: Deprecation warnings, minor API warnings, etc. (very small penalty, < 5 points)
     - **Critical errors**: JavaScript exceptions, network failures, rendering crashes (only fail if screenshots also show broken state)

4. **Visual Quality**
   - Is the game visually readable across screenshots?
   - Are UI elements properly positioned?
   - Is there any obvious rendering issues?

## Evidence Provided

### Screenshots (${screenshotUrls.length} total) - PRIMARY EVIDENCE
${screenshotUrls.map((url, index) => `- Screenshot ${index + 1}: ${url}`).join('\n')}

**Analyze screenshots FIRST and give them the most weight.** The screenshots show the game at different stages of execution. 
- If screenshots show a functional, progressing game with varied visual states, the game should likely PASS
- If screenshots show blank screens, frozen states, or obvious rendering failures, the game should likely FAIL
- Screenshot diversity (different visual states) is a strong indicator of a working game

### Console Logs - SECONDARY EVIDENCE
\`\`\`
${consoleLogs || 'No console logs available'}
\`\`\`

**Use console logs as supporting evidence, not primary.**
- **Warnings**: Apply only a very small penalty (1-5 points). Do NOT fail a game solely because of warnings.
- **Critical Errors**: Only consider these failure-worthy if screenshots ALSO show the game is broken (blank screens, frozen, etc.). If screenshots show a functional game despite errors, the errors may be non-blocking.

`;

  // Add manifest context if available
  if (manifest) {
    prompt += `## Manifest Context

The game has a manifest with the following configuration:
- **Game Type**: ${manifest.gameType}
- **Controls**: ${manifest.controls.primary.join(', ')}${manifest.controls.secondary ? ` (secondary: ${manifest.controls.secondary.join(', ')})` : ''}
- **Mouse Support**: ${manifest.controls.mouse ? 'Yes' : 'No'}

Use this context to better understand what the game should be doing and whether it's functioning correctly.

`;
  }

  prompt += `## Expected Output

Provide your evaluation as a JSON object with the following structure:
{
  "status": "pass" | "fail" | "error",
  "playability_score": number (0-100),
  "issues": string[],
  "reasoning": string
}

Where:
- **status**: "pass" if game is playable (score >= 70), "fail" if playable but has issues (score 50-69), "error" if unplayable (score < 50)
- **playability_score**: Overall score from 0-100 (0 = completely broken, 100 = perfect)
  - Base score primarily on screenshots (70%): functional, varied screenshots = high score
  - Apply small penalty for warnings (1-5 points): warnings should NOT drop score below 70 if screenshots are good
  - Only fail (score < 50) if critical errors exist AND screenshots show broken state
- **issues**: Array of specific issues found (e.g., "Console errors detected", "UI elements not visible")
  - Only include warnings in issues if they are significant
  - Focus on issues visible in screenshots or critical errors that affect gameplay
- **reasoning**: Brief explanation of your assessment, emphasizing screenshot analysis

**Evaluation Guidelines:**
- **PASS (score >= 70)**: Screenshots show functional, progressing game. Warnings are minor and don't affect playability.
- **FAIL (score 50-69)**: Screenshots show some issues but game appears mostly functional. May have non-critical errors.
- **ERROR (score < 50)**: Screenshots show broken state (blank, frozen, obvious failures) AND critical errors exist.

Focus on actual playability - can a user successfully play this game? Screenshots are the primary indicator. Console warnings should not cause failure. Only fail if critical errors are combined with broken screenshots.`;

  return prompt;
}

/**
 * Build system message for LLM evaluation.
 * 
 * Returns a system message that sets the context for the LLM evaluation task.
 * 
 * @returns {string} System message
 */
export function buildSystemMessage(): string {
  return `You are an expert QA tester specializing in browser game evaluation. Your task is to analyze screenshots and console logs to determine if a game is playable.

**Evaluation Priority:**
1. **Screenshots are PRIMARY** (70% weight) - Most screenshots should appear different, showing game progression
2. **Console warnings are MINOR** (5% weight) - Warnings alone should NOT cause failure
3. **Critical errors + broken screenshots = failure** - Only fail if critical errors exist AND screenshots show the game is broken

Be thorough but concise. Focus on objective evidence:
- Visual state of the game (PRIMARY - analyze screenshots first)
- Screenshot diversity (different visual states indicate working game)
- Console errors (only significant if combined with broken screenshots)
- Console warnings (very minor penalty, should not cause failure)
- Signs of interactivity
- Overall stability

Remember: A game with functional, varied screenshots should generally PASS, even with console warnings. Only fail if critical errors are combined with broken screenshots.

Provide your assessment as structured JSON.`;
}

/**
 * Format screenshot URLs for LLM input.
 * 
 * Converts screenshot URLs to a format suitable for LLM vision models.
 * Fetches images from URLs and converts them to Buffers for use with OpenAI SDK.
 * Buffers are later converted to base64 data URLs in the evaluator.
 * 
 * @param {string[]} screenshotUrls - Array of screenshot URLs (must be publicly accessible)
 * @returns {Promise<Array<{type: 'image', image: Buffer}>>} Formatted image inputs
 */
export async function formatScreenshotsForLLM(
  screenshotUrls: string[]
): Promise<Array<{ type: 'image'; image: Buffer }>> {
  // Fetch images from URLs and convert to Buffers
  // These Buffers will be converted to base64 data URLs for OpenAI API
  
  const imageInputs: Array<{ type: 'image'; image: Buffer }> = [];
  
  for (const url of screenshotUrls) {
    try {
      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn('Failed to fetch screenshot for LLM', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }
      
      // Convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (buffer.length === 0) {
        logger.warn('Screenshot fetched but is empty', { url });
        continue;
      }
      
      imageInputs.push({
        type: 'image' as const,
        image: buffer,
      });
      
      logger.debug('Screenshot formatted for LLM', {
        url,
        sizeBytes: buffer.length,
      });
    } catch (error) {
      logger.warn('Error fetching screenshot for LLM', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with other images even if one fails
    }
  }
  
  return imageInputs;
}

/**
 * Summarize console logs for prompt inclusion.
 * 
 * Truncates and formats console logs to fit within token limits while
 * preserving important information (errors, warnings).
 * 
 * @param {string} logs - Full console logs
 * @param {number} maxLength - Maximum length in characters
 * @returns {string} Summarized logs
 */
export function summarizeConsoleLogs(logs: string, maxLength: number = 5000): string {
  if (!logs || logs.length === 0) {
    return 'No console logs available.';
  }

  if (logs.length <= maxLength) {
    return logs;
  }

  // Prioritize errors and warnings
  const lines = logs.split('\n');
  const errorLines: string[] = [];
  const warningLines: string[] = [];
  const otherLines: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception')) {
      errorLines.push(line);
    } else if (lowerLine.includes('warning')) {
      warningLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  // Build summary: all errors, all warnings, then other lines up to limit
  const summary: string[] = [];

  if (errorLines.length > 0) {
    summary.push('=== ERRORS ===');
    summary.push(...errorLines);
  }

  if (warningLines.length > 0) {
    summary.push('=== WARNINGS ===');
    summary.push(...warningLines);
  }

  // Add other lines until we hit the limit
  let remainingLength = maxLength - summary.join('\n').length;
  for (const line of otherLines) {
    if (remainingLength <= 0) {
      break;
    }
    if (line.length <= remainingLength) {
      summary.push(line);
      remainingLength -= line.length + 1; // +1 for newline
    }
  }

  const result = summary.join('\n');
  if (result.length < logs.length) {
    return `${result}\n\n... (truncated, ${logs.length - result.length} characters omitted)`;
  }

  return result;
}


