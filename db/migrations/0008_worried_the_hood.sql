CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"input_format" text NOT NULL,
	"output_format" text NOT NULL,
	"samples" jsonb,
	"tags" text[],
	"time_limit" text,
	"memory_limit" text,
	"boj_problem_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
