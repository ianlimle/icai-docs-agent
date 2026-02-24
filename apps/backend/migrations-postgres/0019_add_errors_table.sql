-- Create errors table for monitoring and alerting
CREATE TABLE "errors" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"stage" text NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"severity" text NOT NULL,
	"metadata" jsonb,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "errors" ADD CONSTRAINT "errors_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "errors_message_id_idx" ON "errors" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX "errors_stage_idx" ON "errors" USING btree ("stage");
--> statement-breakpoint
CREATE INDEX "errors_severity_idx" ON "errors" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "errors_created_at_idx" ON "errors" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "errors_error_type_idx" ON "errors" USING btree ("error_type");
