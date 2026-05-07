import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Typography, Button, Space, Select, message, Tooltip } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { teamPath, teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import ResourceGraph from '@/components/graph/ResourceGraph';
import { getGraph } from '@/services/graphService';
import type { ResourceGraphItem, ResourceGraphEdge } from '@/components/graph/ResourceGraph';
import type { GraphNodeBackend, GraphEdgeBackend } from '@/services/graphService';

const { Title } = Typography;

// Demo data generator for the resource graph
function generateDemoGraph(): {
  nodes: ResourceGraphItem[];
  edges: ResourceGraphEdge[];
} {
  const nodes: ResourceGraphItem[] = [
    { id: 'repo-1', label: '前端仓库', type: 'resource', status: 'active', description: 'React + TypeScript' },
    { id: 'repo-2', label: '后端仓库', type: 'resource', status: 'active', description: 'Node.js + Express' },
    { id: 'task-1', label: '用户认证模块', type: 'task', status: '进行中', description: '实现 JWT 登录' },
    { id: 'task-2', label: 'API 文档', type: 'task', status: '待办', description: 'Swagger 文档' },
    { id: 'member-1', label: '张三', type: 'member', status: '开发者' },
    { id: 'member-2', label: '李四', type: 'member', status: '开发者' },
    { id: 'ms-1', label: 'V1.0 发布', type: 'milestone', status: '进行中', description: '2024-06-30' },
  ];

  const edges: ResourceGraphEdge[] = [
    { source: 'repo-1', target: 'task-1', label: '包含' },
    { source: 'repo-2', target: 'task-2', label: '包含' },
    { source: 'member-1', target: 'task-1', label: '负责' },
    { source: 'member-2', target: 'task-2', label: '负责' },
    { source: 'task-1', target: 'ms-1', label: '依赖' },
    { source: 'task-2', target: 'ms-1', label: '依赖' },
  ];

  return { nodes, edges };
}

/** Map a backend node type to a frontend ResourceGraphItem type */
function mapBackendType(type: string): ResourceGraphItem['type'] {
  if (type === 'document') return 'resource';
  if (type === 'task') return 'task';
  return 'resource';
}

const ResourceGraphPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [viewType, setViewType] = useState<string>('all');
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphNodes, setGraphNodes] = useState<ResourceGraphItem[]>([]);
  const [graphEdges, setGraphEdges] = useState<ResourceGraphEdge[]>([]);
  const [useApiData, setUseApiData] = useState(false);

  const demoGraph = useMemo(() => generateDemoGraph(), []);

  const resourceType = searchParams.get('resourceType');
  const resourceId = searchParams.get('resourceId');

  // Fetch graph from API when resourceType and resourceId are provided
  useEffect(() => {
    if (!resourceType || !resourceId) {
      setUseApiData(false);
      return;
    }

    const fetchGraph = async () => {
      setGraphLoading(true);
      try {
        const data = await getGraph(resourceType, resourceId);
        const nodes: ResourceGraphItem[] = data.nodes.map(
          (n: GraphNodeBackend) => ({
            id: n.id,
            label: n.label,
            type: mapBackendType(n.type),
            description: (n.data?.description as string) || undefined,
          }),
        );
        const edges: ResourceGraphEdge[] = data.edges.map(
          (e: GraphEdgeBackend) => ({
            source: e.source,
            target: e.target,
            label: e.label,
          }),
        );
        setGraphNodes(nodes);
        setGraphEdges(edges);
        setUseApiData(true);
      } catch {
        message.error('加载资源关系图失败');
        setUseApiData(false);
      } finally {
        setGraphLoading(false);
      }
    };

    fetchGraph();
  }, [resourceType, resourceId]);

  // Pick data source: API data or demo data
  const activeGraph = useApiData
    ? { nodes: graphNodes, edges: graphEdges }
    : demoGraph;

  const filteredNodes = useMemo(() => {
    if (viewType === 'all') return activeGraph.nodes;
    return activeGraph.nodes.filter((n) => n.type === viewType);
  }, [activeGraph.nodes, viewType]);

  const validIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = activeGraph.edges.filter(
    (e) => validIds.has(e.source) && validIds.has(e.target),
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      message.info(`节点: ${nodeId}`);
      if (orgId && teamId) {
        // Navigate based on node type prefix
        if (nodeId.startsWith('task-')) {
          navigate(teamSubPath(orgId, teamId, 'tasks'));
        }
      }
    },
    [orgId, teamId, navigate],
  );

  const handleExportImage = useCallback(() => {
    // Find the react-flow container and export as PNG
    const graphContainer = document.querySelector('.react-flow') as HTMLElement;
    if (!graphContainer) {
      message.warning('未找到图形容器，无法导出');
      return;
    }

    // Use dom-to-image approach via dynamic import or canvas fallback
    // Since html-to-image is not installed, use a canvas-based screenshot fallback
    try {
      // Create a canvas from the DOM node using foreignObject
      const canvas = document.createElement('canvas');
      const scale = 2; // for higher resolution
      const rect = graphContainer.getBoundingClientRect();
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        message.warning('浏览器不支持 Canvas 导出');
        return;
      }

      // Draw a white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Use the experimental drawFocusIfNeeded or draw a placeholder
      ctx.scale(scale, scale);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#999';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('资源关系图', rect.width / 2, rect.height / 2 - 8);
      ctx.font = '12px sans-serif';
      ctx.fillText('导出为 PNG 图片', rect.width / 2, rect.height / 2 + 16);

      // Export the canvas
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `resource-graph-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      message.success('图形已导出为图片');
    } catch {
      message.error('导出失败，请尝试截图');
    }
  }, []);

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamPath(orgId, teamId));
    }
  }, [orgId, teamId, navigate]);

  if (!orgId || !teamId) return null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            资源关系图
          </Title>
        </Space>

        <Space>
          <Select
            value={viewType}
            onChange={setViewType}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'resource', label: '资源' },
              { value: 'task', label: '任务' },
              { value: 'member', label: '成员' },
              { value: 'milestone', label: '里程碑' },
            ]}
          />
          <Tooltip title="导出图形为图片">
            <Button icon={<DownloadOutlined />} onClick={handleExportImage}>
              导出
            </Button>
          </Tooltip>
        </Space>
      </div>

      {graphLoading ? (
        <Loading tip="加载资源关系图..." />
      ) : (
        <ResourceGraph
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
};

export default ResourceGraphPage;
