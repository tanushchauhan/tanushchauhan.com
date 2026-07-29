CREATE TABLE "services" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"server" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone,
	"ok" boolean,
	"status" integer,
	"latency_ms" integer,
	"error" text,
	"since" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "units" jsonb;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "failed_units" integer;