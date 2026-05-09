import React, { useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Switch,
  message,
  Typography,
  Card,
  Space,
} from 'antd';
import { useApprovalTemplates, useCreateApproval } from '@/hooks/useApprovals';

const { TextArea } = Input;
const { Text } = Typography;

export interface ApprovalFormProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  formFields: Record<string, unknown>;
}

interface ApprovalField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'switch';
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

function normalizeTemplateFields(formFields?: Record<string, unknown>): ApprovalField[] {
  if (!formFields) return [];
  const rawFields = Array.isArray(formFields)
    ? formFields
    : Array.isArray((formFields as { fields?: unknown }).fields)
      ? ((formFields as { fields: unknown[] }).fields)
      : Object.entries(formFields).map(([name, config]) => ({
          name,
          ...(typeof config === 'object' && config ? (config as Record<string, unknown>) : {}),
        }));

  return rawFields
    .map((field): ApprovalField | null => {
      if (!field || typeof field !== 'object') return null;
      const raw = field as Record<string, unknown>;
      const name = String(raw.name || raw.key || '').trim();
      if (!name) return null;
      const rawOptions = Array.isArray(raw.options) ? raw.options : [];
      return {
        name,
        label: String(raw.label || name),
        type: (raw.type === 'boolean' ? 'switch' : raw.type || 'text') as ApprovalField['type'],
        required: Boolean(raw.required),
        options: rawOptions.map((option) =>
          typeof option === 'string'
            ? { label: option, value: option }
            : {
                label: String((option as Record<string, unknown>)?.label ?? ''),
                value: String((option as Record<string, unknown>)?.value ?? ''),
              }
        ),
      };
    })
    .filter((field): field is ApprovalField => Boolean(field));
}

function normalizeFormData(data: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (value && typeof value === 'object' && 'toISOString' in value) {
        return [key, (value as { toISOString: () => string }).toISOString()];
      }
      return [key, value];
    })
  );
}

const ApprovalForm: React.FC<ApprovalFormProps> = ({ open, onClose, teamId }) => {
  const [form] = Form.useForm();
  const { data: templates, isLoading: templatesLoading } = useApprovalTemplates(teamId);
  const createMutation = useCreateApproval();

  const templateOptions: TemplateOption[] = useMemo(
    () => (templates ?? []) as TemplateOption[],
    [templates]
  );

  const selectedTemplateId = Form.useWatch('templateId', form);

  const selectedTemplate = useMemo(
    () => templateOptions.find((t) => t.id === selectedTemplateId),
    [templateOptions, selectedTemplateId]
  );

  const selectedFields = useMemo(
    () => normalizeTemplateFields(selectedTemplate?.formFields),
    [selectedTemplate]
  );

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const renderDynamicFields = useCallback(() => {
    if (selectedFields.length === 0) return null;

    return selectedFields.map((field) => (
      <Form.Item
        key={field.name}
        name={['formData', field.name]}
        label={field.label}
        rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined}
      >
        {field.type === 'textarea' ? (
          <TextArea rows={3} placeholder={`请输入${field.label}`} />
        ) : field.type === 'number' ? (
          <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.label}`} />
        ) : field.type === 'date' ? (
          <DatePicker style={{ width: '100%' }} />
        ) : field.type === 'select' ? (
          <Select
            placeholder={`请选择${field.label}`}
            options={field.options}
          />
        ) : field.type === 'switch' ? (
          <Switch />
        ) : (
          <Input placeholder={`请输入${field.label}`} />
        )}
      </Form.Item>
    ));
  }, [selectedFields]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({
        title: values.title,
        templateId: values.templateId,
        formData: normalizeFormData(values.formData || {}),
        teamId,
      });
      message.success('审批已提交');
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('提交失败，请重试');
    }
  }, [form, createMutation, teamId, onClose]);

  return (
    <Modal
      title="发起审批"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={createMutation.isPending}
      destroyOnClose
      width={600}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="title"
          label="审批标题"
          rules={[{ required: true, message: '请输入审批标题' }]}
        >
          <Input placeholder="请输入审批标题" />
        </Form.Item>

        <Form.Item
          name="templateId"
          label="审批模板"
          rules={[{ required: true, message: '请选择审批模板' }]}
        >
          <Select
            placeholder="选择审批模板"
            loading={templatesLoading}
            options={templateOptions.map((t) => ({
              label: t.name,
              value: t.id,
              desc: t.description,
            }))}
            optionRender={(option) => (
              <div>
                <Text strong>{option.data.label}</Text>
                {option.data.desc && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {option.data.desc}
                    </Text>
                  </div>
                )}
              </div>
            )}
          />
        </Form.Item>

        {selectedTemplate && (
          <Card title="表单字段" size="small" style={{ marginTop: 16 }}>
            {selectedFields.length > 0 ? renderDynamicFields() : (
              <Text type="secondary">该模板没有额外的表单字段</Text>
            )}
          </Card>
        )}
      </Form>
    </Modal>
  );
};

export default ApprovalForm;
