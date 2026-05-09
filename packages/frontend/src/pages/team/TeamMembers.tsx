import React, { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Modal,
  Input,
  Tag,
  Typography,
  message,
  Space,
  Tooltip,
  Tabs,
  List,
  Badge,
  Empty,
  Select,
} from 'antd';
import {
  UserDeleteOutlined,
  UserAddOutlined,
  MailOutlined,
  ReloadOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTeamMembers } from '@/hooks/useTenant';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { post, del, get, patch } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermission';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import MemberAvatar from '@/components/member/MemberAvatar';
import RoleTag from '@/components/member/RoleTag';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import type { ITeamMember } from '@saas/shared-types';
import { Role } from '@saas/shared-types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Extended member type assuming API returns embedded user info
interface TeamMemberRecord extends ITeamMember {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

interface JoinRequestRecord {
  id: string;
  userId: string;
  displayName?: string;
  email?: string;
  reason?: string;
  createdAt: string;
}

const TeamMembers: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentTeam = useWorkspaceStore((s) => s.currentTeam);
  const { can } = usePermission();

  const { data: members = [], isLoading, isError, error } = useTeamMembers(teamId);

  // Batch invite state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviting, setInviting] = useState(false);

  // Single invite modal (legacy)
  const [singleInviteModalOpen, setSingleInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Remove member state
  const [removeTarget, setRemoveTarget] = useState<TeamMemberRecord | null>(null);
  const [removing, setRemoving] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

  // Leave team state
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Join requests state
  const { data: joinRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['join-requests', teamId],
    queryFn: () => get<JoinRequestRecord[]>(`/teams/${teamId}/join-requests`),
    enabled: !!teamId && can('member.update'),
  });

  // Permissions
  const canInvite = can('member.create');
  const canRemove = can('member.delete');
  const canUpdateRole = can('member.update');
  const canApproveRequests = can('member.update');
  const isMember = can('member.read');
  const isOwner = currentTeam?.visibility !== undefined; // Simplified check

  // --- Batch invite handlers ---
  const handleOpenBatchInvite = useCallback(() => {
    setInviteEmails('');
    setInviteModalOpen(true);
  }, []);

  const handleCloseBatchInvite = useCallback(() => {
    setInviteModalOpen(false);
    setInviteEmails('');
  }, []);

  const handleSendBatchInvite = useCallback(async () => {
    if (!teamId) return;
    const emails = inviteEmails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      message.warning('请输入至少一个邮箱地址');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((e) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      message.error(`以下邮箱格式无效：${invalidEmails.join(', ')}`);
      return;
    }

    setInviting(true);
    try {
      await post(`/teams/${teamId}/invitations/batch`, { emails });
      message.success(`已向 ${emails.length} 位用户发送邀请`);
      handleCloseBatchInvite();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '发送邀请失败，请重试');
    } finally {
      setInviting(false);
    }
  }, [teamId, inviteEmails, handleCloseBatchInvite]);

  // --- Single invite handlers ---
  const handleOpenSingleInvite = useCallback(() => {
    setInviteEmail('');
    setSingleInviteModalOpen(true);
  }, []);

  const handleCloseSingleInvite = useCallback(() => {
    setSingleInviteModalOpen(false);
    setInviteEmail('');
  }, []);

  const handleSendSingleInvite = useCallback(async () => {
    if (!teamId || !inviteEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      message.error('请输入有效的邮箱地址');
      return;
    }
    setInviting(true);
    try {
      await post(`/teams/${teamId}/invitations/batch`, { emails: [inviteEmail.trim()] });
      message.success('邀请已发送');
      handleCloseSingleInvite();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '发送邀请失败，请重试');
    } finally {
      setInviting(false);
    }
  }, [teamId, inviteEmail, handleCloseSingleInvite]);

  // --- Remove member handler ---
  const handleRemoveMember = useCallback(
    async (member: TeamMemberRecord) => {
      if (!teamId) return;
      setRemoving(true);
      try {
        await del(`/teams/${teamId}/members/${member.userId}`);
        message.success('成员已移除');
        queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '移除成员失败，请重试');
      } finally {
        setRemoving(false);
        setRemoveTarget(null);
      }
    },
    [teamId, queryClient]
  );

  const handleUpdateMemberRole = useCallback(
    async (member: TeamMemberRecord, role: Role) => {
      if (!teamId || member.role === role) return;
      setUpdatingRoleUserId(member.userId);
      try {
        await patch(`/teams/${teamId}/members/${member.userId}/role`, { role });
        message.success('成员权限已更新');
        queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '更新成员权限失败');
      } finally {
        setUpdatingRoleUserId(null);
      }
    },
    [teamId, queryClient]
  );

  // --- Leave team handler ---
  const handleLeaveTeam = useCallback(async () => {
    if (!teamId) return;
    setLeaving(true);
    try {
      await del(`/teams/${teamId}/members/me`);
      message.success('已退出团队');
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      setLeaveConfirmOpen(false);
      // Navigate to team discovery after leaving
      if (orgId) {
        navigate(`/org/${orgId}/teams`);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || '退出团队失败，请重试');
    } finally {
      setLeaving(false);
    }
  }, [teamId, orgId, queryClient, navigate]);

  // --- Join request approval handlers ---
  const handleApproveRequest = useCallback(
    async (requestId: string) => {
      try {
        await patch(`/teams/${teamId}/join-requests/${requestId}`, { action: 'APPROVED' });
        message.success('已批准加入请求');
        queryClient.invalidateQueries({ queryKey: ['join-requests', teamId] });
        queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '操作失败，请重试');
      }
    },
    [teamId, queryClient]
  );

  const handleRejectRequest = useCallback(
    async (requestId: string) => {
      try {
        await patch(`/teams/${teamId}/join-requests/${requestId}`, { action: 'REJECTED' });
        message.success('已拒绝加入请求');
        queryClient.invalidateQueries({ queryKey: ['join-requests', teamId] });
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '操作失败，请重试');
      }
    },
    [teamId, queryClient]
  );

  // --- Table columns ---
  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_: unknown, record: TeamMemberRecord) => (
        <Space>
          <MemberAvatar
            user={{
              displayName: record.displayName ?? '未知',
              avatarUrl: record.avatarUrl,
            }}
            size={36}
          />
          <span>{record.displayName ?? record.userId}</span>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email?: string) => email || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: ITeamMember['role'], record: TeamMemberRecord) => {
        if (
          canUpdateRole &&
          record.userId !== currentUser?.id &&
          record.role !== Role.OWNER
        ) {
          return (
            <Select
              size="small"
              value={role}
              style={{ width: 120 }}
              loading={updatingRoleUserId === record.userId}
              onChange={(nextRole) => handleUpdateMemberRole(record, nextRole)}
              options={[
                { label: '管理员', value: Role.ADMIN },
                { label: '负责人', value: Role.LEADER },
                { label: '成员', value: Role.MEMBER },
                { label: '只读', value: Role.READER },
                { label: '访客', value: Role.GUEST },
              ]}
            />
          );
        }
        return <RoleTag role={role} />;
      },
    },
    {
      title: '加入时间',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (joinedAt: string) =>
        joinedAt ? new Date(joinedAt).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: TeamMemberRecord) => {
        // Current user — show leave button
        if (record.userId === currentUser?.id) {
          return (
            <Tag color="blue">当前用户</Tag>
          );
        }

        if (record.role === 'OWNER') {
          return <Tag>拥有者</Tag>;
        }

        return canRemove ? (
          <Tooltip title="移除成员">
            <Button
              type="text"
              danger
              icon={<UserDeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setRemoveTarget(record);
              }}
            />
          </Tooltip>
        ) : null;
      },
    },
  ];

  if (isLoading) {
    return <Loading tip="加载成员列表..." />;
  }

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取成员列表失败，请稍后重试'}
      />
    );
  }

  // Tab items for members/requests
  const tabItems = [
    {
      key: 'members',
      label: (
        <span>
          <TeamOutlined /> 成员列表
        </span>
      ),
      children: (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              团队成员{' '}
              <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
                ({members.length} 人)
              </Text>
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ['team-members', teamId] })
                }
              >
                刷新
              </Button>
              {canInvite && (
                <>
                  <Button icon={<UserAddOutlined />} onClick={handleOpenSingleInvite}>
                    邀请成员
                  </Button>
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={handleOpenBatchInvite}
                  >
                    批量邀请
                  </Button>
                </>
              )}
              {isMember && (
                <Button
                  danger
                  icon={<LogoutOutlined />}
                  onClick={() => setLeaveConfirmOpen(true)}
                >
                  退出团队
                </Button>
              )}
            </Space>
          </div>

          {members.length === 0 ? (
            <EmptyState
              title="暂无成员"
              description="团队还没有成员，邀请他们加入吧"
              actionText="邀请成员"
              onAction={handleOpenSingleInvite}
            />
          ) : (
            <Table
              dataSource={members as TeamMemberRecord[]}
              columns={columns}
              rowKey={(record) => record.userId}
              pagination={false}
            />
          )}
        </>
      ),
    },
  ];

  // Add requests tab for admins/leaders
  if (canApproveRequests) {
    tabItems.push({
      key: 'requests',
      label: (
        <span>
          <Badge count={joinRequests.length} size="small" offset={[6, -2]}>
            加入请求
          </Badge>
        </span>
      ),
      children: (
        <>
          <Title level={4} style={{ marginBottom: 24 }}>
            加入请求
          </Title>
          {requestsLoading ? (
            <Loading tip="加载请求列表..." />
          ) : joinRequests.length === 0 ? (
            <Empty description="暂无待处理的加入请求" />
          ) : (
            <List
              dataSource={joinRequests as JoinRequestRecord[]}
              renderItem={(request: JoinRequestRecord) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleApproveRequest(request.id)}
                    >
                      批准
                    </Button>,
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleRejectRequest(request.id)}
                    >
                      拒绝
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <MemberAvatar
                        user={{
                          displayName: request.displayName ?? '未知',
                        }}
                        size={40}
                      />
                    }
                    title={request.displayName || request.userId}
                    description={
                      <Space direction="vertical" size={2}>
                        {request.email && <Text type="secondary">{request.email}</Text>}
                        {request.reason && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            申请理由：{request.reason}
                          </Text>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          申请时间：{new Date(request.createdAt).toLocaleString('zh-CN')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </>
      ),
    });
  }

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="members" items={tabItems} />

      {/* Single Invite Modal */}
      <Modal
        title="邀请成员"
        open={singleInviteModalOpen}
        onCancel={handleCloseSingleInvite}
        footer={null}
        destroyOnClose
        centered
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>输入被邀请人的邮箱地址：</Typography.Text>
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱地址"
            size="large"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onPressEnter={handleSendSingleInvite}
          />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseSingleInvite}>取消</Button>
              <Button
                type="primary"
                onClick={handleSendSingleInvite}
                loading={inviting}
                disabled={!inviteEmail.trim()}
              >
                发送邀请
              </Button>
            </Space>
          </div>
        </Space>
      </Modal>

      {/* Batch Invite Modal */}
      <Modal
        title="批量邀请成员"
        open={inviteModalOpen}
        onCancel={handleCloseBatchInvite}
        footer={null}
        destroyOnClose
        centered
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            输入被邀请人的邮箱地址，每行一个，或用逗号/分号分隔：
          </Typography.Text>
          <TextArea
            placeholder={'user1@example.com\nuser2@example.com\nuser3@example.com'}
            rows={5}
            size="large"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
          />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseBatchInvite}>取消</Button>
              <Button
                type="primary"
                onClick={handleSendBatchInvite}
                loading={inviting}
                disabled={!inviteEmails.trim()}
              >
                发送邀请
              </Button>
            </Space>
          </div>
        </Space>
      </Modal>

      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        open={!!removeTarget}
        title="移除成员"
        content={`确定要移除成员「${removeTarget?.displayName ?? removeTarget?.userId}」吗？`}
        confirmText="移除"
        danger
        loading={removing}
        onConfirm={() => removeTarget && handleRemoveMember(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Leave Team Confirm Dialog */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="退出团队"
        content="确定要退出此团队吗？退出后将无法访问团队资源和任务。"
        confirmText="退出"
        danger
        loading={leaving}
        onConfirm={handleLeaveTeam}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </div>
  );
};

export default TeamMembers;
