import React, { useEffect, useCallback, useMemo } from 'react';
import { Modal, Form, Input, Select, DatePicker, Space, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { Priority } from '@saas/shared-types';
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { useTeamMembers } from '@/hooks/useTenant';
import MemberAvatar from '@/components/member/MemberAvatar';
import type { ITask } from '@saas/shared-types';

const { Text } = Typography;

export interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  editTask?: ITask | null;
}

const priorityOptions = [
  { label: '低', value: Priority.LOW },
  { label: '中', value: Priority.MEDIUM },
  { label: '高', value: Priority.HIGH },
  { label: '紧急', value: Priority.URGENT },
];

const TaskForm: React.FC<TaskFormProps> = ({ open, onClose, teamId, editTask }) => {
  const [form] = Form.useForm();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const isEditing = !!editTask;

  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId);

  const memberOptions = useMemo(() => {
    return (members ?? []).map(m => ({
      label: m.displayName || m.userId,
      value: m.userId,
      email: m.email,
      avatarUrl: m.avatarUrl,
    }));
  }, [members]);

  useEffect(() => {
    if (open) {
      if (editTask) {
        form.setFieldsValue({
          title: editTask.title,
          description: editTask.description || '',
          priority: editTask.priority,
          assigneeId: editTask.assigneeId || undefined,
          dueDate: editTask.dueDate ? dayjs(editTask.dueDate) : undefined,
          tags: editTask.tags || [],
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editTask, form]);

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (isEditing && editTask) {
        await updateMutation.mutateAsync({
          id: editTask.id,
          data: {
            title: values.title,
            description: values.description,
            priority: values.priority,
            assigneeId: values.assigneeId || undefined,
            dueDate: values.dueDate?.toISOString(),
            tags: values.tags || [],
          },
        });
        message.success('任务更新成功');
      } else {
        await createMutation.mutateAsync({
          title: values.title,
          description: values.description,
          priority: values.priority,
          assigneeId: values.assigneeId || undefined,
          dueDate: values.dueDate?.toISOString(),
          teamId,
          tags: values.tags || [],
        });
        message.success('任务创建成功');
      }
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Form validation error — do nothing
        return;
      }
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '操作失败');
    }
  }, [form, isEditing, editTask, updateMutation, createMutation, teamId, onClose]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onClose();
  }, [form, onClose]);

  return (
    <Modal
      title={isEditing ? '编辑任务' : '创建任务'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="title"
          label="任务标题"
          rules={[
            { required: true, message: '请输入任务标题' },
            { max: 200, message: '标题不能超过 200 个字符' },
          ]}
        >
          <Input placeholder="请输入任务标题" />
        </Form.Item>

        <Form.Item name="description" label="任务描述">
          <Input.TextArea rows={3} placeholder="请输入任务描述（选填）" />
        </Form.Item>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item
            name="priority"
            label="优先级"
            initialValue={Priority.MEDIUM}
            rules={[{ required: true, message: '请选择优先级' }]}
            style={{ flex: 1 }}
          >
            <Select options={priorityOptions} />
          </Form.Item>

          <Form.Item name="assigneeId" label="负责人" style={{ flex: 1 }}>
            <Select
              allowClear
              placeholder={members.length === 0 ? '暂无团队成员' : '选择负责人（选填）'}
              loading={membersLoading}
              options={memberOptions}
              optionRender={(option) => {
                const data = option.data as typeof option.data & { email?: string; avatarUrl?: string };
                return (
                  <Space>
                    <MemberAvatar
                      user={{ displayName: data.label, avatarUrl: data.avatarUrl }}
                      size={20}
                    />
                    <span>{data.label}</span>
                    {data.email && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{data.email}</Text>
                    )}
                  </Space>
                );
              }}
            />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={16}>
          <Form.Item name="dueDate" label="截止日期" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="tags" label="标签" style={{ flex: 1 }}>
            <Select
              mode="tags"
              placeholder="输入标签后回车"
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
};

export default TaskForm;
