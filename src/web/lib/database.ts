/**
 * Database utilities for web app.
 * Re-exports database functions from the shared storage module.
 */

export {
  getDatabase,
  initializeDatabase,
  findGameByUrl,
  createGame,
  getManifestsForGame,
  getManifestByVersion,
  getActiveManifest,
  createManifest,
  saveTestRun,
  getTestHistory,
  listGames,
} from '@shared/storage/database'

export type {
  Game,
  GameInsert,
  GameUpdate,
  GameManifest,
  GameManifestInsert,
  GameManifestUpdate,
  TestRun,
  TestRunInsert,
  TestRunUpdate,
  ManifestData,
  GameState,
  TestRunMetadata,
} from '@shared/storage/types'

