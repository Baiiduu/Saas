-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant";

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('OWNER', 'ADMIN', 'LEADER', 'MEMBER', 'READER', 'GUEST');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('TASK_ASSIGNED', 'COMMENT_MENTION', 'APPROVAL_NEEDED', 'APPROVAL_RESULT', 'DOCUMENT_SHARED', 'MEMBER_JOINED', 'TEAM_INVITE', 'MILESTONE_DUE');

-- CreateEnum
CREATE TYPE "public"."ResourceType" AS ENUM ('GIT_REPO', 'S3_BUCKET', 'FILE');

-- CreateEnum
CREATE TYPE "public"."TeamVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('FILE', 'FOLDER');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "display_name" TEXT NOT NULL,
    "avatar" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING',
    "activation_code" TEXT,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "schema_name" VARCHAR(63) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "industry" TEXT,
    "scale" TEXT,
    "logo" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_members" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "public"."TeamVisibility" NOT NULL DEFAULT 'PRIVATE',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "parent_task_id" UUID,
    "due_date" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "team_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."task_tags" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."task_relations" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "related_task_id" UUID,
    "related_doc_id" UUID,
    "related_resource_id" UUID,
    "relation_type" TEXT NOT NULL,

    CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."board_columns" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status_mapping" "public"."TaskStatus" NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."documents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."DocumentType" NOT NULL DEFAULT 'FILE',
    "content" TEXT,
    "file_url" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "parent_id" UUID,
    "team_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."doc_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."doc_shares" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "share_token" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "access_code" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."approval_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "form_fields" JSONB NOT NULL,
    "team_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."approval_nodes" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "approver_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."approvals" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "form_data" JSONB NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "current_sort_order" INTEGER,
    "team_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."approval_actions" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "processor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."comments" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" UUID,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."notifications" (
    "id" UUID NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "resource_type" TEXT,
    "resource_id" UUID,
    "user_id" UUID NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."milestones" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "team_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."milestone_tasks" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."resource_repos" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "team_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resource_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."resource_items" (
    "id" UUID NOT NULL,
    "repo_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resource_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."resource_links" (
    "id" UUID NOT NULL,
    "resource_item_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "detail" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."graph_edges" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."messages" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."message_reads" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_schema_name_key" ON "public"."tenants"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_owner_id_idx" ON "public"."tenants"("owner_id");

-- CreateIndex
CREATE INDEX "tenant_members_user_id_idx" ON "public"."tenant_members"("user_id");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_idx" ON "public"."tenant_members"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_user_id_tenant_id_key" ON "public"."tenant_members"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "teams_tenant_id_idx" ON "tenant"."teams"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_tenant_id_key" ON "tenant"."teams"("name", "tenant_id");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "tenant"."team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "tenant"."team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "tenant"."team_members"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_team_id_idx" ON "tenant"."tasks"("team_id");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tenant"."tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_creator_id_idx" ON "tenant"."tasks"("creator_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tenant"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_sort_order_idx" ON "tenant"."tasks"("sort_order");

-- CreateIndex
CREATE INDEX "tasks_team_id_status_idx" ON "tenant"."tasks"("team_id", "status");

-- CreateIndex
CREATE INDEX "tasks_team_id_sort_order_idx" ON "tenant"."tasks"("team_id", "sort_order");

-- CreateIndex
CREATE INDEX "task_assignees_task_id_idx" ON "tenant"."task_assignees"("task_id");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_idx" ON "tenant"."task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "tenant"."task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_tags_task_id_idx" ON "tenant"."task_tags"("task_id");

-- CreateIndex
CREATE INDEX "task_tags_task_id_name_idx" ON "tenant"."task_tags"("task_id", "name");

-- CreateIndex
CREATE INDEX "task_relations_task_id_idx" ON "tenant"."task_relations"("task_id");

-- CreateIndex
CREATE INDEX "task_relations_related_task_id_idx" ON "tenant"."task_relations"("related_task_id");

-- CreateIndex
CREATE INDEX "task_relations_related_doc_id_idx" ON "tenant"."task_relations"("related_doc_id");

-- CreateIndex
CREATE INDEX "task_relations_related_resource_id_idx" ON "tenant"."task_relations"("related_resource_id");

-- CreateIndex
CREATE INDEX "board_columns_team_id_idx" ON "tenant"."board_columns"("team_id");

-- CreateIndex
CREATE INDEX "board_columns_sort_order_idx" ON "tenant"."board_columns"("sort_order");

-- CreateIndex
CREATE INDEX "documents_team_id_idx" ON "tenant"."documents"("team_id");

-- CreateIndex
CREATE INDEX "documents_creator_id_idx" ON "tenant"."documents"("creator_id");

-- CreateIndex
CREATE INDEX "documents_parent_id_idx" ON "tenant"."documents"("parent_id");

-- CreateIndex
CREATE INDEX "doc_versions_document_id_idx" ON "tenant"."doc_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "doc_versions_document_id_version_number_key" ON "tenant"."doc_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "doc_shares_share_token_key" ON "tenant"."doc_shares"("share_token");

-- CreateIndex
CREATE INDEX "doc_shares_document_id_idx" ON "tenant"."doc_shares"("document_id");

-- CreateIndex
CREATE INDEX "approval_templates_team_id_idx" ON "tenant"."approval_templates"("team_id");

-- CreateIndex
CREATE INDEX "approval_templates_created_by_idx" ON "tenant"."approval_templates"("created_by");

-- CreateIndex
CREATE INDEX "approval_nodes_template_id_idx" ON "tenant"."approval_nodes"("template_id");

-- CreateIndex
CREATE INDEX "approval_nodes_sort_order_idx" ON "tenant"."approval_nodes"("sort_order");

-- CreateIndex
CREATE INDEX "approvals_template_id_idx" ON "tenant"."approvals"("template_id");

-- CreateIndex
CREATE INDEX "approvals_team_id_idx" ON "tenant"."approvals"("team_id");

-- CreateIndex
CREATE INDEX "approvals_creator_id_idx" ON "tenant"."approvals"("creator_id");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "tenant"."approvals"("status");

-- CreateIndex
CREATE INDEX "approval_actions_approval_id_idx" ON "tenant"."approval_actions"("approval_id");

-- CreateIndex
CREATE INDEX "approval_actions_node_id_idx" ON "tenant"."approval_actions"("node_id");

-- CreateIndex
CREATE INDEX "approval_actions_processor_id_idx" ON "tenant"."approval_actions"("processor_id");

-- CreateIndex
CREATE INDEX "comments_resource_type_resource_id_idx" ON "tenant"."comments"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "tenant"."comments"("parent_id");

-- CreateIndex
CREATE INDEX "comments_creator_id_idx" ON "tenant"."comments"("creator_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "tenant"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "tenant"."notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "tenant"."notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "tenant"."notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "milestones_team_id_idx" ON "tenant"."milestones"("team_id");

-- CreateIndex
CREATE INDEX "milestones_created_by_idx" ON "tenant"."milestones"("created_by");

-- CreateIndex
CREATE INDEX "milestone_tasks_milestone_id_idx" ON "tenant"."milestone_tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "milestone_tasks_task_id_idx" ON "tenant"."milestone_tasks"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_tasks_milestone_id_task_id_key" ON "tenant"."milestone_tasks"("milestone_id", "task_id");

-- CreateIndex
CREATE INDEX "resource_repos_team_id_idx" ON "tenant"."resource_repos"("team_id");

-- CreateIndex
CREATE INDEX "resource_repos_created_by_idx" ON "tenant"."resource_repos"("created_by");

-- CreateIndex
CREATE INDEX "resource_items_repo_id_idx" ON "tenant"."resource_items"("repo_id");

-- CreateIndex
CREATE INDEX "resource_items_path_idx" ON "tenant"."resource_items"("path");

-- CreateIndex
CREATE INDEX "resource_links_resource_item_id_idx" ON "tenant"."resource_links"("resource_item_id");

-- CreateIndex
CREATE INDEX "resource_links_target_type_target_id_idx" ON "tenant"."resource_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "tenant"."audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "tenant"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "tenant"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "tenant"."audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "tenant"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "graph_edges_source_type_source_id_idx" ON "tenant"."graph_edges"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "graph_edges_target_type_target_id_idx" ON "tenant"."graph_edges"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_edges_source_type_source_id_target_type_target_id_rel_key" ON "tenant"."graph_edges"("source_type", "source_id", "target_type", "target_id", "relation_type");

-- CreateIndex
CREATE INDEX "messages_team_id_idx" ON "tenant"."messages"("team_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "tenant"."messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "tenant"."messages"("created_at");

-- CreateIndex
CREATE INDEX "messages_team_id_created_at_idx" ON "tenant"."messages"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "message_reads_message_id_idx" ON "tenant"."message_reads"("message_id");

-- CreateIndex
CREATE INDEX "message_reads_user_id_idx" ON "tenant"."message_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_message_id_user_id_key" ON "tenant"."message_reads"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_members" ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."teams" ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tenant"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."tasks" ADD CONSTRAINT "tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tenant"."tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tenant"."tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_relations" ADD CONSTRAINT "task_relations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tenant"."tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_relations" ADD CONSTRAINT "task_relations_related_task_id_fkey" FOREIGN KEY ("related_task_id") REFERENCES "tenant"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_relations" ADD CONSTRAINT "task_relations_related_doc_id_fkey" FOREIGN KEY ("related_doc_id") REFERENCES "tenant"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."task_relations" ADD CONSTRAINT "task_relations_related_resource_id_fkey" FOREIGN KEY ("related_resource_id") REFERENCES "tenant"."resource_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."board_columns" ADD CONSTRAINT "board_columns_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."documents" ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tenant"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."documents" ADD CONSTRAINT "documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."documents" ADD CONSTRAINT "documents_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."doc_versions" ADD CONSTRAINT "doc_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tenant"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."doc_shares" ADD CONSTRAINT "doc_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tenant"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."doc_shares" ADD CONSTRAINT "doc_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_templates" ADD CONSTRAINT "approval_templates_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_templates" ADD CONSTRAINT "approval_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_nodes" ADD CONSTRAINT "approval_nodes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "tenant"."approval_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approvals" ADD CONSTRAINT "approvals_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "tenant"."approval_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approvals" ADD CONSTRAINT "approvals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approvals" ADD CONSTRAINT "approvals_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_actions" ADD CONSTRAINT "approval_actions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "tenant"."approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_actions" ADD CONSTRAINT "approval_actions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "tenant"."approval_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."approval_actions" ADD CONSTRAINT "approval_actions_processor_id_fkey" FOREIGN KEY ("processor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tenant"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."comments" ADD CONSTRAINT "comments_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."milestones" ADD CONSTRAINT "milestones_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."milestones" ADD CONSTRAINT "milestones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."milestone_tasks" ADD CONSTRAINT "milestone_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "tenant"."milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."milestone_tasks" ADD CONSTRAINT "milestone_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tenant"."tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."resource_repos" ADD CONSTRAINT "resource_repos_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."resource_repos" ADD CONSTRAINT "resource_repos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."resource_items" ADD CONSTRAINT "resource_items_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "tenant"."resource_repos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."resource_links" ADD CONSTRAINT "resource_links_resource_item_id_fkey" FOREIGN KEY ("resource_item_id") REFERENCES "tenant"."resource_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."resource_links" ADD CONSTRAINT "resource_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."messages" ADD CONSTRAINT "messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "tenant"."messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."message_reads" ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
