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
 * Uses coordinate-based clicking for reliability with canvas games.
 */
export interface GameAction {
  /** Action type to execute */
  action: 'click' | 'key_press' | 'wait' | 'scroll';
  /** X coordinate for click action (viewport is 1280x720) */
  x?: number;
  /** Y coordinate for click action (viewport is 1280x720) */
  y?: number;
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
 * Decide next action based on screenshot.
 * 
 * Analyzes the current game state using GPT-4o-mini vision and returns
 * a structured action decision. The viewport is fixed at 1280x720 for
 * consistent coordinate mapping.
 * 
 * @param {string} screenshotBase64 - Base64-encoded PNG screenshot
 * @param {GameContext} gameContext - Game context (type, controls, goal)
 * @param {OpenAI} openaiClient - OpenAI client instance
 * @returns {Promise<GameAction>} Next action to execute
 * @throws {Error} If action decision fails
 * 
 * @example
 * ```typescript
 * const action = await decideNextAction(screenshot, {
 *   gameType: 'platformer',
 *   controls: ['ArrowUp', 'Space'],
 *   goal: 'Navigate through levels'
 * }, openaiClient);
 * 
 * if (action.action === 'click') {
 *   await page.mouse.click(action.x!, action.y!);
 * }
 * ```
 */
export async function decideNextAction(
  screenshotBase64: string,
  gameContext: GameContext,
  openaiClient: OpenAI
): Promise<GameAction> {
  try {
    logger.debug('Deciding next action using GPT-4o-mini vision', {
      gameType: gameContext.gameType,
      controls: gameContext.controls,
    });

    const systemPrompt = `You are playing a browser game. Based on the screenshot, decide the next action to take.

Game Context:
- Game Type: ${gameContext.gameType}
- Available Controls: ${gameContext.controls.join(', ')}
- Goal: ${gameContext.goal}

Viewport Size: 1280x720 pixels (fixed)

Rules:
1. Analyze the current game state from the screenshot
2. Decide the best action: click, key_press, wait, or scroll
3. For clicks: provide exact pixel coordinates (x, y) where 0,0 is top-left
4. For key_press: use one of the available controls (${gameContext.controls.join(', ')})
5. For wait: specify duration in milliseconds (max 2000ms)
6. Always provide a clear description explaining your decision

Return your response as a JSON object with this exact structure:
{
  "action": "click" | "key_press" | "wait" | "scroll",
  "x": number (required for click),
  "y": number (required for click),
  "key": string (required for key_press, e.g., "ArrowUp", "Space"),
  "duration": number (required for wait, in milliseconds),
  "description": string (required, explain your decision)
}`;

    const userPrompt = `What action should I take next? Analyze the screenshot and return a JSON object with the action decision.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
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
      if (typeof actionData.x !== 'number' || typeof actionData.y !== 'number') {
        throw new Error('Click action requires x and y coordinates');
      }
      // Clamp coordinates to viewport bounds
      action.x = Math.max(0, Math.min(1279, Math.round(actionData.x)));
      action.y = Math.max(0, Math.min(719, Math.round(actionData.y)));
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
      ...(action.x !== undefined && { x: action.x }),
      ...(action.y !== undefined && { y: action.y }),
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

/**
 * Find start button coordinates using GPT-4o-mini vision.
 * 
 * Analyzes a screenshot to locate the start/play button and returns
 * its coordinates. Used for initial game interaction.
 * 
 * @param {string} screenshotBase64 - Base64-encoded PNG screenshot
 * @param {OpenAI} openaiClient - OpenAI client instance
 * @returns {Promise<{x: number, y: number} | null>} Button coordinates or null if not found
 * 
 * @example
 * ```typescript
 * const coords = await findStartButtonCoordinates(screenshot, openaiClient);
 * if (coords) {
 *   await page.mouse.click(coords.x, coords.y);
 * }
 * ```
 */
export async function findStartButtonCoordinates(
  screenshotBase64: string,
  openaiClient: OpenAI
): Promise<{ x: number; y: number } | null> {
  try {
    logger.debug('Finding start button using GPT-4o-mini vision');

    const systemPrompt = `You are analyzing a browser game screenshot to find the start/play button.

Viewport Size: 1280x720 pixels (fixed)

Instructions:
1. Look for buttons labeled "Start", "Play", "Begin", "Go", or similar
2. Look for prominent clickable elements that would start the game
3. Return the center coordinates (x, y) of the button
4. Coordinates are in pixels where 0,0 is top-left corner
5. If no start button is found, return null

Return your response as a JSON object:
{
  "found": boolean,
  "x": number (center x coordinate if found),
  "y": number (center y coordinate if found),
  "description": string (what you found or why not found)
}`;

    const userPrompt = `Find the start/play button in this screenshot. Return the center coordinates (x, y) if found, or null if not found.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent detection
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warn('No response content from GPT-4o-mini for start button detection');
      return null;
    }

    // Parse JSON response
    let result: any;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      logger.error('Failed to parse start button response as JSON', {
        content,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return null;
    }

    if (!result.found || typeof result.x !== 'number' || typeof result.y !== 'number') {
      logger.info('Start button not found', {
        description: result.description || 'No description',
      });
      return null;
    }

    // Clamp coordinates to viewport bounds
    const x = Math.max(0, Math.min(1279, Math.round(result.x)));
    const y = Math.max(0, Math.min(719, Math.round(result.y)));

    logger.info('Start button found', {
      x,
      y,
      description: result.description || 'No description',
    });

    return { x, y };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to find start button coordinates', {
      error: message,
    });
    return null;
  }
}

