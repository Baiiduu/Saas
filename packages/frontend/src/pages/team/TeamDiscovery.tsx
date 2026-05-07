import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Button,
  Space,
  Input,
  message,
  Spin,
  List,
  Empty,
} from 'antd';
import {
  TeamOutlined,
  LockOutlined,
  GlobalOutlined,
  UserAddOutlined,
  RightCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTeamsList, useCreateJoinRequest } from '@/hooks/useTeams';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { teamPath, orgPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import type { TeamListItem } from '@/services/teamService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const TeamDiscovery: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const currentTeam = useWorkspaceStore((s) => s.currentTeam);

  const { data: teams = [], isLoading, isError, error, refetch } = useTeamsList(orgId);
  const createJoinRequest = useCreateJoinRequest();

  // Join request modal state
  const [joinModalTeam, setJoinModalTeam] = useState<TeamListItem | null>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (team.description || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const handleJoinRequest = async (team: TeamListItem) => {
    setJoinMessage('');
    setJoinModalTeam(team);
  };

  const handleSubmitJoinRequest = async () => {
    if (!joinModalTeam) return;
    try {
      await createJoinRequest.mutateAsync({
        teamId: joinModalTeam.id,
        message: joinMessage || undefined,
      });
      message.success(`已向「${joinModalTeam.name}」发送加入申请`);
      setJoinModalTeam(null);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      message.error(errorObj.response?.data?.message || errorObj.message || '发送申请失败');
    }
  };

  const handleEnterTeam = (team: TeamListItem) => {
    if (orgId) {
      navigate(teamPath(orgId, team.id));
    }
  };

  const isCurrentTeam = (teamId: string) => currentTeam?.id === teamId;

  if (isLoading) {
    return <Loading tip="加载团队列表..." />;
  }

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取团队列表失败，请稍后重试'}
        actionText="重新加载"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            团队发现
          </Title>
          <Text type="secondary">浏览并加入当前企业下的所有团队</Text>
        </div>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索团队..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Team list */}
      {filteredTeams.length === 0 ? (
        <EmptyState
          title={searchText ? '未找到匹配的团队' : '暂无团队'}
          description={searchText ? '请尝试其他搜索关键词' : '当前企业下还没有团队'}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredTeams.map((team) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={team.id}>
              <Card
                hoverable
                actions={[
                  isCurrentTeam(team.id) ? (
                    <Button
                      type="link"
                      icon={<RightCircleOutlined />}
                      onClick={() => handleEnterTeam(team)}
                    >
                      进入团队
                    </Button>
                  ) : (
                    <Button
                      type="link"
                      icon={<UserAddOutlined />}
                      onClick={() => handleJoinRequest(team)}
                    >
                      申请加入
                    </Button>
                  ),
                ]}
              >
                <Card.Meta
                  avatar={
                    <TeamOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                  }
                  title={
                    <Space>
                      <Text strong ellipsis style={{ maxWidth: 160 }}>
                        {team.name}
                      </Text>
                      {team.visibility === 'PRIVATE' ? (
                        <Tag icon={<LockOutlined />} color="default">
                          PRIVATE
                        </Tag>
                      ) : (
                        <Tag icon={<GlobalOutlined />} color="success">
                          PUBLIC
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text
                        type="secondary"
                        ellipsis
                        style={{ minHeight: 44 }}
                      >
                        {team.description || '暂无描述'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <TeamOutlined /> {team._count?.members ?? 0} 位成员
                      </Text>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Join Request Modal — inline dialog using Ant Design pattern */}
      {joinModalTeam && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setJoinModalTeam(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              width: 420,
              maxWidth: '90vw',
              boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Title level={4} style={{ marginTop: 0 }}>
              申请加入「{joinModalTeam.name}」
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              您可以附上申请理由，让团队管理员更快审批
            </Text>
            <TextArea
              placeholder="输入申请理由（可选）..."
              rows={4}
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setJoinModalTeam(null)}>取消</Button>
                <Button
                  type="primary"
                  loading={createJoinRequest.isPending}
                  onClick={handleSubmitJoinRequest}
                >
                  发送申请
                </Button>
              </Space>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamDiscovery;
