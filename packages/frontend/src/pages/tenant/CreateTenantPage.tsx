import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, Card, Typography, message, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useCreateTenant } from '@/hooks/useTenant';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { orgPath } from '@/router/routes';
import type { ITenant } from '@saas/shared-types';

const { Title } = Typography;

const INDUSTRY_OPTIONS = [
  '互联网/IT',
  '金融',
  '医疗',
  '教育',
  '制造业',
  '服务业',
  '其他',
];

const SCALE_OPTIONS = [
  '小型 (1-50人)',
  '中型 (51-200人)',
  '大型 (200人以上)',
];

interface CreateTenantFormValues {
  name: string;
  industry?: string;
  scale?: string;
}

const CreateTenantPage: React.FC = () => {
  const navigate = useNavigate();
  const createTenantMutation = useCreateTenant();
  const setCurrentTenant = useWorkspaceStore((s) => s.setCurrentTenant);
  const setTenants = useWorkspaceStore((s) => s.setTenants);
  const tenants = useWorkspaceStore((s) => s.tenants);
  const [form] = Form.useForm<CreateTenantFormValues>();

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const onFinish = useCallback(
    async (values: CreateTenantFormValues) => {
      try {
        const newTenant = await createTenantMutation.mutateAsync({
          name: values.name,
          industry: values.industry,
          scale: values.scale,
        });
        // Update store with new tenant
        setTenants([...tenants, newTenant]);
        setCurrentTenant(newTenant);
        message.success('企业创建成功');
        navigate(orgPath(newTenant.id));
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err.response?.data?.message || err.message || '创建企业失败，请重试';
        message.error(errorMessage);
      }
    },
    [createTenantMutation, setTenants, setCurrentTenant, tenants, navigate]
  );

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={handleBack}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          创建新企业
        </Title>

        <Form<CreateTenantFormValues>
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="name"
            label="企业名称"
            rules={[
              { required: true, message: '请输入企业名称' },
              { min: 2, message: '企业名称至少为 2 个字符' },
              { max: 100, message: '企业名称不能超过 100 个字符' },
            ]}
          >
            <Input placeholder="请输入企业名称" size="large" />
          </Form.Item>

          <Form.Item name="industry" label="所属行业">
            <Select placeholder="请选择行业" size="large" allowClear>
              {INDUSTRY_OPTIONS.map((opt) => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="scale" label="企业规模">
            <Select placeholder="请选择规模" size="large" allowClear>
              {SCALE_OPTIONS.map((opt) => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={createTenantMutation.isPending}
            >
              创建企业
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateTenantPage;
