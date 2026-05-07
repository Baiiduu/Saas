import React, { useCallback, useState } from 'react';
import { Space, Button, Select, Typography, message, Popconfirm, Tag } from 'antd';
import {
  DeleteOutlined,
  SwapOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { TaskStatus } from '@saas/shared-types';

const { Text } = Typography;

export interface BatchActionBarProps {
  selectedIds: string[];
  totalCount: number;
  onBatchStatusChange: (ids: string[], status: TaskStatus) => Promise<void>;
  onBatchAssign: (ids: string[], assigneeId: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  memberOptions?: { value: string; label: string }[];
  memberLoading?: boolean;
}

const statusOptions = [
  { value: TaskStatus.TODO, label: '待办' },
  { value: TaskStatus.IN_PROGRESS, label: '进行中' },
  { value: TaskStatus.DONE, label: '已完成' },
  { value: TaskStatus.CLOSED, label: '已关闭' },
];

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedIds,
  totalCount,
  onBatchStatusChange,
  onBatchAssign,
  onBatchDelete,
  memberOptions = [],
  memberLoading = false,
}) => {
  const [batchStatus, setBatchStatus] = useState<TaskStatus | undefined>(undefined);
  const [batchAssignee, setBatchAssignee] = useState<string | undefined>(undefined);
  const [processing, setProcessing] = useState(false);

  const count = selectedIds.length;

  const handleStatusChange = useCallback(async () => {
    if (!batchStatus || count === 0) return;
    setProcessing(true);
    try {
      await onBatchStatusChange(selectedIds, batchStatus);
      message.success(`已更新 ${count} 个任务的状态`);
    } catch {
      message.error('批量更新状态失败');
    } finally {
      setProcessing(false);
    }
  }, [batchStatus, count, selectedIds, onBatchStatusChange]);

  const handleAssignChange = useCallback(async () => {
    if (!batchAssignee || count === 0) return;
    setProcessing(true);
    try {
      await onBatchAssign(selectedIds, batchAssignee);
      message.success(`已分配 ${count} 个任务`);
    } catch {
      message.error('批量分配失败');
    } finally {
      setProcessing(false);
    }
  }, [batchAssignee, count, selectedIds, onBatchAssign]);

  const handleDelete = useCallback(async () => {
    if (count === 0) return;
    setProcessing(true);
    try {
      await onBatchDelete(selectedIds);
      message.success(`已删除 ${count} 个任务`);
    } catch {
      message.error('批量删除失败');
    } finally {
      setProcessing(false);
    }
  }, [count, selectedIds, onBatchDelete]);

  if (count === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#e6f7ff',
        border: '1px solid #91d5ff',
        borderRadius: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Space>
        <Tag color="blue">{count}</Tag>
        <Text type="secondary">个任务已选择</Text>
      </Space>

      <Space wrap>
        <Select
          placeholder="更改状态"
          value={batchStatus}
          onChange={setBatchStatus}
          style={{ width: 120 }}
          options={statusOptions}
          allowClear
        />
        <Button
          icon={<SwapOutlined />}
          onClick={handleStatusChange}
          disabled={!batchStatus}
          loading={processing}
          size="small"
        >
          更新状态
        </Button>

        <Select
          placeholder="分配负责人"
          value={batchAssignee}
          onChange={setBatchAssignee}
          style={{ width: 140 }}
          options={memberOptions}
          allowClear
          loading={memberLoading}
          notFoundContent={memberLoading ? '加载中...' : undefined}
        />
        <Button
          icon={<UserAddOutlined />}
          onClick={handleAssignChange}
          disabled={!batchAssignee}
          loading={processing}
          size="small"
        >
          批量分配
        </Button>

        <Popconfirm
          title={`确定删除选中的 ${count} 个任务？`}
          onConfirm={handleDelete}
          okText="确定"
          cancelText="取消"
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={count === 0}
            loading={processing}
            size="small"
          >
            批量删除
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
};

export default BatchActionBar;
