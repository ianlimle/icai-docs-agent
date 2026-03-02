-- Create errors table for monitoring and alerting
CREATE TABLE `errors` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`stage` text NOT NULL,
	`error_type` text NOT NULL,
	`error_message` text NOT NULL,
	`severity` text NOT NULL,
	`metadata` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_message`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `errors_message_id_idx` ON `errors` (`message_id`);
--> statement-breakpoint
CREATE INDEX `errors_stage_idx` ON `errors` (`stage`);
--> statement-breakpoint
CREATE INDEX `errors_severity_idx` ON `errors` (`severity`);
--> statement-breakpoint
CREATE INDEX `errors_created_at_idx` ON `errors` (`created_at`);
--> statement-breakpoint
CREATE INDEX `errors_error_type_idx` ON `errors` (`error_type`);
