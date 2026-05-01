CREATE TABLE "testcases" (
	"id" serial PRIMARY KEY NOT NULL,
	"problem_id" integer NOT NULL,
	"case_index" integer NOT NULL,
	"stdin" text NOT NULL,
	"expected_stdout" text NOT NULL,
	"source" text NOT NULL,
	"source_report_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "testcases_problem_source_case_uniq" UNIQUE("problem_id","source","case_index")
);
--> statement-breakpoint
CREATE INDEX "testcases_problem_idx" ON "testcases" USING btree ("problem_id");