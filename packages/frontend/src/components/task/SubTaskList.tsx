import React, { useState, useCallback } from 'react';
import { List, Checkbox, Button, Space, Typography, Tag, Popconfirm, message, Input } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { TaskStatus } from '@saas/shared-types';
import type { ITask } from '@saas/shared-types';

const { Text } = Typography;

export interface SubTaskListProps {
  parentTaskId: string;
  subTasks: ITask[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

const SubTaskList: React.FC<SubTaskListProps> = ({
  parentTaskId,
  subTasks,
  onAdd,
  onToggle,
  onDelete,
  loading = false,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await onAdd(title);
      setNewTitle('');
      message.success('子任务已添加');
    } catch {
      message.error('添加子任务失败');
    } finally {
      setAdding(false);
    }
  }, [newTitle, onAdd]);

  const handleToggle = useCallback(
    async (task: ITask) => {
      const done = task.status === TaskStatus.DONE;
      try {
        await onToggle(
          task.id,
          !done,
        );
      } catch {
        message.error('更新子任务状态失败');
      }
    },
    [onToggle]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await onDelete(id);
        message.success('子任务已删除');
      } catch {
        message.error('删除子任务失败');
      }
    },
    [onDelete]
  );

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Input
          placeholder="输入子任务标题..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={handleAdd}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          loading={adding}
          disabled={!newTitle.trim()}
        >
          添加
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={subTasks}
        locale={{ emptyText: '暂无子任务' }}
        renderItem={(task) => {
          const isDone = task.status === TaskStatus.DONE;
          return (
            <List.Item
              actions={[
                <Popconfirm
                  key="delete"
                  title="确定删除此子任务？"
                  onConfirm={() => handleDelete(task.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>,
              ]}
            >
              <Space>
                <Checkbox
                  checked={isDone}
                  onChange={() => handleToggle(task)}
                />
                <Text
                  style={{
                    textDecoration: isDone ? 'line-through' : undefined,
                    color: isDone ? '#999' : undefined,
                  }}
                >
                  {task.title}
                </Text>
                {task.dueDate && (
                  <Tag icon={<CalendarOutlined />} color="default" style={{ fontSize: 11 }}>
                    {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                  </Tag>
                )}
              </Space>
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default SubTaskList;
