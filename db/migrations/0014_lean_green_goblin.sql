CREATE TABLE "challenge_contributors" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"github_login" text NOT NULL,
	"contributed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_contributors" ADD CONSTRAINT "challenge_contributors_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_contributors_challenge_idx" ON "challenge_contributors" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_contributors_unique" ON "challenge_contributors" USING btree ("challenge_id","github_login");