ALTER TABLE "challenges" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "challenges" SET "slug" = 'challenge-' || "id" WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_slug_unique" UNIQUE("slug");
