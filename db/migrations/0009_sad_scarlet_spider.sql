CREATE TABLE "challenge_testcases" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"case_index" integer NOT NULL,
	"stdin" text NOT NULL,
	"expected_stdout" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_testcases" ADD CONSTRAINT "challenge_testcases_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_testcases_challenge_idx" ON "challenge_testcases" USING btree ("challenge_id");