CREATE TABLE "guestbook" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"is_hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guestbook_created_at_idx" ON "guestbook" USING btree ("created_at");