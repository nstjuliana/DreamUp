/**
 * File: src/agent/vision-action-planner.ts
 * 
 * Vision-based action planner using GPT-4o-mini.
 * 
 * This module provides functions for deciding game actions based on screenshots.
 * Uses GPT-4o-mini vision API to analyze the current game state and determine
 * the next action to take (click coordinates, key press, wait, etc.).
 * 
 * @module VisionActionPlanner
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

/**
 * Game action decision result.
 * 
 * Represents an action that should be executed based on visual analysis.
 * Uses natural language descriptions for clicking (e.g., "Start button", "enemy character").
 */
export interface GameAction {
  /** Action type to execute */
  action: 'click' | 'key_press' | 'wait' | 'scroll';
  /** Natural language description of what to click (required for click action) */
  target?: string;
  /** Key name for key_press action (e.g., "ArrowUp", "Space") */
  key?: string;
  /** Duration in milliseconds for wait action */
  duration?: number;
  /** AI's reasoning for this action (for logging/debugging) */
  description: string;
}

/**
 * Game context for action decisions.
 */
export interface GameContext {
  /** Game type (e.g., 'platformer', 'puzzle', 'shooter') */
  gameType: string;
  /** Available control keys */
  controls: string[];
  /** Gameplay goal/objective */
  goal: string;
}

/**
 * Decide next action based on screenshot(s).
 * 
 * Analyzes the current game state using GPT-4o-mini vision and returns
 * a structured action decision. The viewport is fixed at 1280x720 for
 * consistent coordinate mapping.
 * 
 * When a previous screenshot is provided, the model can detect changes
 * and make more informed decisions based on game state transitions.
 * 
 * @param {string} screenshotBase64 - Base64-encoded PNG screenshot (current state)
 * @param {GameContext} gameContext - Game context (type, controls, goal)
 * @param {OpenAI} openaiClient - OpenAI client instance
 * @param {string} [previousScreenshotBase64] - Optional previous screenshot for change detection
 * @returns {Promise<GameAction>} Next action to execute
 * @throws {Error} If action decision fails
 * 
 * @example
 * ```typescript
 * const action = await decideNextAction(currentScreenshot, {
 *   gameType: 'platformer',
 *   controls: ['ArrowUp', 'Space'],
 *   goal: 'Navigate through levels'
 * }, openaiClient, previousScreenshot);
 * 
 * if (action.action === 'click') {
 *   await stagehandClient.clickElement(action.target!);
 * }
 * ```
 */
export async function decideNextAction(
  screenshotBase64: string,
  gameContext: GameContext,
  openaiClient: OpenAI,
  previousScreenshotBase64?: string
): Promise<GameAction> {
  try {
    const hasPreviousScreenshot = !!previousScreenshotBase64;
    
    logger.debug('Deciding next action using GPT-4o-mini vision', {
      gameType: gameContext.gameType,
      controls: gameContext.controls,
      hasPreviousScreenshot,
    });
    
    const systemPrompt = `You are playing a browser game. Based on the screenshot${hasPreviousScreenshot ? 's (previous and current)' : ''}, decide the next action to take.

Game Context:
- Game Type: ${gameContext.gameType}
- Available Controls: ${gameContext.controls.join(', ')}
- Goal: ${gameContext.goal}

${hasPreviousScreenshot ? `IMPORTANT: You will receive TWO images:
1. Previous screenshot (from the last decision cycle)
2. Current screenshot (current game state)

Compare these images to understand:
- What changed since the last action
- Whether the game state has progressed or stalled
- If the previous action had the intended effect
- Whether the game is waiting for input or animating

Use this temporal context to make better decisions.` : ''}

Rules:
1. ${hasPreviousScreenshot ? 'Compare the previous and current screenshots to understand what changed. ' : ''}Analyze the current game state from the screenshot${hasPreviousScreenshot ? 's' : ''}
2. Decide the best action: click, key_press, wait, or scroll
3. For clicks: provide a natural language description of what to click (e.g., "Start button", "enemy character", "menu item", "power-up")
4. For key_press: use one of the available controls (${gameContext.controls.join(', ')})
5. For wait: specify duration in milliseconds (max 2000ms) - use this if the game is animating or if no immediate action is needed
6. Always provide a clear description explaining your decision${hasPreviousScreenshot ? ', including what changed from the previous state' : ''}

Return your response as a JSON object with this exact structure:
{
  "action": "click" | "key_press" | "wait" | "scroll",
  "target": string (required for click - natural language description of what to click),
  "key": string (required for key_press, e.g., "ArrowUp", "Space"),
  "duration": number (required for wait, in milliseconds),
  "description": string (required, explain your decision${hasPreviousScreenshot ? ' and what changed from previous state' : ''})
}`;

    const userPrompt = hasPreviousScreenshot
      ? `Compare the previous screenshot (first image) with the current screenshot (second image). What action should I take next? Analyze what changed and return a JSON object with the action decision.`
      : `What action should I take next? Analyze the screenshot and return a JSON object with the action decision.`;

    // Build message content array with images
    const messageContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: userPrompt,
      },
    ];

    // Add previous screenshot first if available
    if (previousScreenshotBase64) {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${previousScreenshotBase64}`,
        },
      });
    }

    // Add current screenshot
    messageContent.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${screenshotBase64}`,
      },
    });

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: messageContent as any, // OpenAI SDK types are complex, but this works
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from GPT-4o-mini');
    }

    // Parse JSON response
    let actionData: any;
    try {
      actionData = JSON.parse(content);
    } catch (parseError) {
      logger.error('Failed to parse action response as JSON', {
        content,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw new Error('Invalid JSON response from GPT-4o-mini');
    }

    // Validate action structure
    const action: GameAction = {
      action: actionData.action || 'wait',
      description: actionData.description || 'No description provided',
    };

    // Add action-specific fields
    if (action.action === 'click') {
      if (!actionData.target || typeof actionData.target !== 'string') {
        throw new Error('Click action requires target field (natural language description)');
      }
      action.target = actionData.target.trim();
    } else if (action.action === 'key_press') {
      if (!actionData.key) {
        throw new Error('key_press action requires key field');
      }
      action.key = actionData.key;
    } else if (action.action === 'wait') {
      if (typeof actionData.duration !== 'number') {
        throw new Error('wait action requires duration field');
      }
      action.duration = Math.max(0, Math.min(2000, Math.round(actionData.duration)));
    }

    logger.info('Action decision made', {
      action: action.action,
      ...(action.target && { target: action.target }),
      ...(action.key && { key: action.key }),
      ...(action.duration !== undefined && { duration: action.duration }),
      description: action.description,
    });

    return action;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to decide next action', {
      error: message,
      gameType: gameContext.gameType,
    });
    throw error;
  }
}

