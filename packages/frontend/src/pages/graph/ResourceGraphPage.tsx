import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  GithubOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { teamPath, teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import ResourceGraph from '@/components/graph/ResourceGraph';
import type {
  ResourceDropData,
  ResourceGraphEdge,
  ResourceGraphItem,
} from '@/components/graph/ResourceGraph';
import {
  createGraphEdge,
  createGraphNode,
  deleteGraphEdge,
  deleteGraphNode,
  getGraphResourcePool,
  getTeamCanvas,
  updateGraphEdge,
  updateGraphNode,
  type GraphNodeBackend,
  type GraphNodeType,
  type GraphRelationType,
  type GraphResourcePool,
  type TeamGraphCanvasResponse,
  type UpdateGraphNodePayload,
} from '@/services/graphService';

const { Text, Title } = Typography;

const nodeTypeLabels: Record<GraphNodeType | 'all', string> = {
  all: '全部',
  document: '文档',
  git_repo: 'Git 仓库',
  member: '成员',
  milestone: '里程碑',
  task: '任务',
};

const poolSections: Array<{
  key: keyof GraphResourcePool;
  title: string;
  type: GraphNodeType;
}> = [
  { key: 'milestones', title: '里程碑', type: 'milestone' },
  { key: 'tasks', title: '任务', type: 'task' },
  { key: 'documents', title: '文档', type: 'document' },
  { key: 'members', title: '成员', type: 'member' },
];

function mapBackendNode(node: GraphNodeBackend): ResourceGraphItem {
  const nodeType = (node.nodeType ?? node.type) as GraphNodeType;
  return {
    id: node.id,
    label: node.label || node.title || node.id,
    type: nodeType,
    description: node.description ?? undefined,
    status:
      typeof node.data?.status === 'string'
        ? node.data.status
        : typeof node.data?.role === 'string'
          ? node.data.role
          : undefined,
    parentNodeId: node.parentNodeId ?? null,
    position: node.position,
    size: node.size,
    data: node.data,
  };
}

function getPosition(node?: ResourceGraphItem | null) {
  return node?.position ?? { x: 0, y: 0 };
}

function mapBackendEdge(edge: TeamGraphCanvasResponse['edges'][number]): ResourceGraphEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? edge.relationType,
    relationType: edge.relationType,
  };
}

const ResourceGraphPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const [gitForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [canvas, setCanvas] = useState<TeamGraphCanvasResponse['canvas'] | null>(null);
  const [nodes, setNodes] = useState<ResourceGraphItem[]>([]);
  const [edges, setEdges] = useState<ResourceGraphEdge[]>([]);
  const [resourcePool, setResourcePool] = useState<GraphResourcePool>({
    tasks: [],
    documents: [],
    members: [],
    milestones: [],
  });
  const [relationTypes, setRelationTypes] = useState<TeamGraphCanvasResponse['relationTypes']>(
    [],
  );
  const [selectedRelation, setSelectedRelation] = useState<GraphRelationType>('references');
  const [viewType, setViewType] = useState<GraphNodeType | 'all'>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const nodeSaveTimersRef = useRef(new Map<string, number>());
  const pendingNodeSavesRef = useRef(new Map<string, UpdateGraphNodePayload>());
  const lastSaveErrorAtRef = useRef(0);

  const canEdit = Boolean(canvas?.canEdit);

  const loadCanvas = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await getTeamCanvas(teamId);
      setCanvas(data.canvas);
      setNodes(data.nodes.map(mapBackendNode));
      setEdges(data.edges.map(mapBackendEdge));
      setRelationTypes(data.relationTypes);
      if (data.relationTypes[0]?.value) {
        setSelectedRelation((current) =>
          data.relationTypes.some((item) => item.value === current)
            ? current
            : data.relationTypes[0].value,
        );
      }
    } catch {
      message.error('加载团队资源画布失败');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const loadResourcePool = useCallback(async () => {
    if (!teamId) return;
    setPoolLoading(true);
    try {
      setResourcePool(await getGraphResourcePool(teamId));
    } catch {
      message.error('加载资源池失败');
    } finally {
      setPoolLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadCanvas();
    loadResourcePool();
  }, [loadCanvas, loadResourcePool]);

  useEffect(
    () => () => {
      nodeSaveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      nodeSaveTimersRef.current.clear();
      pendingNodeSavesRef.current.clear();
    },
    [],
  );

  const scheduleNodeSave = useCallback(
    (nodeId: string, payload: UpdateGraphNodePayload) => {
      const previous = pendingNodeSavesRef.current.get(nodeId) ?? {};
      pendingNodeSavesRef.current.set(nodeId, { ...previous, ...payload });

      const existingTimer = nodeSaveTimersRef.current.get(nodeId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timerId = window.setTimeout(async () => {
        nodeSaveTimersRef.current.delete(nodeId);
        const nextPayload = pendingNodeSavesRef.current.get(nodeId);
        pendingNodeSavesRef.current.delete(nodeId);
        if (!nextPayload) return;

        try {
          await updateGraphNode(nodeId, nextPayload);
        } catch {
          const now = Date.now();
          if (now - lastSaveErrorAtRef.current > 3000) {
            lastSaveErrorAtRef.current = now;
            message.error('保存节点变更失败，请稍后重试');
          }
        }
      }, 700);

      nodeSaveTimersRef.current.set(nodeId, timerId);
    },
    [],
  );

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const renderedNodes = useMemo(() => {
    const enriched = nodes.map((node) => ({
      ...node,
      parentLabel: node.parentNodeId ? nodeMap.get(node.parentNodeId)?.label : undefined,
    }));
    if (viewType === 'all') return enriched;
    return enriched.filter((node) => node.type === viewType);
  }, [nodeMap, nodes, viewType]);

  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(renderedNodes.map((node) => node.id));
    return edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  }, [edges, renderedNodes]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) : null;
  const milestoneOptions = nodes
    .filter((node) => node.type === 'milestone' && node.id !== selectedNodeId)
    .map((node) => ({ value: node.id, label: node.label }));
  const childNodes = selectedNode
    ? nodes.filter((node) => node.parentNodeId === selectedNode.id)
    : [];
  const childCandidateOptions = nodes
    .filter(
      (node) =>
        selectedNode?.type === 'milestone' &&
        node.id !== selectedNode.id &&
        node.type !== 'milestone' &&
        node.parentNodeId !== selectedNode.id,
    )
    .map((node) => ({
      value: node.id,
      label: `${node.label} (${nodeTypeLabels[node.type as GraphNodeType]})`,
    }));

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamPath(orgId, teamId));
    }
  }, [orgId, teamId, navigate]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    },
    [],
  );

  const openNodeTarget = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node || !orgId || !teamId) return;

      const resourceId = node.data?.resourceId as string | undefined;
      if (node.type === 'git_repo') {
        const url = node.data?.url as string | undefined;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (node.type === 'task' && resourceId) {
        navigate(teamSubPath(orgId, teamId, `tasks/${resourceId}`));
      } else if (node.type === 'document' && resourceId) {
        navigate(teamSubPath(orgId, teamId, `documents/${resourceId}`));
      } else if (node.type === 'member') {
        navigate(teamSubPath(orgId, teamId, 'members'));
      } else if (node.type === 'milestone') {
        navigate(teamSubPath(orgId, teamId, 'milestones'));
      }
    },
    [nodeMap, orgId, teamId, navigate],
  );

  const handleDropResource = useCallback(
    async (resource: ResourceDropData, position: { x: number; y: number }) => {
      if (!teamId || !canEdit) return;
      try {
        const node = await createGraphNode(teamId, {
          nodeType: resource.type,
          resourceId: resource.resourceId,
          position:
            selectedNode?.type === 'milestone' && resource.type !== 'milestone'
              ? {
                  x: position.x - getPosition(selectedNode).x,
                  y: position.y - getPosition(selectedNode).y,
                }
              : position,
          parentNodeId:
            selectedNode?.type === 'milestone' && resource.type !== 'milestone'
              ? selectedNode.id
              : undefined,
        });
        const mapped = mapBackendNode(node);
        setNodes((current) =>
          current.some((item) => item.id === mapped.id)
            ? current.map((item) => (item.id === mapped.id ? mapped : item))
            : [...current, mapped],
        );
        message.success('节点已加入画布');
      } catch {
        message.error('添加节点失败，请确认资源权限和团队范围');
      }
    },
    [canEdit, selectedNode, teamId],
  );

  const handleNodeMove = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      if (!canEdit) return;
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, position } : node)),
      );
      scheduleNodeSave(nodeId, { position });
    },
    [canEdit, scheduleNodeSave],
  );

  const handleNodeResize = useCallback(
    async (nodeId: string, size: { width: number; height: number }) => {
      if (!canEdit) return;
      const normalizedSize = {
        width: Math.round(size.width),
        height: Math.round(size.height),
      };
      const currentNode = nodeMap.get(nodeId);
      if (
        currentNode?.size?.width === normalizedSize.width &&
        currentNode?.size?.height === normalizedSize.height
      ) {
        return;
      }
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, size: normalizedSize } : node)),
      );
      scheduleNodeSave(nodeId, { size: normalizedSize });
    },
    [canEdit, nodeMap, scheduleNodeSave],
  );

  const handleConnectNodes = useCallback(
    async (sourceNodeId: string, targetNodeId: string) => {
      if (!teamId || !canEdit) return;
      try {
        const edge = await createGraphEdge(teamId, {
          sourceNodeId,
          targetNodeId,
          relationType: selectedRelation,
        });
        setEdges((current) =>
          current.some((item) => item.id === edge.id)
            ? current
            : [...current, mapBackendEdge(edge as TeamGraphCanvasResponse['edges'][number])],
        );
        message.success('关系边已保存');
      } catch {
        message.error('建立关系边失败');
      }
    },
    [canEdit, selectedRelation, teamId],
  );

  const handleEdgeDelete = useCallback(
    async (edgeId: string) => {
      if (!canEdit) return;
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
      setSelectedEdgeId((current) => (current === edgeId ? null : current));
      try {
        await deleteGraphEdge(edgeId);
        message.success('关系边已删除');
      } catch {
        message.error('删除关系边失败');
        loadCanvas();
      }
    },
    [canEdit, loadCanvas],
  );

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }, []);

  const handleNodeDelete = useCallback(
    async (nodeId: string) => {
      if (!canEdit) return;
      setNodes((current) =>
        current
          .filter((node) => node.id !== nodeId)
          .map((node) => (node.parentNodeId === nodeId ? { ...node, parentNodeId: null } : node)),
      );
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
      try {
        await deleteGraphNode(nodeId);
        message.success('节点已删除');
      } catch {
        message.error('删除节点失败');
        loadCanvas();
      }
    },
    [canEdit, loadCanvas],
  );

  const confirmDeleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    Modal.confirm({
      title: `删除节点「${selectedNode.label}」？`,
      content: '删除节点会同时删除与该节点相连的关系边，并解除其子节点父级关系。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleNodeDelete(selectedNode.id),
    });
  }, [handleNodeDelete, selectedNode]);

  const handleParentChange = useCallback(
    async (parentNodeId: string | null) => {
      if (!selectedNode || !canEdit) return;
      const parentNode = parentNodeId ? nodeMap.get(parentNodeId) : null;
      const currentPosition = getPosition(selectedNode);
      const currentParent = selectedNode.parentNodeId ? nodeMap.get(selectedNode.parentNodeId) : null;
      const nextPosition = parentNode
        ? {
            x: currentPosition.x - getPosition(parentNode).x,
            y: currentPosition.y - getPosition(parentNode).y,
          }
        : currentParent
          ? {
              x: currentPosition.x + getPosition(currentParent).x,
              y: currentPosition.y + getPosition(currentParent).y,
            }
          : currentPosition;
      try {
        const updated = await updateGraphNode(selectedNode.id, {
          parentNodeId,
          position: nextPosition,
        });
        const mapped = mapBackendNode(updated);
        setNodes((current) => current.map((node) => (node.id === mapped.id ? mapped : node)));
        message.success(parentNodeId ? '已挂到里程碑父节点' : '已移除父节点');
      } catch {
        message.error('保存父子关系失败');
      }
    },
    [canEdit, nodeMap, selectedNode],
  );

  const handleAttachChild = useCallback(
    async (childNodeId: string) => {
      if (!selectedNode || selectedNode.type !== 'milestone' || !canEdit) return;
      const childNode = nodeMap.get(childNodeId);
      if (!childNode) return;
      const nextPosition = {
        x: getPosition(childNode).x - getPosition(selectedNode).x,
        y: getPosition(childNode).y - getPosition(selectedNode).y,
      };
      try {
        const updated = await updateGraphNode(childNodeId, {
          parentNodeId: selectedNode.id,
          position: nextPosition,
        });
        const mapped = mapBackendNode(updated);
        setNodes((current) => current.map((node) => (node.id === mapped.id ? mapped : node)));
        message.success('子节点已挂载');
      } catch {
        message.error('挂载子节点失败');
      }
    },
    [canEdit, nodeMap, selectedNode],
  );

  const handleDetachChild = useCallback(
    async (childNodeId: string) => {
      if (!canEdit) return;
      const childNode = nodeMap.get(childNodeId);
      const parentNode = childNode?.parentNodeId ? nodeMap.get(childNode.parentNodeId) : null;
      const nextPosition =
        childNode && parentNode
          ? {
              x: getPosition(childNode).x + getPosition(parentNode).x,
              y: getPosition(childNode).y + getPosition(parentNode).y,
            }
          : undefined;
      try {
        const updated = await updateGraphNode(childNodeId, {
          parentNodeId: null,
          position: nextPosition,
        });
        const mapped = mapBackendNode(updated);
        setNodes((current) => current.map((node) => (node.id === mapped.id ? mapped : node)));
        message.success('已移出父里程碑');
      } catch {
        message.error('移除子节点失败');
      }
    },
    [canEdit, nodeMap],
  );

  const handleRenameNode = useCallback(
    async (values: { title?: string; description?: string }) => {
      if (!selectedNode || !canEdit) return;
      try {
        const updated = await updateGraphNode(selectedNode.id, {
          title: values.title,
          description: values.description ?? null,
        });
        const mapped = mapBackendNode(updated);
        setNodes((current) => current.map((node) => (node.id === mapped.id ? mapped : node)));
        message.success('节点信息已保存');
      } catch {
        message.error('保存节点信息失败');
      }
    },
    [canEdit, selectedNode],
  );

  const handleEdgeRelationChange = useCallback(
    async (relationType: GraphRelationType) => {
      if (!selectedEdge?.id || !canEdit) return;
      try {
        const updated = await updateGraphEdge(selectedEdge.id, { relationType });
        const mapped = mapBackendEdge(updated as TeamGraphCanvasResponse['edges'][number]);
        setEdges((current) => current.map((edge) => (edge.id === mapped.id ? mapped : edge)));
        message.success('关系类型已更新');
      } catch {
        message.error('更新关系类型失败');
      }
    },
    [canEdit, selectedEdge],
  );

  const handleCreateGitRepo = useCallback(async () => {
    if (!teamId || !canEdit) return;
    const values = await gitForm.validateFields();
    try {
      const node = await createGraphNode(teamId, {
        nodeType: 'git_repo',
        title: values.title,
        url: values.url,
        description: values.description,
        position:
          selectedNode?.type === 'milestone'
            ? { x: 40, y: 90 }
            : { x: 120, y: 120 },
        parentNodeId: selectedNode?.type === 'milestone' ? selectedNode.id : undefined,
      });
      setNodes((current) => [...current, mapBackendNode(node)]);
      gitForm.resetFields();
      setGitModalOpen(false);
      message.success('Git 仓库节点已创建');
    } catch {
      message.error('创建 Git 仓库节点失败');
    }
  }, [canEdit, gitForm, selectedNode, teamId]);

  const handleExportJson = useCallback(() => {
    const payload = JSON.stringify({ canvas, nodes, edges }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-resource-canvas-${teamId}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [canvas, edges, nodes, teamId]);

  const handleDragStart = useCallback(
    (event: React.DragEvent, item: ResourceDropData) => {
      if (!canEdit) return;
      event.dataTransfer.setData('application/x-resource-graph-node', JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copy';
    },
    [canEdit],
  );

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
          <div>
            <Title level={4} style={{ margin: 0 }}>
              团队资源关系画布
            </Title>
            <Text type="secondary">
              单击选择编辑，双击打开详情；拖入真实资源，连接节点并保存团队级编排关系。
            </Text>
          </div>
        </Space>

        <Space>
          <Select
            value={viewType}
            onChange={setViewType}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: nodeTypeLabels.all },
              { value: 'milestone', label: nodeTypeLabels.milestone },
              { value: 'task', label: nodeTypeLabels.task },
              { value: 'document', label: nodeTypeLabels.document },
              { value: 'member', label: nodeTypeLabels.member },
              { value: 'git_repo', label: nodeTypeLabels.git_repo },
            ]}
          />
          <Select
            value={selectedRelation}
            onChange={setSelectedRelation}
            style={{ width: 160 }}
            options={relationTypes.map((item) => ({
              value: item.value,
              label: `${item.label} / ${item.value}`,
            }))}
            disabled={!canEdit}
          />
          <Tooltip title="新增外部 Git 仓库节点">
            <Button
              icon={<GithubOutlined />}
              disabled={!canEdit}
              onClick={() => setGitModalOpen(true)}
            >
              Git 仓库
            </Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={handleExportJson}>
            导出 JSON
          </Button>
        </Space>
      </div>

      {!canEdit && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前账号只有画布查看权限，拖入节点、移动节点和连线会被禁用。"
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: 16 }}>
        <Card
          title="资源池"
          extra={<Tag color={canEdit ? 'green' : 'default'}>{canEdit ? '可拖入' : '只读'}</Tag>}
          bodyStyle={{ padding: 12, maxHeight: 620, overflow: 'auto' }}
        >
          {poolLoading ? (
            <Loading tip="加载资源池..." />
          ) : (
            poolSections.map((section) => (
              <div key={section.key}>
                <Divider orientation="left" plain>
                  {section.title}
                </Divider>
                <List
                  size="small"
                  dataSource={resourcePool[section.key]}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资源" /> }}
                  renderItem={(item) => (
                    <List.Item
                      draggable={canEdit}
                      onDragStart={(event) =>
                        handleDragStart(event, {
                          type: section.type,
                          resourceId: item.id,
                          label: item.label,
                        })
                      }
                      style={{
                        cursor: canEdit ? 'grab' : 'default',
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        padding: '8px 10px',
                        marginBottom: 8,
                        background: '#fff',
                      }}
                    >
                      <Space direction="vertical" size={0}>
                        <Text strong ellipsis style={{ maxWidth: 230 }}>
                          {item.label}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {nodeTypeLabels[item.type]}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            ))
          )}
        </Card>

        {loading ? (
          <Card>
            <Loading tip="加载团队画布..." />
          </Card>
        ) : (
          <ResourceGraph
            nodes={renderedNodes}
            edges={filteredEdges}
            canEdit={canEdit}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={openNodeTarget}
            onDropResource={handleDropResource}
            onNodeMove={handleNodeMove}
            onNodeResize={handleNodeResize}
            onConnectNodes={handleConnectNodes}
            onEdgeClick={handleEdgeClick}
            onEdgeDelete={handleEdgeDelete}
            onNodeDelete={handleNodeDelete}
          />
        )}

        <Card title="属性与编排" bodyStyle={{ minHeight: 620 }}>
          {!selectedNode && !selectedEdge ? (
            <Empty description="选择节点或关系边后进行编辑" />
          ) : selectedEdge ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text type="secondary">当前关系边</Text>
                <Title level={5} style={{ margin: '4px 0 0' }}>
                  {nodeMap.get(selectedEdge.source)?.label ?? selectedEdge.source}
                  {' -> '}
                  {nodeMap.get(selectedEdge.target)?.label ?? selectedEdge.target}
                </Title>
              </div>
              <div>
                <Text type="secondary">关系类型</Text>
                <Select
                  value={selectedEdge.relationType ?? (selectedEdge.label as GraphRelationType)}
                  style={{ width: '100%', marginTop: 8 }}
                  options={relationTypes.map((item) => ({
                    value: item.value,
                    label: `${item.label} / ${item.value}`,
                  }))}
                  disabled={!canEdit}
                  onChange={handleEdgeRelationChange}
                />
              </div>
              <Button
                danger
                disabled={!canEdit || !selectedEdge.id}
                onClick={() => selectedEdge.id && handleEdgeDelete(selectedEdge.id)}
              >
                删除关系边
              </Button>
            </Space>
          ) : selectedNode ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text type="secondary">当前节点</Text>
                <Title level={5} style={{ margin: '4px 0 0' }}>
                  {selectedNode.label}
                </Title>
                <Tag>{nodeTypeLabels[selectedNode.type as GraphNodeType]}</Tag>
              </div>

              <Form
                key={selectedNode.id}
                layout="vertical"
                size="small"
                initialValues={{
                  title: selectedNode.label,
                  description: selectedNode.description,
                }}
                onFinish={handleRenameNode}
                disabled={!canEdit}
              >
                <Form.Item
                  label="显示名称"
                  name="title"
                  rules={[{ required: true, message: '请输入显示名称' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="节点说明" name="description">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Button htmlType="submit" size="small" disabled={!canEdit}>
                  保存节点信息
                </Button>
              </Form>

              {selectedNode.type === 'milestone' ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="里程碑节点可作为父节点"
                    description="任务、文档、成员和 Git 仓库节点可以挂载到该里程碑下；当前选中里程碑时，新拖入资源会自动挂到它下面。"
                  />
                  <div>
                    <Text type="secondary">添加已有节点为子节点</Text>
                    <Select
                      showSearch
                      placeholder="选择画布中的节点"
                      style={{ width: '100%', marginTop: 8 }}
                      options={childCandidateOptions}
                      disabled={!canEdit || childCandidateOptions.length === 0}
                      value={undefined}
                      onChange={handleAttachChild}
                    />
                  </div>
                  <List
                    size="small"
                    header={`子节点 (${childNodes.length})`}
                    dataSource={childNodes}
                    locale={{ emptyText: '暂无子节点' }}
                    renderItem={(child) => (
                      <List.Item
                        actions={[
                          <Button
                            key="detach"
                            type="link"
                            size="small"
                            disabled={!canEdit}
                            onClick={() => handleDetachChild(child.id)}
                          >
                            移出
                          </Button>,
                        ]}
                      >
                        <Text ellipsis style={{ maxWidth: 150 }}>
                          {child.label}
                        </Text>
                      </List.Item>
                    )}
                  />
                </Space>
              ) : (
                <div>
                  <Text type="secondary">父里程碑</Text>
                  <Select
                    allowClear
                    value={selectedNode.parentNodeId ?? undefined}
                    placeholder="选择里程碑父节点"
                    style={{ width: '100%', marginTop: 8 }}
                    options={milestoneOptions}
                    disabled={!canEdit}
                    onChange={(value) => handleParentChange(value ?? null)}
                  />
                </div>
              )}

              {selectedNode.type === 'git_repo' && typeof selectedNode.data?.url === 'string' && (
                <Button
                  type="link"
                  style={{ padding: 0 }}
                  onClick={() =>
                    window.open(selectedNode.data?.url as string, '_blank', 'noopener,noreferrer')
                  }
                >
                  打开仓库 URL
                </Button>
              )}

              <Divider />
              <Space wrap>
                <Button onClick={() => openNodeTarget(selectedNode.id)}>
                  打开详情
                </Button>
                <Button danger disabled={!canEdit} onClick={confirmDeleteSelectedNode}>
                  删除节点
                </Button>
              </Space>
              <Text type="secondary">
                连线类型由顶部选择框决定。选定类型后，从一个节点的连接点拖到另一个节点即可保存关系边。选中节点或边后可按 Delete/Backspace 删除。
              </Text>
            </Space>
          ) : null}
        </Card>
      </div>

      <Modal
        title="新增 Git 仓库节点"
        open={gitModalOpen}
        onCancel={() => setGitModalOpen(false)}
        onOk={handleCreateGitRepo}
        okText="创建节点"
        destroyOnClose
      >
        <Form form={gitForm} layout="vertical" preserve={false}>
          <Form.Item
            label="仓库名称"
            name="title"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input prefix={<PlusOutlined />} placeholder="例如：frontend-web" />
          </Form.Item>
          <Form.Item
            label="仓库 URL"
            name="url"
            rules={[
              { required: true, message: '请输入仓库 URL' },
              { type: 'url', message: '请输入合法 URL' },
            ]}
          >
            <Input placeholder="https://github.com/org/repo" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="可选，说明仓库支撑的业务范围" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ResourceGraphPage;
