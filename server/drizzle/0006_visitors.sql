CREATE TABLE "visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "visitors_ip_hash_unique" UNIQUE("ip_hash")
);
