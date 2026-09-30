ALTER TABLE "visit_sessions" ADD COLUMN "mine" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "visit_sessions" SET "mine" = "authed";
