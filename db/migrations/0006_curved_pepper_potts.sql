CREATE TABLE "standard_problems" (
	"problem_id" integer PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "standard_problems" ADD CONSTRAINT "standard_problems_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE cascade ON UPDATE no action;