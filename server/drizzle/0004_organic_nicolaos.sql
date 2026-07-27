CREATE TABLE "agent_enrollments" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"agent_version" text,
	"os_name" text,
	"cores" integer,
	"uptime_seconds" integer
);
--> statement-breakpoint
DROP INDEX "metric_samples_at_idx";--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "server" text DEFAULT 'hub' NOT NULL;--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "mem_total_mb" integer;--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "disk_pct" real;--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "disk_used_gb" real;--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "disk_total_gb" real;--> statement-breakpoint
ALTER TABLE "metric_samples" ADD COLUMN "load_1" real;--> statement-breakpoint
CREATE INDEX "metric_samples_at_idx" ON "metric_samples" USING btree ("server","at");