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
 * Prompt user to select from a list of options.
 * 
 * Displays a numbered list of options and waits for user to select one.
 * Returns the selected option index (0-based).
 * 
 * @param {string} question - Question to ask the user
 * @param {Array<{label: string, value: unknown}>} options - Array of options with labels
 * @param {number} [defaultIndex] - Default selection index (0-based)
 * @returns {Promise<number>} Selected option index
 * 
 * @example
 * ```typescript
 * const options = [
 *   { label: 'Option 1', value: 'opt1' },
 *   { label: 'Option 2', value: 'opt2' }
 * ];
 * const selected = await promptSelect('Choose an option:', options, 0);
 * const selectedValue = options[selected].value;
 * ```
 */
export async function promptSelect<T>(
  question: string,
  options: Array<{ label: string; value: T }>,
  defaultIndex?: number
): Promise<number> {
  if (options.length === 0) {
    throw new Error('Cannot prompt select with empty options');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Display options
  console.log(`\n${question}`);
  options.forEach((option, index) => {
    const marker = defaultIndex === index ? ' [default]' : '';
    console.log(`  [${index + 1}] ${option.label}${marker}`);
  });

  const defaultText = defaultIndex !== undefined ? ` [${defaultIndex + 1}]` : '';
  const promptText = `\nEnter selection${defaultText}: `;

  return new Promise<number>((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();

      const trimmed = answer.trim();
      
      // Use default if empty input
      if (!trimmed && defaultIndex !== undefined) {
        resolve(defaultIndex);
        return;
      }

      // Parse as number
      const selected = parseInt(trimmed, 10);
      
      if (isNaN(selected) || selected < 1 || selected > options.length) {
        // Invalid input, ask again
        console.log(`Invalid selection. Please enter a number between 1 and ${options.length}.`);
        // Recursively prompt again
        promptSelect(question, options, defaultIndex).then(resolve);
        return;
      }

      resolve(selected - 1); // Convert to 0-based index
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

