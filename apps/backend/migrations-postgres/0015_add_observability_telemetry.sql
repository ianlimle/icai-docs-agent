CREATE TABLE "stage_telemetry" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "ttft_ms" integer;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "total_latency_ms" integer;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "estimated_cost" integer;--> statement-breakpoint
ALTER TABLE "stage_telemetry" ADD CONSTRAINT "stage_telemetry_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stage_telemetry_message_id_idx" ON "stage_telemetry" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "stage_telemetry_stage_idx" ON "stage_telemetry" USING btree ("stage");