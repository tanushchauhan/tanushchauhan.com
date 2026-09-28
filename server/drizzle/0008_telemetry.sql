CREATE TABLE "visit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" integer NOT NULL,
	"name" text NOT NULL,
	"target" text,
	"props" jsonb,
	"x" real,
	"y" real
);
--> statement-breakpoint
CREATE TABLE "visit_rollup" (
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "visit_rollup_day_kind_key_pk" PRIMARY KEY("day","kind","key")
);
--> statement-breakpoint
CREATE TABLE "visit_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"referrer_host" text,
	"referrer_path" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"ref" text,
	"click_id" text,
	"landing_path" text,
	"country" text,
	"rdns" text,
	"org" text,
	"ua" text,
	"browser" text,
	"browser_version" text,
	"os" text,
	"device" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"surface" text,
	"viewport_w" integer,
	"viewport_h" integer,
	"screen_w" integer,
	"screen_h" integer,
	"dpr" real,
	"timezone" text,
	"language" text,
	"prefers_dark" boolean,
	"reduced_motion" boolean,
	"authed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_session_id_visit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."visit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_sessions" ADD CONSTRAINT "visit_sessions_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_events_session_idx" ON "visit_events" USING btree ("session_id","seq");--> statement-breakpoint
CREATE INDEX "visit_events_name_at_idx" ON "visit_events" USING btree ("name","at");--> statement-breakpoint
CREATE INDEX "visit_events_at_idx" ON "visit_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "visit_sessions_started_at_idx" ON "visit_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "visit_sessions_visitor_idx" ON "visit_sessions" USING btree ("visitor_id");