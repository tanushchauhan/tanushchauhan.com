CREATE TABLE "metric_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"cpu_pct" real NOT NULL,
	"mem_pct" real NOT NULL,
	"mem_used_mb" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "metric_samples_at_idx" ON "metric_samples" USING btree ("at");