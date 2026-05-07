import React, { useState, useCallback } from 'react';
import { Modal, Form, Input, ColorPicker, Button, List, Space, Typography, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TaskStatus } from '@saas/shared-types';

const { Text } = Typography;

export interface ColumnConfig {
  status: TaskStatus;
  title: string;
  color: string;
  visible: boolean;
}

export interface BoardColumnConfigProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onSave: (columns: ColumnConfig[]) => Promise<void>;
}

const BoardColumnConfig: React.FC<BoardColumnConfigProps> = ({
  open,
  onClose,
  columns,
  onSave,
}) => {
  const [editingColumns, setEditingColumns] = useState<ColumnConfig[]>([...columns]);
  const [saving, setSaving] = useState(false);

  const handleTitleChange = useCallback(
    (index: number, title: string) => {
      const updated = [...editingColumns];
      updated[index] = { ...updated[index], title };
      setEditingColumns(updated);
    },
    [editingColumns]
  );

  const handleColorChange = useCallback(
    (index: number, color: string) => {
      const updated = [...editingColumns];
      updated[index] = { ...updated[index], color };
      setEditingColumns(updated);
    },
    [editingColumns]
  );

  const handleVisibilityToggle = useCallback(
    (index: number) => {
      const updated = [...editingColumns];
      updated[index] = { ...updated[index], visible: !updated[index].visible };
      setEditingColumns(updated);
    },
    [editingColumns]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(editingColumns);
      message.success('看板配置已保存');
      onClose();
    } catch {
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  }, [editingColumns, onSave, onClose]);

  return (
    <Modal
      title="看板列配置"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={500}
    >
      <List
        dataSource={editingColumns}
        renderItem={(col, index) => (
          <List.Item
            actions={[
              <Button
                key="toggle"
                size="small"
                type={col.visible ? 'primary' : 'default'}
                onClick={() => handleVisibilityToggle(index)}
              >
                {col.visible ? '显示' : '隐藏'}
              </Button>,
            ]}
          >
            <Space style={{ flex: 1 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: col.color,
                  display: 'inline-block',
                }}
              />
              <Input
                value={col.title}
                onChange={(e) => handleTitleChange(index, e.target.value)}
                style={{ width: 120 }}
                size="small"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({col.status})
              </Text>
            </Space>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default BoardColumnConfig;
