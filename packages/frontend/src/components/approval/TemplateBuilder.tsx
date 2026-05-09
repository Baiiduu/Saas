import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Modal,
  Form,
  Input,
  Button,
  Select,
  Space,
  Typography,
  message,
  Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useCreateApprovalTemplate } from '@/hooks/useApprovals';
import { useTeamMembers } from '@/hooks/useTenant';
import { teamSubPath } from '@/router/routes';

const { Text } = Typography;

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date';
  required: boolean;
  options?: string[];
}

export interface TemplateBuilderProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
}

const FIELD_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'select', label: '下拉选择' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
];

const SCOPE_OPTIONS = [
  { value: 'attendance', label: '考勤' },
  { value: 'finance', label: '财务' },
  { value: 'general', label: '通用' },
  { value: 'custom', label: '自定义' },
];

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  open,
  onClose,
  teamId,
}) => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FormField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const createTemplate = useCreateApprovalTemplate();
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId);

  const handleAddField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${Date.now()}`,
        label: '',
        type: 'text',
        required: false,
      },
    ]);
  }, []);

  const handleRemoveField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFieldChange = useCallback(
    (index: number, field: Partial<FormField>) => {
      setFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, ...field } : f))
      );
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      // Validate fields
      const validFields = fields.filter((f) => f.label.trim());
      if (validFields.length === 0) {
        message.warning('请至少添加一个字段');
        return;
      }

      setSubmitting(true);
      const formFieldsConfig = {
        fields: validFields.map((f) => ({
          name: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.type === 'select' ? f.options || [] : undefined,
        })),
      };

      const nodes = [
        {
          name: '审批人',
          approverType: values.defaultApproverIds?.length > 1 ? 'multiple' : 'single',
          sortOrder: 1,
          config: { approverIds: values.defaultApproverIds || [] },
        },
      ];

      await createTemplate.mutateAsync({
        name: values.name,
        description: values.description,
        scope: values.scope || 'general',
        formFields: formFieldsConfig,
        teamId,
        nodes,
      });

      message.success('模板创建成功');
      form.resetFields();
      setFields([]);
      onClose();
      if (orgId) {
        navigate(teamSubPath(orgId, teamId, 'approvals/templates'));
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      message.error(axiosErr?.response?.data?.message || axiosErr?.message || '创建模板失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, fields, onClose, teamId, createTemplate, orgId, navigate]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setFields([]);
    onClose();
  }, [form, onClose]);

  return (
    <Modal
      title="新建审批模板"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={createTemplate.isPending}
      width={640}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：请假审批" />
        </Form.Item>

        <Form.Item name="description" label="模板描述">
          <Input.TextArea rows={2} placeholder="模板用途描述..." />
        </Form.Item>

        <Form.Item
          name="scope"
          label="适用范围"
          rules={[{ required: true, message: '请选择适用范围' }]}
          initialValue="general"
        >
          <Select options={SCOPE_OPTIONS} placeholder="选择适用范围" />
        </Form.Item>

        <Form.Item
          name="defaultApproverIds"
          label="默认接收审批人"
          rules={[{ required: true, message: '请选择默认审批接收人' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择审批默认接收人"
            loading={membersLoading}
            optionFilterProp="label"
            options={members.map((member) => ({
              label: member.displayName || member.email || member.userId,
              value: member.userId,
            }))}
          />
        </Form.Item>
      </Form>

      <Divider>
        <Space>
          <Text type="secondary">表单字段</Text>
          <Button
            size="small"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddField}
          >
            添加字段
          </Button>
        </Space>
      </Divider>

      {fields.map((field, index) => (
        <div
          key={field.key}
          style={{
            padding: 12,
            marginBottom: 8,
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            background: '#fafafa',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text strong style={{ fontSize: 13 }}>
              字段 {index + 1}
            </Text>
            <Button
              type="text"
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => handleRemoveField(index)}
            />
          </div>

          <Space style={{ width: '100%' }} wrap>
            <Input
              placeholder="字段标签"
              value={field.label}
              onChange={(e) => handleFieldChange(index, { label: e.target.value })}
              style={{ width: 160 }}
              size="small"
            />
            <Select
              value={field.type}
              onChange={(value) => handleFieldChange(index, { type: value })}
              style={{ width: 120 }}
              size="small"
              options={FIELD_TYPES}
            />
            <Select
              value={field.required ? 'required' : 'optional'}
              onChange={(value) =>
                handleFieldChange(index, { required: value === 'required' })
              }
              style={{ width: 100 }}
              size="small"
              options={[
                { value: 'optional', label: '选填' },
                { value: 'required', label: '必填' },
              ]}
            />
          </Space>

          {field.type === 'select' && (
            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="选项（用逗号分隔）"
                value={(field.options || []).join(', ')}
                onChange={(e) =>
                  handleFieldChange(index, {
                    options: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                size="small"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>
      ))}
    </Modal>
  );
};

export default TemplateBuilder;
