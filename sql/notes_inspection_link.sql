-- Migration: add source + inspection_id to notes table
-- Run once against your Supabase database.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS inspection_id UUID;

-- Unique partial index enforces one rolled-up inspection note per job
CREATE UNIQUE INDEX IF NOT EXISTS notes_job_inspection_unique
  ON notes (job_id, inspection_id)
  WHERE source = 'inspection';
