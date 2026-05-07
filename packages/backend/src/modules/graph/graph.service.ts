import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the collaboration graph for a given resource.
   *
   * Queries graph_edges for all edges connected to the resource
   * and returns a React Flow-compatible { nodes, edges } structure.
   *
   * @param resourceType The type of resource (e.g. 'task', 'document')
   * @param resourceId   The resource ID
   * @param typeFilter   Optional edge type filter (e.g. 'depends_on', 'related_to')
   */
  async getGraph(
    resourceType: string,
    resourceId: string,
    typeFilter?: string,
  ) {
    // Verify the resource exists
    let resource: any = null;
    switch (resourceType) {
      case 'task':
        resource = await this.prisma.task.findUnique({
          where: { id: resourceId },
          select: { id: true, title: true, deletedAt: true },
        });
        break;
      case 'document':
        resource = await this.prisma.document.findUnique({
          where: { id: resourceId },
          select: { id: true, name: true, deletedAt: true },
        });
        break;
      default:
        throw new NotFoundException(`Unknown resource type: ${resourceType}`);
    }

    if (!resource || resource.deletedAt) {
      throw new NotFoundException(`${resourceType} not found`);
    }

    // Query all graph edges connected to this resource
    const edgeFilter: any = {
      OR: [
        { sourceType: resourceType, sourceId: resourceId },
        { targetType: resourceType, targetId: resourceId },
      ],
    };

    if (typeFilter) {
      edgeFilter.relationType = typeFilter;
    }

    const edges = await this.prisma.graphEdge.findMany({
      where: edgeFilter,
      orderBy: { createdAt: 'desc' },
    });

    // Build the node set: the center resource + all connected resources
    const nodeMap = new Map<string, any>();
    const resultEdges: any[] = [];

    // Add the center node
    nodeMap.set(`${resourceType}:${resourceId}`, {
      id: `${resourceType}:${resourceId}`,
      type: resourceType,
      label: resource.name || resource.title || resourceId,
      data: { resourceType, resourceId },
      position: { x: 0, y: 0 }, // default position; consumer can re-layout
    });

    // Process each edge
    for (const edge of edges) {
      const sourceKey = `${edge.sourceType}:${edge.sourceId}`;
      const targetKey = `${edge.targetType}:${edge.targetId}`;

      // Add source node if not already present
      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, {
          id: sourceKey,
          type: edge.sourceType,
          label: edge.sourceId, // will be enriched if available
          data: { resourceType: edge.sourceType, resourceId: edge.sourceId },
          position: { x: 0, y: 0 },
        });
      }

      // Add target node if not already present
      if (!nodeMap.has(targetKey)) {
        nodeMap.set(targetKey, {
          id: targetKey,
          type: edge.targetType,
          label: edge.targetId,
          data: { resourceType: edge.targetType, resourceId: edge.targetId },
          position: { x: 0, y: 0 },
        });
      }

      // Add the edge for React Flow
      resultEdges.push({
        id: edge.id,
        source: sourceKey,
        target: targetKey,
        label: edge.relationType,
        type: 'default',
        data: { relationType: edge.relationType },
      });
    }

    // Enrich node labels where possible by fetching resource names
    await this.enrichNodeLabels(nodeMap);

    this.logger.log(
      `Graph queried for ${resourceType}:${resourceId} - ${nodeMap.size} nodes, ${resultEdges.length} edges`,
    );

    return {
      nodes: Array.from(nodeMap.values()),
      edges: resultEdges,
    };
  }

  /**
   * Enrich node labels by fetching names from their source tables.
   */
  private async enrichNodeLabels(
    nodeMap: Map<string, any>,
  ): Promise<void> {
    // Group node IDs by type for batch queries
    const taskIds: string[] = [];
    const docIds: string[] = [];

    for (const [key, node] of nodeMap.entries()) {
      if (node.type === 'task') {
        taskIds.push(node.data.resourceId);
      } else if (node.type === 'document') {
        docIds.push(node.data.resourceId);
      }
    }

    // Batch fetch task titles
    if (taskIds.length > 0) {
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, title: true },
      });
      const taskMap = new Map(tasks.map((t) => [t.id, t.title]));
      for (const [key, node] of nodeMap.entries()) {
        if (node.type === 'task') {
          const title = taskMap.get(node.data.resourceId);
          if (title) node.label = title;
        }
      }
    }

    // Batch fetch document names
    if (docIds.length > 0) {
      const docs = await this.prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, name: true },
      });
      const docMap = new Map(docs.map((d) => [d.id, d.name]));
      for (const [key, node] of nodeMap.entries()) {
        if (node.type === 'document') {
          const name = docMap.get(node.data.resourceId);
          if (name) node.label = name;
        }
      }
    }
  }
}
