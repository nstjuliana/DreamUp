-- DreamUp QA Pipeline - Batch Reports Table Migration
-- Run this in your Supabase SQL Editor
-- Last Updated: December 2024

-- ============================================
-- TABLE: batch_reports
-- ============================================

CREATE TABLE batch_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial_failure')),
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed_tests INTEGER NOT NULL DEFAULT 0,
  failed_tests INTEGER NOT NULL DEFAULT 0,
  error_tests INTEGER NOT NULL DEFAULT 0,
  test_run_ids UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_method TEXT CHECK (execution_method IN ('cli', 'web')),
  metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE batch_reports IS 'Batch test execution reports for parallel testing';
COMMENT ON COLUMN batch_reports.batch_name IS 'Optional user-provided name for the batch';
COMMENT ON COLUMN batch_reports.status IS 'Current status: running, completed, or partial_failure';
COMMENT ON COLUMN batch_reports.total_tests IS 'Total number of tests in this batch';
COMMENT ON COLUMN batch_reports.passed_tests IS 'Number of tests that passed';
COMMENT ON COLUMN batch_reports.failed_tests IS 'Number of tests that failed';
COMMENT ON COLUMN batch_reports.error_tests IS 'Number of tests that errored';
COMMENT ON COLUMN batch_reports.test_run_ids IS 'Array of test_run IDs included in this batch';
COMMENT ON COLUMN batch_reports.started_at IS 'When the batch execution started';
COMMENT ON COLUMN batch_reports.completed_at IS 'When the batch execution completed';
COMMENT ON COLUMN batch_reports.execution_method IS 'How the batch was triggered (cli/web)';
COMMENT ON COLUMN batch_reports.metadata IS 'Additional context (concurrency level, game URLs, etc.)';

-- Indexes for batch_reports table
CREATE INDEX idx_batch_reports_status ON batch_reports(status);
CREATE INDEX idx_batch_reports_started_at ON batch_reports(started_at DESC);
CREATE INDEX idx_batch_reports_execution_method ON batch_reports(execution_method);

-- ============================================
-- COMPLETE
-- ============================================

-- Migration complete!
-- Next step: Update TypeScript types using:
-- npx supabase gen types typescript --project-id <your-project-id> > src/storage/types.ts

