ALTER TABLE "boj_verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "solved_ac_request_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "solved_ac_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "boj_verifications" CASCADE;--> statement-breakpoint
DROP TABLE "solved_ac_request_log" CASCADE;--> statement-breakpoint
DROP TABLE "solved_ac_snapshots" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_boj_handle_unique";--> statement-breakpoint
ALTER TABLE "challenges" DROP COLUMN "boj_problem_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "boj_handle";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "boj_handle_verified_at";