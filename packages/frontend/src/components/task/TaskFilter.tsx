import React, { useState, useCallback } from 'react';
import { Space, Tag, Button, Modal, Form, Select, DatePicker, Input } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { Priority, TaskStatus } from '@saas/shared-types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export interface TaskFilterValues {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  search?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
}

export interface TaskFilterProps {
  values: TaskFilterValues;
  onChange: (values: TaskFilterValues) => void;
  memberOptions?: { label: string; value: string }[];
  memberLoading?: boolean;
}

const statusOptions = [
  { label: '待办', value: TaskStatus.TODO },
  { label: '进行中', value: TaskStatus.IN_PROGRESS },
  { label: '已完成', value: TaskStatus.DONE },
  { label: '已关闭', value: TaskStatus.CLOSED },
];

const priorityOptions = [
  { label: '低', value: Priority.LOW },
  { label: '中', value: Priority.MEDIUM },
  { label: '高', value: Priority.HIGH },
  { label: '紧急', value: Priority.URGENT },
];

const TaskFilter: React.FC<TaskFilterProps> = ({
  values,
  onChange,
  memberOptions = [],
  memberLoading = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const activeChips: { label: string; onClose: () => void }[] = [];

  if (values.status) {
    const label = statusOptions.find((o) => o.value === values.status)?.label || values.status;
    activeChips.push({
      label: `状态: ${label}`,
      onClose: () => onChange({ ...values, status: undefined }),
    });
  }
  if (values.priority) {
    const label = priorityOptions.find((o) => o.value === values.priority)?.label || values.priority;
    activeChips.push({
      label: `优先级: ${label}`,
      onClose: () => onChange({ ...values, priority: undefined }),
    });
  }
  if (values.assigneeId) {
    const label = memberOptions.find((o) => o.value === values.assigneeId)?.label || values.assigneeId;
    activeChips.push({
      label: `负责人: ${label}`,
      onClose: () => onChange({ ...values, assigneeId: undefined }),
    });
  }
  if (values.search) {
    activeChips.push({
      label: `搜索: ${values.search}`,
      onClose: () => onChange({ ...values, search: undefined }),
    });
  }

  const handleOpenModal = useCallback(() => {
    form.setFieldsValue({
      status: values.status,
      priority: values.priority,
      assigneeId: values.assigneeId,
      search: values.search,
      dueDateRange:
        values.dueDateStart && values.dueDateEnd
          ? [dayjs(values.dueDateStart), dayjs(values.dueDateEnd)]
          : undefined,
    });
    setModalOpen(true);
  }, [form, values]);

  const handleModalOk = useCallback(() => {
    const formValues = form.getFieldsValue();
    onChange({
      status: formValues.status || undefined,
      priority: formValues.priority || undefined,
      assigneeId: formValues.assigneeId || undefined,
      search: formValues.search || undefined,
      dueDateStart: formValues.dueDateRange?.[0]?.format('YYYY-MM-DD'),
      dueDateEnd: formValues.dueDateRange?.[1]?.format('YYYY-MM-DD'),
    });
    setModalOpen(false);
  }, [form, onChange]);

  const handleClearAll = useCallback(() => {
    onChange({});
  }, [onChange]);

  return (
    <div>
      <Space size={8} wrap style={{ marginBottom: 16 }}>
        <Button icon={<FilterOutlined />} onClick={handleOpenModal}>
          高级筛选
        </Button>

        {activeChips.map((chip, index) => (
          <Tag key={index} closable onClose={chip.onClose}>
            {chip.label}
          </Tag>
        ))}

        {activeChips.length > 0 && (
          <Button
            type="link"
            icon={<ClearOutlined />}
            size="small"
            onClick={handleClearAll}
          >
            清除筛选
          </Button>
        )}
      </Space>

      <Modal
        title="高级筛选"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="search" label="搜索">
            <Input.Search placeholder="搜索任务标题..." allowClear />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="选择状态"
              options={statusOptions}
            />
          </Form.Item>

          <Form.Item name="priority" label="优先级">
            <Select
              allowClear
              placeholder="选择优先级"
              options={priorityOptions}
            />
          </Form.Item>

          <Form.Item name="assigneeId" label="负责人">
            <Select
              allowClear
              placeholder="选择负责人"
              options={memberOptions}
              loading={memberLoading}
              notFoundContent={memberLoading ? '加载中...' : undefined}
            />
          </Form.Item>

          <Form.Item name="dueDateRange" label="截止日期范围">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskFilter;
