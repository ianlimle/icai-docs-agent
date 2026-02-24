-- Update existing rows: rename 'retrieval' to 'tool_execution'
UPDATE "stage_telemetry" SET "stage" = 'tool_execution' WHERE "stage" = 'retrieval';

-- Note: Stage column is text type (no DB-level enum constraint)
-- TypeScript application layer enforces valid stage values

