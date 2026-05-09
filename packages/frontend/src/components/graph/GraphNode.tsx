import React from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from 'reactflow';
import { Typography, Tag } from 'antd';

const { Text } = Typography;

export interface GraphNodeData {
  label: string;
  type: 'document' | 'git_repo' | 'member' | 'milestone' | 'resource' | 'task';
  status?: string;
  description?: string;
  parentLabel?: string;
  canResize?: boolean;
  isParent?: boolean;
}

const nodeColors: Record<string, { bg: string; border: string; tagColor: string }> = {
  document: { bg: '#e6f7ff', border: '#1890ff', tagColor: 'blue' },
  git_repo: { bg: '#f0f5ff', border: '#2f54eb', tagColor: 'geekblue' },
  resource: { bg: '#e6f7ff', border: '#1890ff', tagColor: 'blue' },
  task: { bg: '#fff7e6', border: '#fa8c16', tagColor: 'orange' },
  member: { bg: '#f6ffed', border: '#52c41a', tagColor: 'green' },
  milestone: { bg: '#f9f0ff', border: '#722ed1', tagColor: 'purple' },
};

const nodeTypeLabels: Record<string, string> = {
  document: '文档',
  git_repo: 'Git 仓库',
  member: '成员',
  milestone: '里程碑',
  resource: '资源',
  task: '任务',
};

const GraphNode: React.FC<NodeProps<GraphNodeData>> = ({ data }) => {
  const colors = nodeColors[data.type] || nodeColors.resource;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        minWidth: 160,
        minHeight: data.isParent ? 180 : 82,
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <NodeResizer
        isVisible={Boolean(data.canResize)}
        minWidth={data.isParent ? 260 : 160}
        minHeight={data.isParent ? 180 : 82}
        handleStyle={{
          width: 9,
          height: 9,
          borderColor: colors.border,
          background: '#fff',
          zIndex: 20,
        }}
        lineStyle={{ borderColor: colors.border, zIndex: 19 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: colors.border }} />
      <div
        className="graph-node-drag-handle"
        style={{
          cursor: data.canResize ? 'grab' : 'pointer',
          margin: '-2px -4px 6px',
          padding: '2px 4px',
        }}
      >
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
          {data.label}
        </Text>
      </div>
      <div className="nodrag">
        {data.status && (
          <Tag color={colors.tagColor} style={{ fontSize: 10, margin: 0 }}>
            {data.status}
          </Tag>
        )}
        <Tag color={colors.tagColor} style={{ fontSize: 10, marginLeft: data.status ? 4 : 0 }}>
          {nodeTypeLabels[data.type] ?? data.type}
        </Tag>
        {data.parentLabel && (
          <Tag color="purple" style={{ fontSize: 10, marginTop: 4 }}>
            父级: {data.parentLabel}
          </Tag>
        )}
        {data.description && (
          <Text
            type="secondary"
            style={{ fontSize: 11, display: 'block', marginTop: 4 }}
            ellipsis
          >
            {data.description}
          </Text>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: colors.border }}
      />
    </div>
  );
};

export default GraphNode;
