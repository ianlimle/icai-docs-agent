ALTER TABLE "chat_message" ADD COLUMN "superseded_at" timestamp;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_init_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_init_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_debug_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_debug_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_sync_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_sync_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "workflow_last_error" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "memory_enabled" boolean DEFAULT true NOT NULL;