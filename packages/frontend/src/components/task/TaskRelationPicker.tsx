import React, { useState, useCallback } from 'react';
import { Modal, Select, Space, Tag, Button, message, Typography } from 'antd';
import { PlusOutlined, LinkOutlined } from '@ant-design/icons';
import type { ITask } from '@saas/shared-types';

const { Text } = Typography;

export interface TaskRelationPickerProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  relatedTasks: ITask[];
  onAddRelation: (relatedTaskId: string, relationType: string) => Promise<void>;
  onRemoveRelation: (relatedTaskId: string) => Promise<void>;
  availableTasks: ITask[];
}

const RELATION_TYPES = [
  { value: 'BLOCKS', label: '阻塞' },
  { value: 'BLOCKED_BY', label: '被阻塞' },
  { value: 'RELATES_TO', label: '关联' },
  { value: 'DUPLICATES', label: '重复' },
];

const relationLabelMap: Record<string, string> = {
  BLOCKS: '阻塞',
  BLOCKED_BY: '被阻塞',
  RELATES_TO: '关联',
  DUPLICATES: '重复',
};

const TaskRelationPicker: React.FC<TaskRelationPickerProps> = ({
  open,
  onClose,
  taskId,
  relatedTasks,
  onAddRelation,
  onRemoveRelation,
  availableTasks,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [relationType, setRelationType] = useState<string>('RELATES_TO');
  const [adding, setAdding] = useState(false);

  const existingIds = new Set(relatedTasks.map((t) => t.id));
  const filteredAvailable = availableTasks.filter(
    (t) => t.id !== taskId && !existingIds.has(t.id)
  );

  const handleAdd = useCallback(async () => {
    if (!selectedTaskId) return;
    setAdding(true);
    try {
      await onAddRelation(selectedTaskId, relationType);
      message.success('关联已添加');
      setSelectedTaskId(undefined);
    } catch {
      message.error('添加关联失败');
    } finally {
      setAdding(false);
    }
  }, [selectedTaskId, relationType, onAddRelation]);

  const handleRemove = useCallback(
    async (relTaskId: string) => {
      try {
        await onRemoveRelation(relTaskId);
        message.success('关联已移除');
      } catch {
        message.error('移除关联失败');
      }
    },
    [onRemoveRelation]
  );

  return (
    <Modal
      title="任务关联管理"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong>已关联任务</Text>
        {relatedTasks.length === 0 ? (
          <div style={{ padding: '12px 0', color: '#999' }}>暂无关联任务</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {relatedTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Space>
                  <LinkOutlined />
                  <Text>{task.title}</Text>
                  {(task as unknown as Record<string, string>).relationType && (
                    <Tag color="blue">
                      {relationLabelMap[(task as unknown as Record<string, string>).relationType] || ''}
                    </Tag>
                  )}
                </Space>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => handleRemove(task.id)}
                >
                  移除
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
        <Text strong>添加关联</Text>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Select
            placeholder="选择关联任务"
            value={selectedTaskId}
            onChange={setSelectedTaskId}
            style={{ flex: 1, minWidth: 200 }}
            showSearch
            optionFilterProp="label"
            options={filteredAvailable.map((t) => ({
              value: t.id,
              label: `${t.title} (${t.status})`,
            }))}
          />
          <Select
            value={relationType}
            onChange={setRelationType}
            style={{ width: 120 }}
            options={RELATION_TYPES}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={adding}
            disabled={!selectedTaskId}
          >
            添加
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TaskRelationPicker;
