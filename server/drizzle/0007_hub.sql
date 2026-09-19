-- the hub is the one server with no agent key
UPDATE "metric_samples" SET "server" = 'hub'
  WHERE "server" IN (SELECT "slug" FROM "servers" WHERE "key_hash" IS NULL AND "slug" <> 'hub')
  AND NOT EXISTS (SELECT 1 FROM "servers" WHERE "slug" = 'hub');--> statement-breakpoint
UPDATE "services" SET "server" = 'hub'
  WHERE "server" IN (SELECT "slug" FROM "servers" WHERE "key_hash" IS NULL AND "slug" <> 'hub')
  AND NOT EXISTS (SELECT 1 FROM "servers" WHERE "slug" = 'hub');--> statement-breakpoint
UPDATE "servers" SET "slug" = 'hub'
  WHERE "key_hash" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "servers" WHERE "slug" = 'hub');--> statement-breakpoint
ALTER TABLE "metric_samples" ALTER COLUMN "server" SET DEFAULT 'hub';
