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
 *   await stagehandClient.clickElement(action.target!);
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

Rules:
1. Analyze the current game state from the screenshot
2. Decide the best action: click, key_press, wait, or scroll
3. For clicks: provide a natural language description of what to click (e.g., "Start button", "enemy character", "menu item", "power-up")
4. For key_press: use one of the available controls (${gameContext.controls.join(', ')})
5. For wait: specify duration in milliseconds (max 2000ms)
6. Always provide a clear description explaining your decision

Return your response as a JSON object with this exact structure:
{
  "action": "click" | "key_press" | "wait" | "scroll",
  "target": string (required for click - natural language description of what to click),
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
    const visionModel = 'gpt-4o'; // Use gpt-4o for better accuracy
    logger.debug('Finding start button using vision', { model: visionModel });

    const systemPrompt = `You are analyzing a browser game screenshot to find the start/play button and return its EXACT pixel coordinates.

CRITICAL: The viewport is 1280x720 pixels. Coordinates use pixel positions where (0,0) is the TOP-LEFT corner.

MEASUREMENT PROCESS:
1. First, identify ALL visible UI elements and their approximate positions:
   - Game title (where is it? top-left? center-top?)
   - Player instructions (left side? right side? top? bottom?)
   - Any menu items or text
   - The start button specifically

2. For each element, estimate its position:
   - LEFT edge: 0-640 pixels (left half) or 640-1280 pixels (right half)
   - TOP edge: 0-360 pixels (top half) or 360-720 pixels (bottom half)

3. To find the button coordinates:
   - Locate the button's LEFT edge (pixels from left side)
   - Locate the button's RIGHT edge (pixels from left side)
   - Calculate CENTER X: (left_edge + right_edge) / 2
   - Locate the button's TOP edge (pixels from top)
   - Locate the button's BOTTOM edge (pixels from top)
   - Calculate CENTER Y: (top_edge + bottom_edge) / 2

CRITICAL RULES:
- If the button is in the LOWER half of the screen, Y MUST be > 360
- If the button is in the UPPER half of the screen, Y MUST be < 360
- If the button is on the LEFT side, X MUST be < 640
- If the button is on the RIGHT side, X MUST be > 640
- ONLY return (640, 360) if the button is EXACTLY centered both horizontally AND vertically
- Do NOT default to (640, 360) - measure the actual button position

Return your response as a JSON object:
{
  "found": boolean,
  "x": number (EXACT horizontal pixel position of button center, or null if not found),
  "y": number (EXACT vertical pixel position of button center, or null if not found),
  "description": string (describe what you see: button text, location, appearance, OR why you cannot find a start button),
  "reasoning": string (REQUIRED - MUST include: 1) List ALL visible elements and their approximate positions, 2) Button's measured edges (left, right, top, bottom), 3) Calculated center coordinates, 4) Where other elements are relative to button (button is ABOVE/BELOW/LEFT/RIGHT of what?), 5) Why these specific coordinates)
}`;

    const userPrompt = `Analyze this game screenshot and find the start/play button. 

FIRST: Before giving coordinates, describe WHERE elements are:
- Is the game title at the top? Where exactly (left, center, right)?
- Are player instructions visible? Where are they positioned?
- Where is the start button relative to these elements? (above them? below them? between them?)

THEN: Measure the button's position:
- Look at the button's LEFT edge - how many pixels from the left side?
- Look at the button's RIGHT edge - how many pixels from the left side?
- Look at the button's TOP edge - how many pixels from the top?
- Look at the button's BOTTOM edge - how many pixels from the top?
- Calculate: center_x = (left + right) / 2
- Calculate: center_y = (top + bottom) / 2

VERIFY: If you get (640, 360), double-check:
- Is the button really at the exact center of a 1280x720 viewport?
- Where is it relative to other elements? (If button is BELOW the title, Y must be > 300)
- If the button says "START MATCH" and appears below "Player 1: W/S" text, Y should be around 400-500, NOT 360

Return the EXACT measured coordinates. Do NOT guess or default to viewport center.`;

    const response = await openaiClient.chat.completions.create({
      model: visionModel,
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
      temperature: 0.5, // Balanced temperature for accurate but varied detection
      max_tokens: 800, // Allow for detailed descriptions and reasoning
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warn('No response content from vision model for start button detection', { model: visionModel });
      return null;
    }

    // Log the raw response for debugging
    logger.info('Vision model raw response for start button detection', {
      model: visionModel,
      rawResponse: content,
    });
    console.log(`\n🤖 ${visionModel} Vision Response:`);
    console.log(content);
    console.log('');

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
      logger.info('Start button not found or invalid coordinates', {
        found: result.found,
        x: result.x,
        y: result.y,
        xType: typeof result.x,
        yType: typeof result.y,
        description: result.description || 'No description',
        reasoning: result.reasoning || 'No reasoning provided',
      });
      
      // Log reasoning even when button not found
      if (result.reasoning) {
        logger.debug('Vision model reasoning (button not found)', {
          reasoning: result.reasoning,
        });
        console.log('\n🧠 Vision Model Reasoning:');
        console.log(result.reasoning);
        console.log('');
      }
      
      return null;
    }

    // Clamp coordinates to viewport bounds
    const x = Math.max(0, Math.min(1279, Math.round(result.x)));
    const y = Math.max(0, Math.min(719, Math.round(result.y)));

    // Warn if coordinates are suspiciously close to viewport center
    if (Math.abs(x - 640) < 10 && Math.abs(y - 360) < 10) {
      logger.error('Start button coordinates are suspiciously close to viewport center - LLM may be guessing', {
        x,
        y,
        description: result.description || 'No description',
        reasoning: result.reasoning || 'No reasoning provided',
      });
      console.log('\n🚨 CRITICAL WARNING: Coordinates (', x, ',', y, ') are very close to viewport center (640, 360)');
      console.log('   This strongly suggests the LLM is defaulting to center rather than measuring the button.');
      console.log('   Please verify the reasoning explains HOW the button was measured, not just ASSUMED to be centered.');
      
      if (result.reasoning) {
        console.log('\n   Reasoning provided:');
        console.log('   ' + result.reasoning.split('\n').join('\n   '));
      }
    }

    logger.info('Start button found by vision', {
      x,
      y,
      description: result.description || 'No description',
      reasoning: result.reasoning || 'No reasoning provided',
    });

    // Log reasoning for debugging
    if (result.reasoning) {
      logger.debug('Vision model reasoning', {
        reasoning: result.reasoning,
      });
      console.log('\n🧠 Vision Model Reasoning:');
      console.log(result.reasoning);
      console.log('');
    }

    return { x, y };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to find start button coordinates', {
      error: message,
    });
    return null;
  }
}

