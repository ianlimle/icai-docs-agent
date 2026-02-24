CREATE TABLE `stage_telemetry` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer,
	`error_message` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stage_telemetry_message_id_idx` ON `stage_telemetry` (`message_id`);--> statement-breakpoint
CREATE INDEX `stage_telemetry_stage_idx` ON `stage_telemetry` (`stage`);--> statement-breakpoint
ALTER TABLE `chat_message` ADD `ttft_ms` integer;--> statement-breakpoint
ALTER TABLE `chat_message` ADD `total_latency_ms` integer;--> statement-breakpoint
ALTER TABLE `chat_message` ADD `estimated_cost` integer;