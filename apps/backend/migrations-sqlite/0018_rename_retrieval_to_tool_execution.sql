-- Update existing rows: rename 'retrieval' to 'tool_execution'
UPDATE "stage_telemetry" SET "stage" = 'tool_execution' WHERE "stage" = 'retrieval';

-- SQLite doesn't enforce enum values at the database level
-- The application layer handles this via TypeScript types
