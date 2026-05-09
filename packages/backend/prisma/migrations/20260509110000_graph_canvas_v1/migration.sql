-- CreateTable
CREATE TABLE "tenant"."graph_canvases" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "team_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "viewport" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "graph_canvases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."graph_nodes" (
    "id" UUID NOT NULL,
    "canvas_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "node_type" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "parent_node_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tenant"."graph_edges"
ADD COLUMN "canvas_id" UUID,
ADD COLUMN "team_id" UUID,
ADD COLUMN "tenant_id" UUID,
ADD COLUMN "source_node_id" UUID,
ADD COLUMN "target_node_id" UUID,
ADD COLUMN "created_by" UUID,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "graph_canvases_tenant_id_idx" ON "tenant"."graph_canvases"("tenant_id");

-- CreateIndex
CREATE INDEX "graph_canvases_team_id_idx" ON "tenant"."graph_canvases"("team_id");

-- CreateIndex
CREATE INDEX "graph_canvases_team_id_is_default_idx" ON "tenant"."graph_canvases"("team_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "graph_canvases_team_id_name_key" ON "tenant"."graph_canvases"("team_id", "name");

-- CreateIndex
CREATE INDEX "graph_nodes_tenant_id_idx" ON "tenant"."graph_nodes"("tenant_id");

-- CreateIndex
CREATE INDEX "graph_nodes_team_id_idx" ON "tenant"."graph_nodes"("team_id");

-- CreateIndex
CREATE INDEX "graph_nodes_canvas_id_idx" ON "tenant"."graph_nodes"("canvas_id");

-- CreateIndex
CREATE INDEX "graph_nodes_parent_node_id_idx" ON "tenant"."graph_nodes"("parent_node_id");

-- CreateIndex
CREATE INDEX "graph_nodes_resource_type_resource_id_idx" ON "tenant"."graph_nodes"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_nodes_canvas_id_node_type_resource_id_key" ON "tenant"."graph_nodes"("canvas_id", "node_type", "resource_id");

-- CreateIndex
CREATE INDEX "graph_edges_tenant_id_idx" ON "tenant"."graph_edges"("tenant_id");

-- CreateIndex
CREATE INDEX "graph_edges_team_id_idx" ON "tenant"."graph_edges"("team_id");

-- CreateIndex
CREATE INDEX "graph_edges_canvas_id_idx" ON "tenant"."graph_edges"("canvas_id");

-- CreateIndex
CREATE INDEX "graph_edges_source_node_id_idx" ON "tenant"."graph_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "graph_edges_target_node_id_idx" ON "tenant"."graph_edges"("target_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_edges_canvas_id_source_node_id_target_node_id_relation_type_key" ON "tenant"."graph_edges"("canvas_id", "source_node_id", "target_node_id", "relation_type");

-- AddForeignKey
ALTER TABLE "tenant"."graph_canvases" ADD CONSTRAINT "graph_canvases_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_canvases" ADD CONSTRAINT "graph_canvases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_nodes" ADD CONSTRAINT "graph_nodes_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "tenant"."graph_canvases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_nodes" ADD CONSTRAINT "graph_nodes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tenant"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_nodes" ADD CONSTRAINT "graph_nodes_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "tenant"."graph_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_edges" ADD CONSTRAINT "graph_edges_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "tenant"."graph_canvases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_edges" ADD CONSTRAINT "graph_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "tenant"."graph_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."graph_edges" ADD CONSTRAINT "graph_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "tenant"."graph_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
