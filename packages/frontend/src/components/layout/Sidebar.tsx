import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Menu, Button, Typography, Divider, Space, message } from 'antd';
import {
  TeamOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  FlagOutlined,
  SettingOutlined,
  LogoutOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  BellOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  ProfileOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';
import { teamSubPath, teamPath, orgPath } from '@/router/routes';
import type { MenuProps } from 'antd';

const { Text } = Typography;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const currentTenant = useWorkspaceStore((state) => state.currentTenant);
  const currentTeam = useWorkspaceStore((state) => state.currentTeam);
  const user = useAuthStore((state) => state.user);
  const { mutate: logout } = useLogout();
  const { can } = usePermission();

  const effectiveTeamId = teamId || currentTeam?.id;
  const hasTeamContext = !!effectiveTeamId;

  // Determine selected key from current path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  let selectedKey = 'dashboard';
  if (pathSegments.length >= 2 && pathSegments[0] === 'org') {
    if (pathSegments.length >= 4 && pathSegments[2] === 'team') {
      // Inside a team route: path is /org/:orgId/team/:teamId/<sub>
      const subPath = pathSegments.length >= 5 ? pathSegments[4] : 'dashboard';
      if (subPath === 'approvals' && pathSegments.length >= 6 && pathSegments[5] === 'templates') {
        selectedKey = 'approval-templates';
      } else {
        selectedKey = subPath;
      }
    } else if (pathSegments.length >= 3 && pathSegments[2] === 'settings') {
      selectedKey = 'settings';
    } else if (pathSegments.length >= 3 && pathSegments[2] === 'audit') {
      selectedKey = 'audit';
    } else if (pathSegments.length >= 3 && pathSegments[2] === 'llm') {
      selectedKey = 'llm-chat';
    } else if (pathSegments.length >= 3 && pathSegments[2] === 'notifications') {
      selectedKey = 'notifications';
    }
  }

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    const key = info.key;

    if (key === 'dashboard') {
      if (effectiveTeamId && orgId) {
        navigate(teamPath(orgId, effectiveTeamId));
      } else if (orgId) {
        navigate(orgPath(orgId));
      }
      return;
    }

    if (key === 'teams') {
      if (orgId) {
        navigate(orgPath(orgId) + '/teams');
      }
      return;
    }

    if (
      ['tasks', 'board', 'documents', 'approvals', 'messages', 'milestones', 'members', 'gantt', 'calendar', 'graph', 'approval-templates'].includes(key) &&
      !hasTeamContext
    ) {
      message.warning('请先选择团队');
      return;
    }

    if (key === 'approval-templates' && orgId && effectiveTeamId) {
      navigate(teamSubPath(orgId, effectiveTeamId, 'approvals/templates'));
      return;
    }

    if (
      ['tasks', 'board', 'documents', 'approvals', 'messages', 'milestones', 'members', 'gantt', 'calendar', 'graph'].includes(key) &&
      orgId &&
      effectiveTeamId
    ) {
      navigate(teamSubPath(orgId, effectiveTeamId, key));
      return;
    }

    if (key === 'llm-chat' && orgId) {
      navigate(orgPath(orgId) + '/llm/chat');
      return;
    }

    if (key === 'notifications' && orgId) {
      navigate(orgPath(orgId) + '/notifications');
      return;
    }

    if (key === 'settings' && orgId) {
      navigate(orgPath(orgId) + '/settings');
      return;
    }

    if (key === 'audit' && orgId) {
      navigate(orgPath(orgId) + '/audit');
      return;
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'dashboard',
      icon: <AppstoreOutlined />,
      label: '团队仪表盘',
    },
    ...(can('llm.read')
      ? [
          {
            key: 'llm-chat',
            icon: <RobotOutlined />,
            label: 'AI 助手',
          },
        ]
      : []),
    ...(can('notification.read')
      ? [
          {
            key: 'notifications',
            icon: <BellOutlined />,
            label: '通知中心',
          },
        ]
      : []),
    ...(can('task.read')
      ? [
          {
            key: 'tasks',
            icon: <UnorderedListOutlined />,
            label: '任务管理',
          },
          {
            key: 'board',
            icon: <TeamOutlined />,
            label: '看板视图',
          },
          {
            key: 'gantt',
            icon: <BarChartOutlined />,
            label: '甘特图',
          },
          {
            key: 'calendar',
            icon: <CalendarOutlined />,
            label: '日历',
          },
        ]
      : []),
    ...(can('document.read')
      ? [
          {
            key: 'documents',
            icon: <FileTextOutlined />,
            label: '文档中心',
          },
        ]
      : []),
    ...(can('approval.read')
      ? [
          {
            key: 'approvals',
            icon: <CheckCircleOutlined />,
            label: '审批管理',
          },
          {
            key: 'approval-templates',
            icon: <ProfileOutlined />,
            label: '审批模板',
          },
        ]
      : []),
    ...(can('message.read')
      ? [
          {
            key: 'messages',
            icon: <MessageOutlined />,
            label: '团队消息',
          },
        ]
      : []),
    ...(can('milestone.read')
      ? [
          {
            key: 'milestones',
            icon: <FlagOutlined />,
            label: '里程碑',
          },
        ]
      : []),
    ...(can('graph.read')
      ? [
          {
            key: 'graph',
            icon: <ApartmentOutlined />,
            label: '资源画布',
          },
        ]
      : []),
    {
      key: 'teams',
      icon: <CompassOutlined />,
      label: '团队发现',
    },
    // Members - visible to all authenticated users but only management for leaders+
    {
      key: 'members',
      icon: <TeamOutlined />,
      label: '团队成员',
    },
    // Enterprise settings - visible to admin/owner only
    ...(can('tenant.update')
      ? [
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '企业设置',
          },
        ]
      : []),
    // Audit log - visible to admin/owner only
    ...(can('audit.view')
      ? [
          {
            key: 'audit',
            icon: <AuditOutlined />,
            label: '审计日志',
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo area */}
      <div style={{ padding: '16px', textAlign: 'center' }}>
        {sidebarCollapsed ? (
          <Text strong style={{ fontSize: 20 }}>
            协作
          </Text>
        ) : (
          <Text strong style={{ fontSize: 18 }}>
            协作平台
          </Text>
        )}
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Organization / team switcher */}
      {!sidebarCollapsed && (
        <div style={{ padding: '8px 16px' }}>
          <Space>
            <SafetyCertificateOutlined />
            <Text ellipsis style={{ maxWidth: 160 }}>
              {currentTenant?.name || '未选择企业'}
            </Text>
          </Space>
        </div>
      )}

      <Divider style={{ margin: '8px 0' }} />

      {/* Navigation menu */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </div>

      {/* Logout section */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {sidebarCollapsed ? (
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => logout()}
            style={{ width: '100%' }}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {user && (
              <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                {user.displayName}
              </Text>
            )}
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => logout()}
              block
            >
              退出登录
            </Button>
          </Space>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
