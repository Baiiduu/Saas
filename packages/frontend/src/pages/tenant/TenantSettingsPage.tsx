import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Spin,
  Select,
  Divider,
  Space,
  Descriptions,
  Tag,
  Tabs,
} from 'antd';
import {
  SaveOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { get, patch, del } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePermission } from '@/hooks/usePermission';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import type { ITenant } from '@saas/shared-types';

const { Title, Text } = Typography;

interface TenantSettingsFormValues {
  name: string;
  industry?: string;
  scale?: string;
}

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: '科技/互联网' },
  { value: 'finance', label: '金融' },
  { value: 'education', label: '教育' },
  { value: 'healthcare', label: '医疗健康' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'retail', label: '零售' },
  { value: 'real_estate', label: '房地产' },
  { value: 'consulting', label: '咨询' },
  { value: 'media', label: '媒体/广告' },
  { value: 'other', label: '其他' },
];

const SCALE_OPTIONS = [
  { value: 'small', label: '小型企业 (1-50人)' },
  { value: 'medium', label: '中型企业 (51-500人)' },
  { value: 'large', label: '大型企业 (500人以上)' },
];

const TenantSettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const currentTenant = useWorkspaceStore((s) => s.currentTenant);
  const setCurrentTenant = useWorkspaceStore((s) => s.setCurrentTenant);
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();

  const [form] = Form.useForm<TenantSettingsFormValues>();
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = can('tenant.delete');
  const isOwner = currentTenant?.ownerId === user?.id;

  // Populate form with current tenant data
  useEffect(() => {
    if (currentTenant) {
      form.setFieldsValue({
        name: currentTenant.name,
        industry: currentTenant.industry,
        scale: currentTenant.scale,
      });
    }
  }, [currentTenant, form]);

  const onFinish = useCallback(
    async (values: TenantSettingsFormValues) => {
      if (!orgId) return;
      setSaving(true);
      try {
        const updated = await patch<ITenant>(`/tenants/${orgId}`, values);
        setCurrentTenant(updated);
        message.success('企业设置已更新');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '更新失败，请重试');
      } finally {
        setSaving(false);
      }
    },
    [orgId, setCurrentTenant]
  );

  const handleDeleteTenant = useCallback(async () => {
    if (!orgId) return;
    setDeleting(true);
    try {
      await del(`/tenants/${orgId}/unsubscribe`);
      message.success('企业已删除');
      // Navigate to tenant selection
      window.location.href = '/';
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '删除失败，请重试');
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }, [orgId]);

  if (!currentTenant) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin tip="加载企业信息..." size="large">
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <BankOutlined /> 基本信息
        </span>
      ),
      children: (
        <Card>
          <Title level={4} style={{ marginBottom: 24 }}>
            企业基本信息
          </Title>

          <Form<TenantSettingsFormValues>
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
              ]}
            >
              <Input placeholder="请输入企业名称" size="large" />
            </Form.Item>

            <Form.Item name="industry" label="所属行业">
              <Select
                placeholder="请选择行业"
                size="large"
                allowClear
                options={INDUSTRY_OPTIONS}
              />
            </Form.Item>

            <Form.Item name="scale" label="企业规模">
              <Select
                placeholder="请选择企业规模"
                size="large"
                allowClear
                options={SCALE_OPTIONS}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SaveOutlined />}
                loading={saving}
              >
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'overview',
      label: (
        <span>
          <SafetyCertificateOutlined /> 企业概览
        </span>
      ),
      children: (
        <Card>
          <Title level={4} style={{ marginBottom: 24 }}>
            企业信息概览
          </Title>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="企业 ID">
              <Text code>{currentTenant.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="企业名称">
              {currentTenant.name}
            </Descriptions.Item>
            <Descriptions.Item label="所属行业">
              {currentTenant.industry
                ? INDUSTRY_OPTIONS.find((o) => o.value === currentTenant.industry)
                    ?.label || currentTenant.industry
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="企业规模">
              {currentTenant.scale
                ? SCALE_OPTIONS.find((o) => o.value === currentTenant.scale)?.label ||
                  currentTenant.scale
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="拥有者">
              <Tag color="gold">OWNER</Tag> {currentTenant.ownerId}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(currentTenant.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(currentTenant.updatedAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
  ];

  // Danger zone tab - only for owner
  if (isOwner && canDelete) {
    tabItems.push({
      key: 'danger',
      label: (
        <span style={{ color: '#ff4d4f' }}>
          <DeleteOutlined /> 危险操作
        </span>
      ),
      children: (
        <Card>
          <Title level={4} style={{ marginBottom: 16, color: '#ff4d4f' }}>
            危险操作区
          </Title>
          <Text type="danger">
            以下操作不可逆，请谨慎执行。
          </Text>

          <Divider />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Text strong>删除企业</Text>
              <br />
              <Text type="secondary">
                删除后将无法恢复，所有团队、任务、文档和数据将被永久清除。
              </Text>
            </div>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              删除企业
            </Button>
          </div>
        </Card>
      ),
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <BankOutlined style={{ marginRight: 8 }} />
        企业设置
      </Title>

      <Tabs defaultActiveKey="basic" items={tabItems} />

      {/* Delete Tenant Confirm Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除企业"
        content={
          <div>
            <Text strong type="danger">
              确定要永久删除企业「{currentTenant.name}」吗？
            </Text>
            <br />
            <br />
            <Text type="secondary">
              此操作不可逆。删除后，该企业下的所有团队、任务、文档、审批以及成员数据将全部被清除。
            </Text>
          </div>
        }
        confirmText="确认删除"
        danger
        loading={deleting}
        onConfirm={handleDeleteTenant}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default TenantSettingsPage;
