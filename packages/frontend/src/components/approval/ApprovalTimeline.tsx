import React from 'react';
import { Timeline, Typography, Tag, Space, Avatar, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ApprovalStatus } from '@saas/shared-types';

const { Text } = Typography;

export interface ApprovalNode {
  id: string;
  name: string;
  processorId?: string;
  processorName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  comment?: string;
  processedAt?: string;
}

export interface ApprovalTimelineProps {
  nodes: ApprovalNode[];
  currentProcessorId?: string;
}

const nodeStatusConfig: Record<
  string,
  { color: string; dot: React.ReactNode }
> = {
  pending: { color: 'blue', dot: <ClockCircleOutlined style={{ fontSize: 16 }} /> },
  approved: {
    color: 'green',
    dot: <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />,
  },
  rejected: {
    color: 'red',
    dot: <CloseCircleOutlined style={{ fontSize: 16, color: '#ff4d4f' }} />,
  },
  skipped: {
    color: 'gray',
    dot: <MinusCircleOutlined style={{ fontSize: 16, color: '#999' }} />,
  },
};

const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
  skipped: '已跳过',
};

const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({
  nodes,
  currentProcessorId,
}) => {
  return (
    <Timeline>
      {nodes.map((node) => {
        const config = nodeStatusConfig[node.status] || nodeStatusConfig.pending;
        const isCurrent =
          node.status === 'pending' && node.processorId === currentProcessorId;

        return (
          <Timeline.Item key={node.id} color={config.color} dot={config.dot}>
            <div>
              <Space>
                <Text strong>{node.name}</Text>
                <Tag color={config.color}>{statusLabelMap[node.status]}</Tag>
                {isCurrent && <Tag color="blue">当前节点</Tag>}
              </Space>

              <div style={{ marginTop: 4 }}>
                {node.processorName ? (
                  <Space size={4}>
                    <Avatar size={20} icon={<UserOutlined />} />
                    <Text type="secondary">{node.processorName}</Text>
                  </Space>
                ) : (
                  <Text type="secondary" italic>
                    待处理
                  </Text>
                )}
              </div>

              {node.processedAt && (
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(node.processedAt).toLocaleString('zh-CN')}
                  </Text>
                </div>
              )}

              {node.comment && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '6px 10px',
                    backgroundColor: '#fafafa',
                    borderRadius: 4,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {node.comment}
                  </Text>
                </div>
              )}
            </div>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
};

export default ApprovalTimeline;
