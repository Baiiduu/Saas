ALTER TABLE "tenant"."messages"
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
