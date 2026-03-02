ALTER TABLE `chat_message` ADD COLUMN `superseded_at` integer;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_init_completed` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_init_completed_at` integer;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_debug_completed` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_debug_completed_at` integer;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_sync_completed` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_sync_completed_at` integer;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `workflow_last_error` text;
