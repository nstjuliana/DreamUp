/**
 * File: src/utils/config.ts
 * 
 * Configuration management for the DreamUp QA Pipeline.
 * 
 * This module handles loading and validating environment variables on startup.
 * It ensures all required configuration is present and properly typed before
 * the application runs.
 * 
 * @module Config
 */

import { ConfigurationError } from './errors.js';
import { LLM_PROVIDERS } from './constants.js';

/**
 * Application configuration interface.
 * 
 * Represents all configuration values loaded from environment variables.
 * All values are validated and type-safe.
 * 
 * Supabase keys support both new format (sb_publishable_.../sb_secret_...) 
 * and legacy format (anon/service_role) for backward compatibility.
 */
export interface Config {
  supabase: {
    url: string;
    anonKey: string; // Accepts both new (sb_publishable_...) and legacy (anon) keys
    serviceRoleKey: string; // Accepts both new (sb_secret_...) and legacy (service_role) keys
  };
  llm: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model?: string;
  };
}

/**
 * Get required environment variable.
 * 
 * @param {string} name - Environment variable name
 * @returns {string} Environment variable value
 * @throws {ConfigurationError} If environment variable is missing
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(
      `Missing required environment variable: ${name}`,
      { variable: name }
    );
  }
  return value;
}

/**
 * Get optional environment variable.
 * 
 * @param {string} name - Environment variable name
 * @param {string} [defaultValue] - Default value if not set
 * @returns {string | undefined} Environment variable value or default
 */
function getOptionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

/**
 * Validate LLM provider value.
 * 
 * @param {string} provider - Provider value to validate
 * @returns {'openai' | 'anthropic'} Validated provider
 * @throws {ConfigurationError} If provider is invalid
 */
function validateLLMProvider(provider: string): 'openai' | 'anthropic' {
  if (!LLM_PROVIDERS.includes(provider as any)) {
    throw new ConfigurationError(
      `Invalid LLM_PROVIDER: ${provider}. Must be one of: ${LLM_PROVIDERS.join(', ')}`,
      { provider, validProviders: LLM_PROVIDERS }
    );
  }
  return provider as 'openai' | 'anthropic';
}

/**
 * Validate URL format.
 * 
 * @param {string} url - URL to validate
 * @param {string} name - Name of the configuration field (for error messages)
 * @returns {string} Validated URL
 * @throws {ConfigurationError} If URL is invalid
 */
function validateUrl(url: string, name: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    throw new ConfigurationError(
      `Invalid URL format for ${name}: ${url}`,
      { field: name, url }
    );
  }
}

/**
 * Get LLM API key based on provider.
 * 
 * @param {string} provider - LLM provider name
 * @returns {string} API key for the provider
 * @throws {ConfigurationError} If API key is missing
 */
function getLLMApiKey(provider: string): string {
  if (provider === 'openai') {
    return getRequiredEnv('OPENAI_API_KEY');
  } else if (provider === 'anthropic') {
    return getRequiredEnv('ANTHROPIC_API_KEY');
  }
  throw new ConfigurationError(
    `Unsupported LLM provider: ${provider}`,
    { provider }
  );
}

/**
 * Get Supabase API key with support for both new and legacy formats.
 * 
 * Supports:
 * - New format: SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) or SUPABASE_SECRET_KEY (sb_secret_...)
 * - Legacy format: SUPABASE_ANON_KEY (anon) or SUPABASE_SERVICE_ROLE_KEY (service_role)
 * 
 * New keys take priority over legacy keys if both are provided.
 * 
 * @param {string} newKeyName - Name of the new format env var
 * @param {string} legacyKeyName - Name of the legacy format env var
 * @param {string} keyDescription - Description for error messages
 * @returns {string} API key value
 * @throws {ConfigurationError} If neither key is found
 */
function getSupabaseKey(
  newKeyName: string,
  legacyKeyName: string,
  keyDescription: string
): string {
  // Try new format first
  const newKey = process.env[newKeyName];
  if (newKey) {
    return newKey;
  }
  
  // Fall back to legacy format
  const legacyKey = process.env[legacyKeyName];
  if (legacyKey) {
    return legacyKey;
  }
  
  // Neither found, throw error
  throw new ConfigurationError(
    `Missing required Supabase ${keyDescription}. Please provide either ${newKeyName} (recommended) or ${legacyKeyName} (legacy).`,
    { newKeyName, legacyKeyName, keyDescription }
  );
}

/**
 * Load and validate application configuration from environment variables.
 * 
 * Reads all required environment variables, validates their format and values,
 * and returns a type-safe configuration object.
 * 
 * Supabase keys support both new format (sb_publishable_.../sb_secret_...) 
 * and legacy format (anon/service_role) for backward compatibility.
 * 
 * @returns {Config} Validated configuration object
 * @throws {ConfigurationError} If any required variables are missing or invalid
 * 
 * @example
 * ```typescript
 * const config = loadConfig();
 * console.log(`Using Supabase at: ${config.supabase.url}`);
 * ```
 */
export function loadConfig(): Config {
  // Validate Supabase configuration
  const supabaseUrl = validateUrl(getRequiredEnv('SUPABASE_URL'), 'SUPABASE_URL');
  
  // Support both new and legacy key formats
  const supabaseAnonKey = getSupabaseKey(
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'publishable/anon key'
  );
  
  const supabaseServiceRoleKey = getSupabaseKey(
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'secret/service_role key'
  );

  // Validate LLM configuration
  const llmProviderRaw = getRequiredEnv('LLM_PROVIDER');
  const llmProvider = validateLLMProvider(llmProviderRaw);
  const llmApiKey = getLLMApiKey(llmProvider);
  const llmModel = getOptionalEnv('LLM_MODEL');

  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
    },
    llm: {
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmModel,
    },
  };
}

/**
 * Cached configuration instance.
 * Loaded once on first access to avoid re-validation.
 */
let cachedConfig: Config | null = null;

/**
 * Get application configuration.
 * 
 * Loads configuration from environment variables on first call,
 * then returns cached configuration on subsequent calls.
 * 
 * @returns {Config} Application configuration
 * @throws {ConfigurationError} If configuration is invalid
 * 
 * @example
 * ```typescript
 * const config = getConfig();
 * const client = createClient(config.supabase.url, config.supabase.anonKey);
 * ```
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

