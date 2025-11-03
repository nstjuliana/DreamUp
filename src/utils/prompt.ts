/**
 * File: src/utils/prompt.ts
 * 
 * Interactive CLI prompt utilities.
 * 
 * Provides functions for prompting user input in the command-line interface.
 * Uses Node.js built-in readline module for simple yes/no prompts.
 * 
 * @module Prompt
 */

import * as readline from 'readline';
import { logger } from './logger.js';

/**
 * Prompt user for yes/no confirmation.
 * 
 * Displays a question and waits for user input (y/n or yes/no).
 * Returns true if user confirms, false otherwise.
 * 
 * @param {string} question - Question to ask the user
 * @returns {Promise<boolean>} True if user confirmed, false otherwise
 * 
 * @example
 * ```typescript
 * const shouldCreate = await promptYesNo('Create game entry?');
 * if (shouldCreate) {
 *   // Create game
 * }
 * ```
 */
export async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      
      const normalized = answer.trim().toLowerCase();
      const confirmed = normalized === 'y' || normalized === 'yes';
      
      resolve(confirmed);
    });
  });
}

/**
 * Prompt user for text input.
 * 
 * Displays a question and waits for user input.
 * Returns the trimmed user input.
 * 
 * @param {string} question - Question to ask the user
 * @param {string} [defaultValue] - Default value if user presses Enter
 * @returns {Promise<string>} User input or default value
 * 
 * @example
 * ```typescript
 * const gameName = await promptText('Enter game name:', 'My Game');
 * ```
 */
export async function promptText(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptText = defaultValue 
    ? `${question} [${defaultValue}]: `
    : `${question}: `;

  return new Promise<string>((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      
      const trimmed = answer.trim();
      const result = trimmed || defaultValue || '';
      
      resolve(result);
    });
  });
}

