import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Spin,
  Switch,
  Select,
  Divider,
  Space,
  Modal,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { patch } from '@/services/api';
import { usePermission } from '@/hooks/usePermission';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { TeamVisibility } from '@saas/shared-types';
import type { ITeam } from '@saas/shared-types';

const { Title, Text } = Typography;
const { confirm } = Modal;

interface TeamSettingsFormValues {
  name: string;
  description?: string;
}

const TeamSettings: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const currentTeam = useWorkspaceStore((s) => s.currentTeam);
  const setCurrentTeam = useWorkspaceStore((s) => s.setCurrentTeam);
  const [form] = Form.useForm<TeamSettingsFormValues>();
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [toggleVisibilityLoading, setToggleVisibilityLoading] = useState(false);
  const { can } = usePermission();

  const canArchive = can('team.delete') || currentTeam?.isArchived;
  const canChangeVisibility = can('team.update');

  // Populate form with current team data
  useEffect(() => {
    if (currentTeam) {
      form.setFieldsValue({
        name: currentTeam.name,
        description: currentTeam.description,
      });
    }
  }, [currentTeam, form]);

  const onFinish = useCallback(
    async (values: TeamSettingsFormValues) => {
      if (!teamId) return;
      setSaving(true);
      try {
        const updated = await patch<ITeam>(`/teams/${teamId}`, {
          name: values.name,
          description: values.description,
        });
        setCurrentTeam(updated);
        message.success('团队设置已更新');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err.response?.data?.message || err.message || '更新失败，请重试';
        message.error(errorMessage);
      } finally {
        setSaving(false);
      }
    },
    [teamId, setCurrentTeam]
  );

  // Toggle visibility (PUBLIC <-> PRIVATE)
  const handleToggleVisibility = useCallback(async () => {
    if (!teamId) return;
    const newVisibility: TeamVisibility =
      currentTeam?.visibility === TeamVisibility.PUBLIC ? TeamVisibility.PRIVATE : TeamVisibility.PUBLIC;

    setToggleVisibilityLoading(true);
    try {
      const updated = await patch<ITeam>(`/teams/${teamId}/visibility`, {
        visibility: newVisibility,
      });
      setCurrentTeam(updated);
      message.success(
        `团队已设为${newVisibility === TeamVisibility.PUBLIC ? '公开' : '私有'}`
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '操作失败，请重试');
    } finally {
      setToggleVisibilityLoading(false);
    }
  }, [teamId, currentTeam, setCurrentTeam]);

  // Archive / Unarchive team
  const handleArchiveToggle = useCallback(async () => {
    if (!teamId) return;

    confirm({
      title: currentTeam?.isArchived ? '恢复团队' : '归档团队',
      icon: <ExclamationCircleOutlined />,
      content: currentTeam?.isArchived
        ? '确定要恢复此团队吗？恢复后团队成员可正常使用。'
        : '确定要归档此团队吗？归档后团队成员将无法访问。',
      okText: currentTeam?.isArchived ? '恢复' : '归档',
      cancelText: '取消',
      okButtonProps: { danger: !currentTeam?.isArchived },
      onOk: async () => {
        setArchiving(true);
        try {
          const updated = await patch<ITeam>(`/teams/${teamId}/archive`, {
            isArchived: !currentTeam?.isArchived,
          });
          setCurrentTeam(updated);
          message.success(
            currentTeam?.isArchived ? '团队已恢复' : '团队已归档'
          );
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } }; message?: string };
          message.error(
            err.response?.data?.message || err.message || '操作失败，请重试'
          );
        } finally {
          setArchiving(false);
        }
      },
    });
  }, [teamId, currentTeam, setCurrentTeam]);

  if (!currentTeam) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin tip="加载团队信息..." size="large">
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      {/* Basic info */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 24 }}>
          团队设置
        </Title>

        <Form<TeamSettingsFormValues>
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="name"
            label="团队名称"
            rules={[
              { required: true, message: '请输入团队名称' },
              { min: 2, message: '团队名称至少为 2 个字符' },
            ]}
          >
            <Input placeholder="请输入团队名称" size="large" />
          </Form.Item>

          <Form.Item name="description" label="团队描述">
            <Input.TextArea
              placeholder="请输入团队描述（选填）"
              rows={4}
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={saving}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Visibility controls */}
      {canChangeVisibility && (
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            团队可见性
          </Title>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Text strong>
                {currentTeam.visibility === TeamVisibility.PUBLIC ? '公开团队' : '私有团队'}
              </Text>
              <br />
              <Text type="secondary">
                {currentTeam.visibility === TeamVisibility.PUBLIC
                  ? '团队成员对组织内所有人可见'
                  : '仅团队成员可看到此团队'}
              </Text>
            </div>
            <Button
              icon={
                currentTeam.visibility === TeamVisibility.PUBLIC ? (
                  <LockOutlined />
                ) : (
                  <UnlockOutlined />
                )
              }
              onClick={handleToggleVisibility}
              loading={toggleVisibilityLoading}
            >
              设为{currentTeam.visibility === TeamVisibility.PUBLIC ? '私有' : '公开'}
            </Button>
          </div>
        </Card>
      )}

      {/* Archive controls */}
      {canArchive && (
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>
            归档管理
          </Title>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Text strong>
                {currentTeam.isArchived ? '团队已归档' : '归档团队'}
              </Text>
              <br />
              <Text type="secondary">
                {currentTeam.isArchived
                  ? '归档后团队成员无法访问，可随时恢复'
                  : '归档团队，暂停团队活动'}
              </Text>
            </div>
            <Button
              icon={<InboxOutlined />}
              onClick={handleArchiveToggle}
              loading={archiving}
              danger={!currentTeam.isArchived}
            >
              {currentTeam.isArchived ? '恢复团队' : '归档团队'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TeamSettings;
