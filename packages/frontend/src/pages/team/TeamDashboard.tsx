import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
} from 'antd';
import {
  TeamOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTeams, useCreateTeam } from '@/hooks/useTenant';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { teamPath } from '@/router/routes';
import { useEnterpriseOverview } from '@/hooks/useDashboard';
import StatCard from '@/components/dashboard/StatCard';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import type { ITeam } from '@saas/shared-types';

const { Title, Paragraph, Text } = Typography;

interface CreateTeamFormValues {
  name: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
}

const TeamDashboard: React.FC = () => {
  const navigate = useNavigate();
  const currentTenant = useWorkspaceStore((s) => s.currentTenant);
  const setCurrentTeam = useWorkspaceStore((s) => s.setCurrentTeam);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<CreateTeamFormValues>();
  const createTeamMutation = useCreateTeam();
  const { data: enterpriseOverview } = useEnterpriseOverview();

  // Redirect if no current tenant (using useEffect to avoid calling hooks conditionally)
  useEffect(() => {
    if (!currentTenant) {
      navigate('/', { replace: true });
    }
  }, [currentTenant, navigate]);

  const { data: teams, isLoading, isError, error } = useTeams(currentTenant?.id);

  const handleTeamClick = useCallback(
    (team: ITeam) => {
      if (!currentTenant) return;
      setCurrentTeam(team);
      navigate(teamPath(currentTenant.id, team.id));
    },
    [setCurrentTeam, navigate, currentTenant]
  );

  const handleCreateTeam = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleCreateTeamCancel = useCallback(() => {
    setCreateModalOpen(false);
    createForm.resetFields();
  }, [createForm]);

  const handleCreateTeamSubmit = useCallback(
    async (values: CreateTeamFormValues) => {
      if (!currentTenant) return;
      try {
        const newTeam = await createTeamMutation.mutateAsync({
          name: values.name,
          description: values.description,
          tenantId: currentTenant.id,
          visibility: values.visibility,
        });
        message.success('团队创建成功');
        setCreateModalOpen(false);
        createForm.resetFields();
        setCurrentTeam(newTeam);
        navigate(teamPath(currentTenant.id, newTeam.id));
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err.response?.data?.message || err.message || '创建团队失败，请重试';
        message.error(errorMessage);
      }
    },
    [createTeamMutation, currentTenant, createForm, setCurrentTeam, navigate]
  );

  // Early return if no tenant (after all hooks are called in order)
  if (!currentTenant) {
    return null;
  }

  if (isLoading) {
    return <Loading tip="加载团队列表..." />;
  }

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取团队列表失败，请稍后重试'}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          {currentTenant.name} - 团队列表
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTeam}>
          创建新团队
        </Button>
      </div>

      {/* Enterprise overview */}
      {enterpriseOverview && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="企业总任务"
              value={enterpriseOverview.totalTasks}
              icon={<UnorderedListOutlined />}
              color="#1890ff"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="完成率"
              value={`${enterpriseOverview.completionRate}%`}
              icon={<CheckCircleOutlined />}
              color="#52c41a"
              trend={enterpriseOverview.completionRate >= 50 ? 'up' : 'neutral'}
              trendValue={`${enterpriseOverview.completionRate}%`}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="活跃成员"
              value={enterpriseOverview.activeMembers}
              icon={<TeamOutlined />}
              color="#722ed1"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="团队数量"
              value={enterpriseOverview.totalTeams}
              icon={<GlobalOutlined />}
              color="#13c2c2"
            />
          </Col>
        </Row>
      )}

      {(!teams || teams.length === 0) ? (
        <EmptyState
          title="暂无团队"
          description="该企业下还没有团队，请创建一个新团队"
          actionText="创建新团队"
          onAction={handleCreateTeam}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {teams.map((team) => {
            const isPublic = team.visibility === 'PUBLIC';
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={team.id}>
                <Card
                  hoverable
                  onClick={() => handleTeamClick(team)}
                  styles={{ body: { padding: 24 } }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <TeamOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                  </div>
                  <Title level={5} style={{ textAlign: 'center', marginBottom: 8 }}>
                    {team.name}
                  </Title>
                  {team.description && (
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 12, textAlign: 'center' }}
                    >
                      {team.description}
                    </Paragraph>
                  )}
                  <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size={4}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <Tag icon={isPublic ? <GlobalOutlined /> : <LockOutlined />}>
                        {isPublic ? '公开' : '私有'}
                      </Tag>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        成员: -
                      </Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Create Team Modal */}
      <Modal
        title="创建新团队"
        open={createModalOpen}
        onCancel={handleCreateTeamCancel}
        footer={null}
        destroyOnClose
        centered
      >
        <Form<CreateTeamFormValues>
          form={createForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={handleCreateTeamSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="name"
            label="团队名称"
            rules={[
              { required: true, message: '请输入团队名称' },
              { min: 2, message: '团队名称至少为 2 个字符' },
              { max: 100, message: '团队名称不能超过 100 个字符' },
            ]}
          >
            <Input placeholder="请输入团队名称" size="large" />
          </Form.Item>

          <Form.Item name="description" label="团队描述">
            <Input.TextArea
              placeholder="请输入团队描述（选填）"
              rows={3}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="visibility"
            label="可见性"
            initialValue="PUBLIC"
            rules={[{ required: true, message: '请选择可见性' }]}
          >
            <Select size="large">
              <Select.Option value="PUBLIC">
                <Space>
                  <GlobalOutlined />
                  公开 - 所有人可见
                </Space>
              </Select.Option>
              <Select.Option value="PRIVATE">
                <Space>
                  <LockOutlined />
                  私有 - 仅成员可见
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCreateTeamCancel}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createTeamMutation.isPending}
              >
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamDashboard;
