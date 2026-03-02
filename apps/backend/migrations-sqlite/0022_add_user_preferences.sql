-- User preferences table for tracking active project
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL UNIQUE PRIMARY KEY,
    active_project_id TEXT,
    last_project_id TEXT,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    FOREIGN KEY (active_project_id) REFERENCES project(id) ON DELETE SET NULL
);
