# Project Rules: DreamUp QA Pipeline

This document defines the coding standards, file organization, and development conventions for the DreamUp QA Pipeline project. These rules ensure the codebase remains modular, scalable, and optimized for AI tool compatibility.

## Core Principles

1. **AI-First Design**: Code must be easily understood by AI tools and developers alike
2. **Modular Architecture**: Components should be self-contained and loosely coupled
3. **Maximum File Length**: Files must not exceed 500 lines for AI tool compatibility
4. **Comprehensive Documentation**: All files and functions must be well-documented
5. **Type Safety**: TypeScript strict mode with proper type definitions
6. **Error Handling**: Graceful error handling at every level

---

## Directory Structure

The project follows a modular, feature-based structure:

```
dreamup-qa/
├── src/
│   ├── agent/              # Core QA agent orchestration
│   │   ├── qa-agent.ts     # Main agent controller
│   │   ├── agent-state.ts  # Agent state management
│   │   └── agent-config.ts  # Agent configuration
│   │
│   ├── browser/            # Browser automation module
│   │   ├── browser-client.ts        # Browserbase client wrapper
│   │   ├── stagehand-handler.ts     # Stagehand integration
│   │   ├── screenshot-capture.ts    # Screenshot utilities
│   │   ├── console-logger.ts        # Console log collection
│   │   └── ui-pattern-detector.ts   # UI pattern detection
│   │
│   ├── evaluation/         # LLM evaluation module
│   │   ├── llm-evaluator.ts         # LLM evaluation logic
│   │   ├── prompt-builder.ts        # Prompt construction
│   │   ├── result-parser.ts         # Parse LLM responses
│   │   └── fallback-heuristics.ts   # Fallback assessment
│   │
│   ├── storage/            # Database and file storage operations
│   │   ├── database.ts              # Supabase database client
│   │   ├── file-storage.ts          # Supabase Storage operations
│   │   ├── types.ts                 # Database types
│   │   └── migrations/              # Database migrations (if needed)
│   │
│   ├── cli/                # CLI command definitions
│   │   ├── commands.ts              # Command definitions
│   │   ├── parser.ts                # Argument parsing logic
│   │   └── output-formatter.ts      # CLI output formatting
│   │
│   ├── lambda/             # Lambda-specific handlers
│   │   ├── handler.ts               # Main Lambda handler
│   │   └── event-types.ts           # Event type definitions
│   │
│   └── utils/              # Shared utilities
│       ├── validation.ts            # Input validation
│       ├── errors.ts                # Custom error classes
│       ├── constants.ts             # Application constants
│       └── logger.ts                # Logging utility
│
├── artifacts/               # Local artifact storage (optional fallback)
│   └── .gitkeep
│
├── _docs/                   # Project documentation
│   ├── DreamUp - Gauntlet C3 Project 1.md
│   ├── user-flow.md
│   ├── tech-stack.md
│   └── project-rules.md
│
├── qa.ts                    # Main CLI entry point
├── lambda.ts                # Lambda entry point (if separate)
├── package-lock.json        # npm lock file (commit this)
├── package.json
├── tsconfig.json
├── .env.example             # Environment variable template
└── README.md
```

### Directory Organization Rules

- **Feature-based modules**: Each directory (`agent/`, `browser/`, `evaluation/`, etc.) represents a cohesive feature or concern
- **Single responsibility**: Each directory has a clear, single purpose
- **Flat structure within modules**: Avoid deeply nested subdirectories (max 2-3 levels)
- **Shared utilities**: Common code goes in `utils/`, not duplicated across modules
- **Entry points**: Main entry points (`qa.ts`, `lambda.ts`) stay at root level

---

## File Naming Conventions

### TypeScript Files

- **Format**: `kebab-case.ts` (lowercase with hyphens)
- **Examples**:
  - `qa-agent.ts` ✅
  - `screenshot-capture.ts` ✅
  - `llm-evaluator.ts` ✅
  - `database-client.ts` ✅

- **Avoid**:
  - `QAagent.ts` ❌ (mixed case)
  - `screenshotCapture.ts` ❌ (camelCase)
  - `screenshot_capture.ts` ❌ (snake_case)

### File Type Suffixes

- **Implementation files**: `.ts`
- **Type definition files**: `.types.ts` (when separate from implementation)
- **Configuration files**: `.config.ts`
- **Test files**: Not applicable (testing removed from stack)

### Naming Guidelines

- **Be descriptive**: File names should clearly indicate their purpose
- **Match exports**: File name should match the primary export (e.g., `qa-agent.ts` exports `QAAgent`)
- **Avoid abbreviations**: Use full words unless abbreviation is universally understood (e.g., `cli` is acceptable, `qa` is acceptable)
- **Group related files**: Related utilities can share a prefix (e.g., `browser-client.ts`, `browser-config.ts`)

---

## File Structure Template

Every TypeScript file must follow this structure:

```typescript
/**
 * File: src/[module]/[filename].ts
 * 
 * [Brief description of what this file does]
 * 
 * This module handles [specific responsibilities].
 * It interacts with [other modules/APIs] and provides [key functionality].
 * 
 * @module [ModuleName]
 */

// Imports (grouped and alphabetized)
import { ... } from 'external-packages';
import { ... } from '../other-module/file';

// Type definitions (if needed, before implementation)
export interface ExampleType {
  // ...
}

// Constants (if needed)
const EXAMPLE_CONSTANT = 'value';

/**
 * [Function name]
 * 
 * [Detailed description of what the function does]
 * 
 * @param {Type} paramName - Description of parameter
 * @param {Type} [optionalParam] - Description of optional parameter
 * @returns {ReturnType} Description of return value
 * @throws {ErrorType} When/why this error is thrown
 * 
 * @example
 * ```typescript
 * const result = exampleFunction('input');
 * ```
 */
export function exampleFunction(paramName: string): ReturnType {
  // Implementation
}
```

### Required File Header

Every file **must** start with:
1. **File path comment**: `/** File: src/[path] */`
2. **Brief description**: One-line summary of file purpose
3. **Detailed description**: 2-3 sentences explaining responsibilities and interactions
4. **Module tag**: `@module [ModuleName]`

---

## Function Documentation

All functions, including private/internal ones, must have JSDoc/TSDoc comments.

### Required Documentation Elements

```typescript
/**
 * Captures a screenshot from the browser at the current state.
 * 
 * Takes a screenshot using the Browserbase API and saves it to Supabase Storage.
 * Automatically adds timestamp to filename and handles upload failures gracefully.
 * 
 * @param {BrowserSession} session - Active browser session object
 * @param {string} testId - Unique identifier for the test run
 * @param {number} [index] - Optional index for ordering multiple screenshots
 * @returns {Promise<string>} URL of uploaded screenshot in Supabase Storage
 * @throws {ScreenshotError} If screenshot capture or upload fails
 * 
 * @example
 * ```typescript
 * const screenshotUrl = await captureScreenshot(session, 'test-123', 0);
 * console.log(`Screenshot saved: ${screenshotUrl}`);
 * ```
 */
async function captureScreenshot(
  session: BrowserSession,
  testId: string,
  index?: number
): Promise<string> {
  // Implementation
}
```

### Documentation Requirements

- **Description**: Clear explanation of what the function does
- **@param tags**: Every parameter documented with type and description
- **@returns tag**: Return type and description (even if `void`)
- **@throws tags**: All possible errors/exceptions
- **@example**: Code example for complex functions (optional but recommended)

### Function Naming

- **Format**: `camelCase` for function names
- **Verbs for actions**: Functions should be named with action verbs
  - `captureScreenshot()` ✅
  - `evaluateGame()` ✅
  - `saveResults()` ✅
- **Boolean returns**: Use `is*`, `has*`, `should*`, `can*` prefixes
  - `isGameLoaded()` ✅
  - `hasErrors()` ✅
- **Avoid**: Generic names like `process()`, `handle()`, `doWork()`

---

## Code Organization

### Import Organization

1. **External packages** (alphabetized)
2. **Internal modules** (relative paths, grouped by module)
3. **Type imports** (use `import type { ... }` for types only)

```typescript
// External packages
import { program } from 'commander';
import { createClient } from '@supabase/supabase-js';

// Internal modules - relative imports
import { QAAgent } from '../agent/qa-agent';
import { BrowserClient } from '../browser/browser-client';
import { captureScreenshot } from '../browser/screenshot-capture';

// Type imports
import type { TestResult } from '../storage/types';
import type { AgentConfig } from '../agent/agent-config';
```

### Export Organization

- **Single primary export**: Each file typically has one main export (class, function, or object)
- **Named exports**: Use named exports for utilities and helpers
- **Default exports**: Avoid default exports except for entry points

### Function Organization Within File

1. **Type definitions** (if file-scoped)
2. **Constants**
3. **Private/helper functions** (alphabetical or logical grouping)
4. **Public/exported functions** (most important first)
5. **Default export** (if applicable, at end)

---

## TypeScript Conventions

### Type Definitions

- **Interfaces over types**: Prefer `interface` for object shapes (extensible)
- **Types for unions/intersections**: Use `type` for complex type operations
- **Explicit types**: Avoid `any`, use `unknown` for truly unknown types
- **Strict mode**: Always use TypeScript strict mode

```typescript
// Good: Interface for object shape
export interface TestResult {
  status: 'pass' | 'fail' | 'error';
  playabilityScore: number;
  issues: string[];
}

// Good: Type for union
export type TestStatus = 'pass' | 'fail' | 'error';

// Avoid: Using any
function process(data: any) { } // ❌
function process(data: unknown) { } // ✅
```

### Error Handling

- **Custom error classes**: Extend `Error` for specific error types
- **Error context**: Always include relevant context in error messages
- **Error propagation**: Let errors bubble up unless you can handle them meaningfully

```typescript
// Custom error class
export class ScreenshotError extends Error {
  constructor(
    message: string,
    public readonly testId: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

// Usage
try {
  await captureScreenshot(session, testId);
} catch (error) {
  throw new ScreenshotError(
    `Failed to capture screenshot for test ${testId}`,
    testId,
    error instanceof Error ? error : undefined
  );
}
```

### Async/Await

- **Always use async/await**: Avoid `.then()/.catch()` chains
- **Error handling**: Wrap async operations in try-catch blocks
- **Promise types**: Explicitly type Promise returns

```typescript
// Good
async function loadGame(url: string): Promise<void> {
  try {
    await browser.goto(url);
    await browser.waitForLoadState('networkidle');
  } catch (error) {
    throw new GameLoadError(`Failed to load game: ${url}`, error);
  }
}
```

---

## Code Style Guidelines

### General Principles

- **Functional over imperative**: Prefer functional programming patterns
- **Pure functions**: Functions should have minimal side effects
- **Descriptive names**: Variable and function names should be self-documenting
- **Avoid magic numbers**: Use named constants
- **Single responsibility**: Functions should do one thing well

### Formatting

- **Indentation**: 2 spaces (TypeScript default)
- **Line length**: Prefer < 100 characters, max 120
- **Trailing commas**: Use trailing commas in multi-line arrays/objects
- **Semicolons**: Use semicolons consistently

### Constants and Configuration

- **Application constants**: Store in `src/utils/constants.ts`
- **Environment variables**: Access via `process.env`, validate on startup
- **Magic values**: Extract to named constants with comments

```typescript
// constants.ts
export const MAX_EXECUTION_TIME_MS = 5 * 60 * 1000; // 5 minutes per spec
export const MAX_RETRY_ATTEMPTS = 3;
export const SCREENSHOT_COUNT = 5; // 3-5 per spec, using 5 as max
```

---

## Module Boundaries and Dependencies

### Module Responsibilities

- **agent/**: Orchestrates the QA workflow (Initialize → Observe → Interact → Monitor → Evaluate → Report)
- **browser/**: All browser automation logic (Browserbase, Stagehand, screenshots, logs)
- **evaluation/**: LLM integration and game assessment
- **storage/**: Database and file storage operations (Supabase)
- **cli/**: CLI-specific logic (parsing, output formatting)
- **lambda/**: Lambda-specific handlers and event processing
- **utils/**: Shared utilities used across modules

### Dependency Rules

- **No circular dependencies**: Module A cannot import from Module B if B imports from A
- **Dependency direction**: `agent/` depends on others, but others don't depend on `agent/`
- **Utils are shared**: `utils/` has no dependencies on feature modules
- **Storage is independent**: `storage/` should not depend on browser/evaluation logic

### Import Rules

- **Absolute imports**: Use relative imports (`../`, `../../`) within `src/`
- **No barrel exports**: Avoid `index.ts` files that re-export everything (harder for AI tools to navigate)
- **Explicit imports**: Import exactly what you need, avoid wildcard imports

---

## File Length Management

### 500-Line Maximum Rule

**Critical**: All files must stay under 500 lines for AI tool compatibility.

### Strategies for Staying Under 500 Lines

1. **Extract utilities**: Move helper functions to separate files
2. **Split large classes**: Break complex classes into smaller, focused classes
3. **Separate types**: Move type definitions to `.types.ts` files if needed
4. **Extract constants**: Move constants to `constants.ts`
5. **Break into logical modules**: If a file handles multiple concerns, split by concern

### When to Split a File

Split when:
- File exceeds 400 lines (leave buffer)
- File handles multiple distinct responsibilities
- File has many helper functions that could be reused elsewhere
- File has complex type definitions that clutter the implementation

### Refactoring Checklist

Before splitting:
- ✅ Identify distinct responsibilities
- ✅ Determine dependencies between parts
- ✅ Plan import/export structure
- ✅ Ensure no circular dependencies introduced

---

## Error Handling Standards

### Error Types

Create custom error classes for different error scenarios:

```typescript
// src/utils/errors.ts

export class QAAgentError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = 'QAAgentError';
  }
}

export class BrowserError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'BrowserError';
  }
}

export class EvaluationError extends QAAgentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'EvaluationError';
  }
}
```

### Error Handling Patterns

- **Fail fast**: Validate inputs early, throw errors immediately
- **Context preservation**: Include relevant context in error messages
- **Error boundaries**: Catch errors at module boundaries, transform to module-specific errors
- **Logging**: Log errors with full context before re-throwing

---

## Logging and Debugging

### Logging Standards

- **Use structured logging**: Include relevant context (testId, module, etc.)
- **Log levels**: Use appropriate levels (debug, info, warn, error)
- **Sensitive data**: Never log API keys, tokens, or personal information
- **Performance**: Log timing information for expensive operations

```typescript
import { logger } from '../utils/logger';

logger.info('Starting QA test', { testId, gameUrl });
logger.debug('Browser session initialized', { sessionId });
logger.warn('Retry attempt', { attempt: retryCount, maxRetries });
logger.error('Test failed', { testId, error: error.message });
```

---

## Configuration Management

### Environment Variables

- **Validation**: Validate all required environment variables on startup
- **Type safety**: Create typed config object from environment variables
- **Documentation**: Document all environment variables in `.env.example`

```typescript
// src/utils/config.ts

export interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  browserbase: {
    apiKey: string;
    projectId: string;
  };
  llm: {
    apiKey: string;
  };
}

export function loadConfig(): Config {
  // Validate and return typed config
}
```

---

## Documentation Standards

### Code Comments

- **Why, not what**: Comments should explain "why", not "what" (code should be self-explanatory)
- **Complex logic**: Comment complex algorithms or business logic
- **Workarounds**: Document workarounds for bugs or limitations
- **TODOs**: Use `// TODO:` for planned improvements (with brief description)

### README Requirements

- Project overview
- Setup instructions
- Usage examples (CLI commands)
- Architecture overview
- Environment variable documentation

---

## Version Control

### Git Conventions

- **Commit messages**: Use conventional commits format
  - `feat: add screenshot capture functionality`
  - `fix: handle browser session timeout`
  - `docs: update README with setup instructions`
- **Branch naming**: `feature/`, `fix/`, `docs/` prefixes
- **Small commits**: Commit logical, cohesive changes
- **Commit frequency**: Commit working code frequently

### Files to Commit

- ✅ All source code (`src/`)
- ✅ Configuration files (`tsconfig.json`, `package.json`)
- ✅ Lock files (`package-lock.json`)
- ✅ Documentation (`_docs/`, `README.md`)
- ✅ `.env.example` (template, no secrets)

### Files to Ignore

- ❌ `.env` and `.env.local` (secrets)
- ❌ `node_modules/`
- ❌ `.bun/` (Bun cache - legacy, not used)
- ❌ `artifacts/` (generated files, unless `.gitkeep`)
- ❌ Build outputs

---

## Quality Checklist

Before considering code complete:

- [ ] File is under 500 lines
- [ ] File has proper header documentation
- [ ] All functions have JSDoc/TSDoc comments
- [ ] TypeScript strict mode passes
- [ ] No `any` types (use `unknown` if needed)
- [ ] Error handling implemented
- [ ] No circular dependencies
- [ ] Imports are organized
- [ ] Code follows naming conventions
- [ ] Constants extracted where appropriate
- [ ] No commented-out code (use git history instead)

---

## Additional Guidelines

### Performance Considerations

- **Async operations**: Use `Promise.all()` for parallel operations when possible
- **Resource cleanup**: Always close browser sessions, database connections
- **Timeouts**: Set appropriate timeouts for all async operations
- **Rate limiting**: Respect API rate limits (Browserbase, LLM providers)

### Security Considerations

- **Never commit secrets**: Use environment variables
- **Validate inputs**: Sanitize user inputs (URLs, file paths)
- **Error messages**: Don't leak sensitive information in error messages
- **API keys**: Store securely, use least-privilege access

### Maintainability

- **Refactor regularly**: Don't let technical debt accumulate
- **Update dependencies**: Keep dependencies up to date (security patches)
- **Code review**: Review code before merging (even solo projects)
- **Document decisions**: Comment on non-obvious architectural decisions

---

## Exceptions and Special Cases

If you find yourself needing to violate these rules:

1. **Document the exception**: Add a comment explaining why
2. **Consider alternatives**: Is there a way to refactor to avoid the exception?
3. **Future improvement**: Add a TODO to address the exception later

Example:

```typescript
/**
 * File: src/browser/browser-client.ts
 * 
 * Browserbase client wrapper for browser automation.
 * 
 * NOTE: This file is 520 lines due to extensive error handling for
 * various browser states. TODO: Extract error handling to separate
 * error-handler.ts module.
 */
```

---

## Summary

This codebase prioritizes:

1. **AI compatibility**: 500-line max, clear structure, comprehensive documentation
2. **Maintainability**: Modular design, clear naming, proper error handling
3. **Type safety**: TypeScript strict mode, explicit types, no `any`
4. **Documentation**: File headers, function docs, README
5. **Consistency**: Follow conventions consistently across the codebase

When in doubt, prioritize clarity and AI tool compatibility over brevity or cleverness.

