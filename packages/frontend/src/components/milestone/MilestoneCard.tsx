import React from 'react';
import { Card, Typography, Tag, Progress, Space, Tooltip } from 'antd';
import {
  FlagOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { IMilestone } from '@saas/shared-types';

const { Text } = Typography;

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  active: { color: 'processing', icon: <ClockCircleOutlined />, label: '进行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  overdue: { color: 'error', icon: <ClockCircleOutlined />, label: '已逾期' },
};

export interface MilestoneCardProps {
  milestone: IMilestone;
  onClick?: (milestone: IMilestone) => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, onClick }) => {
  const config = statusConfig[milestone.status] || statusConfig.active;

  const isOverdue =
    milestone.status === 'overdue' ||
    (milestone.dueDate &&
      new Date(milestone.dueDate) < new Date() &&
      milestone.status !== 'completed');

  return (
    <Card
      hoverable
      size="small"
      onClick={() => onClick?.(milestone)}
      style={{
        marginBottom: 12,
        borderLeft: `3px solid ${
          milestone.status === 'completed'
            ? '#52c41a'
            : isOverdue
            ? '#ff4d4f'
            : '#1890ff'
        }`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <Space>
          <FlagOutlined
            style={{
              color:
                milestone.status === 'completed' ? '#52c41a' : '#1890ff',
            }}
          />
          <Text strong>{milestone.name}</Text>
        </Space>
        <Tag color={config.color} icon={config.icon}>
          {config.label}
        </Tag>
      </div>

      {milestone.description && (
        <Text
          type="secondary"
          style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
          ellipsis
        >
          {milestone.description}
        </Text>
      )}

      <Progress
        percent={milestone.progress}
        size="small"
        status={
          milestone.status === 'completed'
            ? 'success'
            : isOverdue
            ? 'exception'
            : 'active'
        }
      />

      {milestone.dueDate && (
        <div style={{ marginTop: 6 }}>
          <Text
            type={isOverdue ? 'danger' : 'secondary'}
            style={{ fontSize: 11 }}
          >
            <CalendarOutlined />{' '}
            {new Date(milestone.dueDate).toLocaleDateString('zh-CN')}
            {isOverdue && ' (已逾期)'}
          </Text>
        </div>
      )}
    </Card>
  );
};

export default MilestoneCard;
