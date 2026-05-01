CREATE TABLE "solved_ac_request_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "solved_ac_request_log_requested_at_idx" ON "solved_ac_request_log" USING btree ("requested_at");