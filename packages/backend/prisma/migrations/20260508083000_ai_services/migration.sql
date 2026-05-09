-- CreateEnum
CREATE TYPE "public"."AiSessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."AiMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL', 'SKILL');

-- CreateEnum
CREATE TYPE "public"."AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_CONFIRMATION', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."AiToolRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "tenant"."ai_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID,
    "title" TEXT,
    "status" "public"."AiSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "context_resource_type" TEXT,
    "context_resource_id" UUID,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."ai_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "public"."AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."ai_skill_runs" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_id" UUID,
    "skill_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "status" "public"."AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "args" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "steps" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."ai_tool_calls" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "skill_run_id" UUID,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_id" UUID,
    "tool_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "required_permission" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "risk_level" "public"."AiToolRiskLevel" NOT NULL DEFAULT 'LOW',
    "status" "public"."AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "args" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "confirmation_token" TEXT,
    "confirmation_expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "execution_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."ai_audit_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "skill_run_id" UUID,
    "tool_call_id" UUID,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_id" UUID,
    "event_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_sessions_tenant_id_user_id_last_active_at_idx" ON "tenant"."ai_sessions"("tenant_id", "user_id", "last_active_at");

-- CreateIndex
CREATE INDEX "ai_sessions_team_id_idx" ON "tenant"."ai_sessions"("team_id");

-- CreateIndex
CREATE INDEX "ai_messages_session_id_created_at_idx" ON "tenant"."ai_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_skill_runs_tenant_id_user_id_created_at_idx" ON "tenant"."ai_skill_runs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_skill_runs_session_id_idx" ON "tenant"."ai_skill_runs"("session_id");

-- CreateIndex
CREATE INDEX "ai_skill_runs_team_id_idx" ON "tenant"."ai_skill_runs"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tool_calls_confirmation_token_key" ON "tenant"."ai_tool_calls"("confirmation_token");

-- CreateIndex
CREATE INDEX "ai_tool_calls_tenant_id_user_id_created_at_idx" ON "tenant"."ai_tool_calls"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_tool_calls_session_id_idx" ON "tenant"."ai_tool_calls"("session_id");

-- CreateIndex
CREATE INDEX "ai_tool_calls_skill_run_id_idx" ON "tenant"."ai_tool_calls"("skill_run_id");

-- CreateIndex
CREATE INDEX "ai_tool_calls_team_id_idx" ON "tenant"."ai_tool_calls"("team_id");

-- CreateIndex
CREATE INDEX "ai_tool_calls_status_idx" ON "tenant"."ai_tool_calls"("status");

-- CreateIndex
CREATE INDEX "ai_audit_logs_tenant_id_user_id_created_at_idx" ON "tenant"."ai_audit_logs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_session_id_idx" ON "tenant"."ai_audit_logs"("session_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_skill_run_id_idx" ON "tenant"."ai_audit_logs"("skill_run_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_tool_call_id_idx" ON "tenant"."ai_audit_logs"("tool_call_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_team_id_idx" ON "tenant"."ai_audit_logs"("team_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_event_type_idx" ON "tenant"."ai_audit_logs"("event_type");

-- AddForeignKey
ALTER TABLE "tenant"."ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_sessions" ADD CONSTRAINT "ai_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_messages" ADD CONSTRAINT "ai_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant"."ai_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_skill_runs" ADD CONSTRAINT "ai_skill_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant"."ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_skill_runs" ADD CONSTRAINT "ai_skill_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_skill_runs" ADD CONSTRAINT "ai_skill_runs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant"."ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_skill_run_id_fkey" FOREIGN KEY ("skill_run_id") REFERENCES "tenant"."ai_skill_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant"."ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_skill_run_id_fkey" FOREIGN KEY ("skill_run_id") REFERENCES "tenant"."ai_skill_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_tool_call_id_fkey" FOREIGN KEY ("tool_call_id") REFERENCES "tenant"."ai_tool_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
