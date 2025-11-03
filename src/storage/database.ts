/**
 * File: src/storage/database.ts
 * 
 * Database client for Supabase operations.
 * 
 * This module provides a typed interface for interacting with the Supabase database.
 * It handles connections, queries, and CRUD operations for games, manifests, and test runs.
 * 
 * @module Database
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Game, GameManifest, TestRun, GameInsert, GameManifestInsert, TestRunInsert } from './types.js';
import { getConfig } from '../utils/config.js';
import { StorageError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Supabase client instance.
 */
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Initialize Supabase client.
 * 
 * Creates and configures a Supabase client using environment configuration.
 * Should be called once at application startup.
 * 
 * @returns {SupabaseClient<Database>} Configured Supabase client
 * 
 * @example
 * ```typescript
 * const client = initializeDatabase();
 * ```
 */
export function initializeDatabase(): SupabaseClient<Database> {
  const config = getConfig();
  
  supabaseClient = createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  logger.info('Database client initialized', { url: config.supabase.url });
  return supabaseClient;
}

/**
 * Get Supabase client instance.
 * 
 * Returns existing client or initializes a new one if needed.
 * 
 * @returns {SupabaseClient<Database>} Supabase client instance
 */
export function getDatabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    return initializeDatabase();
  }
  return supabaseClient;
}

/**
 * Find game by URL.
 * 
 * @param {string} gameUrl - Game URL to search for
 * @returns {Promise<Game | null>} Game record or null if not found
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const game = await findGameByUrl('https://example.com/game');
 * if (game) {
 *   console.log(`Found game: ${game.name}`);
 * }
 * ```
 */
export async function findGameByUrl(gameUrl: string): Promise<Game | null> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('games')
    .select('*')
    .eq('game_url', gameUrl)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    logger.error('Failed to find game by URL', { gameUrl, error: error.message });
    throw new StorageError(`Failed to find game: ${error.message}`, { gameUrl, error });
  }

  return data;
}

/**
 * Create a new game record.
 * 
 * @param {GameInsert} game - Game data to insert
 * @returns {Promise<Game>} Created game record
 * @throws {StorageError} If database insert fails
 * 
 * @example
 * ```typescript
 * const game = await createGame({
 *   game_url: 'https://example.com/game',
 *   name: 'My Game',
 *   game_type: 'platformer'
 * });
 * ```
 */
export async function createGame(game: GameInsert): Promise<Game> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('games')
    .insert(game as any)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create game', { game, error: error?.message });
    throw new StorageError(`Failed to create game: ${error?.message}`, { game, error });
  }

  logger.info('Game created', { gameId: (data as any).id, name: (data as any).name });
  return data as Game;
}

/**
 * Get active manifest for a game.
 * 
 * @param {string} gameId - Game ID
 * @returns {Promise<GameManifest | null>} Active manifest or null if none
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const manifest = await getActiveManifest(gameId);
 * ```
 */
export async function getActiveManifest(gameId: string): Promise<GameManifest | null> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('game_manifests')
    .select('*')
    .eq('game_id', gameId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to get active manifest', { gameId, error: error.message });
    throw new StorageError(`Failed to get active manifest: ${error.message}`, { gameId, error });
  }

  return data;
}

/**
 * Create a new manifest version.
 * 
 * @param {GameManifestInsert} manifest - Manifest data to insert
 * @returns {Promise<GameManifest>} Created manifest record
 * @throws {StorageError} If database insert fails
 * 
 * @example
 * ```typescript
 * const manifest = await createManifest({
 *   game_id: gameId,
 *   version_name: 'v1.0',
 *   manifest_data: { ... },
 *   is_active: true
 * });
 * ```
 */
export async function createManifest(manifest: GameManifestInsert): Promise<GameManifest> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('game_manifests')
    .insert(manifest as any)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create manifest', { manifest, error: error?.message });
    throw new StorageError(`Failed to create manifest: ${error?.message}`, { manifest, error });
  }

  logger.info('Manifest created', { manifestId: (data as any).id, version: (data as any).version_name });
  return data as GameManifest;
}

/**
 * Save test run results to database.
 * 
 * @param {TestRunInsert} testRun - Test run data to insert
 * @returns {Promise<TestRun>} Created test run record
 * @throws {StorageError} If database insert fails
 * 
 * @example
 * ```typescript
 * const result = await saveTestRun({
 *   game_id: gameId,
 *   manifest_id: manifestId,
 *   status: 'pass',
 *   playability_score: 85,
 *   execution_method: 'cli'
 * });
 * ```
 */
export async function saveTestRun(testRun: TestRunInsert): Promise<TestRun> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('test_runs')
    .insert(testRun as any)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to save test run', { testRun, error: error?.message });
    throw new StorageError(`Failed to save test run: ${error?.message}`, { testRun, error });
  }

  logger.info('Test run saved', { testRunId: (data as any).id, status: (data as any).status });
  return data as TestRun;
}

/**
 * Get test run history for a game.
 * 
 * @param {string} gameId - Game ID
 * @param {number} [limit=50] - Maximum number of results to return
 * @returns {Promise<TestRun[]>} Array of test run records
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const history = await getTestHistory(gameId, 10);
 * console.log(`Found ${history.length} test runs`);
 * ```
 */
export async function getTestHistory(gameId: string, limit = 50): Promise<TestRun[]> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('test_runs')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to get test history', { gameId, error: error.message });
    throw new StorageError(`Failed to get test history: ${error.message}`, { gameId, error });
  }

  return data || [];
}

/**
 * List all games.
 * 
 * @param {number} [limit=100] - Maximum number of results to return
 * @returns {Promise<Game[]>} Array of game records
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const games = await listGames();
 * console.log(`Found ${games.length} games`);
 * ```
 */
export async function listGames(limit = 100): Promise<Game[]> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to list games', { error: error.message });
    throw new StorageError(`Failed to list games: ${error.message}`, { error });
  }

  return data || [];
}

