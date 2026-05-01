ALTER TABLE "problems" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "input_format" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "output_format" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "samples" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "hint" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "time_limit" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "memory_limit" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "submission_count" integer;