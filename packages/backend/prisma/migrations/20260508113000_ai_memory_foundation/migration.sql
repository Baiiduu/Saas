-- CreateEnum
CREATE TYPE "public"."AiMemoryScope" AS ENUM ('USER', 'TEAM');

-- CreateTable
CREATE TABLE "tenant"."ai_memories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID,
    "source_session_id" UUID,
    "scope" "public"."AiMemoryScope" NOT NULL DEFAULT 'USER',
    "memory_key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "last_referenced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_memories_tenant_id_user_id_updated_at_idx" ON "tenant"."ai_memories"("tenant_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "ai_memories_team_id_scope_updated_at_idx" ON "tenant"."ai_memories"("team_id", "scope", "updated_at");

-- CreateIndex
CREATE INDEX "ai_memories_source_session_id_idx" ON "tenant"."ai_memories"("source_session_id");

-- CreateIndex
CREATE INDEX "ai_memories_tenant_id_user_id_memory_key_idx" ON "tenant"."ai_memories"("tenant_id", "user_id", "memory_key");

-- AddForeignKey
ALTER TABLE "tenant"."ai_memories" ADD CONSTRAINT "ai_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_memories" ADD CONSTRAINT "ai_memories_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_memories" ADD CONSTRAINT "ai_memories_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "tenant"."ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
