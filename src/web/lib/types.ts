/**
 * Type definitions for web app.
 * Re-exports types from shared modules.
 */

export type {
  TimelineEvent,
  TimelineEventType,
  Timeline,
} from '@shared/agent/timeline'

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
  Database,
} from '@shared/storage/types'

// Additional web-specific types
export interface TestRunWithDetails extends TestRun {
  game?: Game
  manifest?: GameManifest
}

export interface GameWithManifest extends Game {
  activeManifest?: GameManifest
  manifestCount?: number
  lastTestRun?: TestRun
}

