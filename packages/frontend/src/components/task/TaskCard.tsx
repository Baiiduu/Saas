import React from 'react';
import { Card, Tag, Avatar, Typography, Space, Tooltip } from 'antd';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import {
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ITask } from '@saas/shared-types';
import { Priority, TaskStatus } from '@saas/shared-types';

const { Text } = Typography;

const priorityConfig: Record<Priority, { color: string; label: string }> = {
  [Priority.LOW]: { color: 'default', label: '低' },
  [Priority.MEDIUM]: { color: 'blue', label: '中' },
  [Priority.HIGH]: { color: 'orange', label: '高' },
  [Priority.URGENT]: { color: 'red', label: '紧急' },
};

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  [TaskStatus.TODO]: { color: '#f0f0f0', label: '待办' },
  [TaskStatus.IN_PROGRESS]: { color: '#e6f7ff', label: '进行中' },
  [TaskStatus.DONE]: { color: '#f6ffed', label: '已完成' },
  [TaskStatus.CLOSED]: { color: '#fffbe6', label: '已关闭' },
};

export interface TaskCardProps {
  task: ITask;
  onClick?: (task: ITask) => void;
  style?: React.CSSProperties;
  sortable?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, style, sortable = true }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !sortable,
    data: {
      type: 'task',
      taskId: task.id,
      status: task.status,
    },
  });

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CLOSED;

  return (
    <Card
      ref={setNodeRef}
      size="small"
      hoverable
      onClick={() => onClick?.(task)}
      {...(sortable ? attributes : {})}
      {...(sortable ? listeners : {})}
      style={{
        marginBottom: 8,
        cursor: 'pointer',
        borderLeft: `3px solid ${priorityConfig[task.priority]?.color === 'default' ? '#d9d9d9' : priorityConfig[task.priority]?.color || '#d9d9d9'}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 2 : 1,
        ...style,
      }}
      styles={{ body: { padding: 12 } }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }} ellipsis={{ tooltip: task.title }}>
          {task.title}
        </Text>
      </div>

      <Space size={4} wrap>
        <Tag color={priorityConfig[task.priority]?.color}>
          {priorityConfig[task.priority]?.label || task.priority}
        </Tag>

        {task.tags?.map((tag) => (
          <Tag key={tag} style={{ fontSize: 11 }}>
            {tag}
          </Tag>
        ))}
      </Space>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
        }}
      >
        <div>
          {task.assigneeId ? (
            <Tooltip title={`Assignee: ${task.assigneeId}`}>
              <Avatar size={22} icon={<UserOutlined />} />
            </Tooltip>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              未分配
            </Text>
          )}
        </div>

        {task.dueDate && (
          <Tooltip title={`截止日期: ${new Date(task.dueDate).toLocaleDateString('zh-CN')}`}>
            <Text
              type={isOverdue ? 'danger' : 'secondary'}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 2 }}
            >
              {isOverdue ? <ClockCircleOutlined /> : <CalendarOutlined />}
              {new Date(task.dueDate).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </Tooltip>
        )}
      </div>
    </Card>
  );
};

export default TaskCard;
