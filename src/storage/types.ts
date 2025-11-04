/**
 * File: src/storage/types.ts
 * 
 * TypeScript types generated from Supabase database schema.
 * 
 * This file contains type definitions for all database tables (games, game_manifests, test_runs).
 * These types are auto-generated from the Supabase schema using the Supabase CLI.
 * 
 * To regenerate after schema changes:
 * npx supabase gen types typescript --project-id <your-project-id> > src/storage/types.ts
 * 
 * @module StorageTypes
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          game_url: string;
          name: string;
          game_type: 'puzzle' | 'platformer' | 'idle' | 'shooter' | 'rpg' | 'other' | null;
          description: string | null;
          active_manifest_id: string | null;
          created_at: string;
          updated_at: string;
          last_tested_at: string | null;
        };
        Insert: {
          id?: string;
          game_url: string;
          name: string;
          game_type?: 'puzzle' | 'platformer' | 'idle' | 'shooter' | 'rpg' | 'other' | null;
          description?: string | null;
          active_manifest_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_tested_at?: string | null;
        };
        Update: {
          id?: string;
          game_url?: string;
          name?: string;
          game_type?: 'puzzle' | 'platformer' | 'idle' | 'shooter' | 'rpg' | 'other' | null;
          description?: string | null;
          active_manifest_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_tested_at?: string | null;
        };
      };
      game_manifests: {
        Row: {
          id: string;
          game_id: string;
          version_name: string;
          manifest_data: Json;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          version_name: string;
          manifest_data: Json;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          version_name?: string;
          manifest_data?: Json;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          notes?: string | null;
        };
      };
      test_runs: {
        Row: {
          id: string;
          game_id: string;
          manifest_id: string | null;
          status: 'pass' | 'fail' | 'error' | 'timeout';
          playability_score: number | null;
          issues: Json;
          screenshots: string[];
          console_logs: string | null;
          execution_method: 'cli' | 'lambda' | 'web' | null;
          duration_ms: number | null;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          game_id: string;
          manifest_id?: string | null;
          status: 'pass' | 'fail' | 'error' | 'timeout';
          playability_score?: number | null;
          issues?: Json;
          screenshots?: string[];
          console_logs?: string | null;
          execution_method?: 'cli' | 'lambda' | 'web' | null;
          duration_ms?: number | null;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          game_id?: string;
          manifest_id?: string | null;
          status?: 'pass' | 'fail' | 'error' | 'timeout';
          playability_score?: number | null;
          issues?: Json;
          screenshots?: string[];
          console_logs?: string | null;
          execution_method?: 'cli' | 'lambda' | 'web' | null;
          duration_ms?: number | null;
          created_at?: string;
          metadata?: Json;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type exports
export type Game = Database['public']['Tables']['games']['Row'];
export type GameInsert = Database['public']['Tables']['games']['Insert'];
export type GameUpdate = Database['public']['Tables']['games']['Update'];

export type GameManifest = Database['public']['Tables']['game_manifests']['Row'];
export type GameManifestInsert = Database['public']['Tables']['game_manifests']['Insert'];
export type GameManifestUpdate = Database['public']['Tables']['game_manifests']['Update'];

export type TestRun = Database['public']['Tables']['test_runs']['Row'];
export type TestRunInsert = Database['public']['Tables']['test_runs']['Insert'];
export type TestRunUpdate = Database['public']['Tables']['test_runs']['Update'];

// Game manifest structure (from manifest_data JSONB field)
export interface ManifestData {
  version: '1.0';
  gameType: 'puzzle' | 'platformer' | 'idle' | 'shooter' | 'rpg' | 'other';
  controls: {
    primary: string[];
    secondary?: string[];
    mouse?: boolean;
    mouseActions?: ('click' | 'drag' | 'scroll')[];
  };
  startButton?: {
    selector?: string;
    text?: string;
    position?: string;
    waitAfterClick?: number;
  };
  gameStates?: GameState[];
  loadingDuration?: number;
  screenshotIntervals?: number[]; // Time-based screenshot intervals (ms)
  gameplayDuration?: number; // Gameplay simulation duration (ms, default 30-60s)
  notes?: string;
}

export interface GameState {
  name: string;
  description: string;
  expectedDuration?: number;
  indicators?: {
    text?: string[];
    elements?: string[];
    screenshots?: boolean;
  };
}

// Test result metadata structure
export interface TestRunMetadata {
  browserVersion?: string;
  llmModel?: string;
  llmProvider?: string;
  retryCount?: number;
  userAgent?: string;
  manifestVersion?: string;
  [key: string]: unknown;
}

