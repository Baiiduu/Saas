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

const ApprovalForm: React.FC<ApprovalFormProps> = ({ open, onClose, teamId }) => {
  const [form] = Form.useForm();
  const { data: templates, isLoading: templatesLoading } = useApprovalTemplates();
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

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const renderDynamicFields = useCallback(() => {
    if (!selectedTemplate?.formFields) return null;

    const fields = (Array.isArray(selectedTemplate.formFields)
      ? (selectedTemplate.formFields as unknown as Array<{
          name: string;
          label: string;
          type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'switch';
          required?: boolean;
          options?: { label: string; value: string }[];
        }>)
      : []);

    if (fields.length === 0) return null;

    return fields.map((field) => (
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
  }, [selectedTemplate]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({
        title: values.title,
        templateId: values.templateId,
        formData: values.formData || {},
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

        {selectedTemplate && selectedTemplate.formFields && (
          <Card title="表单字段" size="small" style={{ marginTop: 16 }}>
            {renderDynamicFields()}
          </Card>
        )}

        {selectedTemplate && !selectedTemplate.formFields && (
          <Text type="secondary">该模板没有额外的表单字段</Text>
        )}
      </Form>
    </Modal>
  );
};

export default ApprovalForm;
