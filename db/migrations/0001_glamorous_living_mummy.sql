CREATE TABLE "problems" (
	"problem_id" integer PRIMARY KEY NOT NULL,
	"title_ko" text NOT NULL,
	"level" integer NOT NULL,
	"accepted_user_count" integer,
	"average_tries" real,
	"raw" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_solved_problems" (
	"user_id" text NOT NULL,
	"problem_id" integer NOT NULL,
	"source" text NOT NULL,
	"solved_at" timestamp,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_solved_problems_user_id_problem_id_pk" PRIMARY KEY("user_id","problem_id")
);
--> statement-breakpoint
ALTER TABLE "user_solved_problems" ADD CONSTRAINT "user_solved_problems_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_solved_problems" ADD CONSTRAINT "user_solved_problems_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_solved_problems_user_idx" ON "user_solved_problems" USING btree ("user_id");