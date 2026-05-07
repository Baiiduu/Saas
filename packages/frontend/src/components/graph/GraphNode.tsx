import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Typography, Tag } from 'antd';

const { Text } = Typography;

export interface GraphNodeData {
  label: string;
  type: 'resource' | 'task' | 'member' | 'milestone';
  status?: string;
  description?: string;
}

const nodeColors: Record<string, { bg: string; border: string; tagColor: string }> = {
  resource: { bg: '#e6f7ff', border: '#1890ff', tagColor: 'blue' },
  task: { bg: '#fff7e6', border: '#fa8c16', tagColor: 'orange' },
  member: { bg: '#f6ffed', border: '#52c41a', tagColor: 'green' },
  milestone: { bg: '#f9f0ff', border: '#722ed1', tagColor: 'purple' },
};

const GraphNode: React.FC<NodeProps<GraphNodeData>> = ({ data }) => {
  const colors = nodeColors[data.type] || nodeColors.resource;

  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        minWidth: 160,
        maxWidth: 240,
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border }} />
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
          {data.label}
        </Text>
        {data.status && (
          <Tag color={colors.tagColor} style={{ fontSize: 10, margin: 0 }}>
            {data.status}
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
