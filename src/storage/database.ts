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
import type { Database, Game, GameManifest, TestRun, GameInsert, GameManifestInsert, TestRunInsert, BatchReport, BatchReportInsert, BatchReportUpdate } from './types.js';
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
 * Get all manifests for a game.
 * 
 * @param {string} gameId - Game ID
 * @returns {Promise<GameManifest[]>} Array of all manifests for the game
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const manifests = await getManifestsForGame(gameId);
 * console.log(`Found ${manifests.length} manifests`);
 * ```
 */
export async function getManifestsForGame(gameId: string): Promise<GameManifest[]> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('game_manifests')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to get manifests for game', { gameId, error: error.message });
    throw new StorageError(`Failed to get manifests for game: ${error.message}`, { gameId, error });
  }

  return data || [];
}

/**
 * Get manifest by version name.
 * 
 * @param {string} gameId - Game ID
 * @param {string} versionName - Manifest version name (e.g., 'v1.0')
 * @returns {Promise<GameManifest | null>} Manifest or null if not found
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const manifest = await getManifestByVersion(gameId, 'v1.0');
 * ```
 */
export async function getManifestByVersion(gameId: string, versionName: string): Promise<GameManifest | null> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('game_manifests')
    .select('*')
    .eq('game_id', gameId)
    .eq('version_name', versionName)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to get manifest by version', { gameId, versionName, error: error.message });
    throw new StorageError(`Failed to get manifest by version: ${error.message}`, { gameId, versionName, error });
  }

  return data;
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

/**
 * Create a new batch report.
 * 
 * @param {BatchReportInsert} batchReport - Batch report data to insert
 * @returns {Promise<BatchReport>} Created batch report record
 * @throws {StorageError} If database insert fails
 * 
 * @example
 * ```typescript
 * const batchReport = await createBatchReport({
 *   batch_name: 'Nightly Tests',
 *   status: 'running',
 *   total_tests: 10,
 *   execution_method: 'cli'
 * });
 * ```
 */
export async function createBatchReport(batchReport: BatchReportInsert): Promise<BatchReport> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('batch_reports')
    .insert(batchReport as any)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create batch report', { batchReport, error: error?.message });
    throw new StorageError(`Failed to create batch report: ${error?.message}`, { batchReport, error });
  }

  logger.info('Batch report created', { batchReportId: (data as any).id, status: (data as any).status });
  return data as BatchReport;
}

/**
 * Update an existing batch report.
 * 
 * @param {string} id - Batch report ID
 * @param {BatchReportUpdate} updates - Fields to update
 * @returns {Promise<BatchReport>} Updated batch report record
 * @throws {StorageError} If database update fails
 * 
 * @example
 * ```typescript
 * const updated = await updateBatchReport(batchId, {
 *   status: 'completed',
 *   completed_at: new Date().toISOString()
 * });
 * ```
 */
export async function updateBatchReport(id: string, updates: BatchReportUpdate): Promise<BatchReport> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('batch_reports')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to update batch report', { id, updates, error: error?.message });
    throw new StorageError(`Failed to update batch report: ${error?.message}`, { id, updates, error });
  }

  logger.info('Batch report updated', { batchReportId: id, status: (data as any).status });
  return data as BatchReport;
}

/**
 * Get a batch report by ID.
 * 
 * @param {string} id - Batch report ID
 * @returns {Promise<BatchReport | null>} Batch report or null if not found
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const batchReport = await getBatchReport(batchId);
 * ```
 */
export async function getBatchReport(id: string): Promise<BatchReport | null> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('batch_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to get batch report', { id, error: error.message });
    throw new StorageError(`Failed to get batch report: ${error.message}`, { id, error });
  }

  return data;
}

/**
 * Get a batch report with all associated test runs.
 * 
 * @param {string} id - Batch report ID
 * @returns {Promise<BatchReport & { test_runs: TestRun[] } | null>} Batch report with test runs or null if not found
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const batchReport = await getBatchReportWithTests(batchId);
 * console.log(`Found ${batchReport.test_runs.length} test runs`);
 * ```
 */
export async function getBatchReportWithTests(id: string): Promise<(BatchReport & { test_runs: TestRun[] }) | null> {
  const db = getDatabase();
  
  const { data: batchReport, error: batchError } = await db
    .from('batch_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (batchError && batchError.code !== 'PGRST116') {
    logger.error('Failed to get batch report', { id, error: batchError.message });
    throw new StorageError(`Failed to get batch report: ${batchError.message}`, { id, error: batchError });
  }

  if (!batchReport) {
    return null;
  }

  // Fetch all test runs for this batch
  if (batchReport.test_run_ids && batchReport.test_run_ids.length > 0) {
    const { data: testRuns, error: testRunsError } = await db
      .from('test_runs')
      .select('*')
      .in('id', batchReport.test_run_ids);

    if (testRunsError) {
      logger.error('Failed to get test runs for batch', { id, error: testRunsError.message });
      throw new StorageError(`Failed to get test runs: ${testRunsError.message}`, { id, error: testRunsError });
    }

    return {
      ...(batchReport as BatchReport),
      test_runs: testRuns || [],
    };
  }

  return {
    ...(batchReport as BatchReport),
    test_runs: [],
  };
}

/**
 * List all batch reports.
 * 
 * @param {number} [limit=50] - Maximum number of results to return
 * @returns {Promise<BatchReport[]>} Array of batch report records
 * @throws {StorageError} If database query fails
 * 
 * @example
 * ```typescript
 * const batches = await listBatchReports(20);
 * console.log(`Found ${batches.length} batch reports`);
 * ```
 */
export async function listBatchReports(limit = 50): Promise<BatchReport[]> {
  const db = getDatabase();
  
  const { data, error } = await db
    .from('batch_reports')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to list batch reports', { error: error.message });
    throw new StorageError(`Failed to list batch reports: ${error.message}`, { error });
  }

  return data || [];
}

