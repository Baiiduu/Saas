import React from 'react';
import { Menu } from 'antd';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  FlagOutlined,
  SettingOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { teamSubPath, teamPath } from '@/router/routes';

const teamMenuItems = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '团队仪表盘',
  },
  {
    key: 'tasks',
    icon: <UnorderedListOutlined />,
    label: '任务管理',
  },
  {
    key: 'board',
    icon: <AppstoreOutlined />,
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
  {
    key: 'documents',
    icon: <FileTextOutlined />,
    label: '文档中心',
  },
  {
    key: 'approvals',
    icon: <CheckCircleOutlined />,
    label: '审批管理',
  },
  {
    key: 'messages',
    icon: <MessageOutlined />,
    label: '团队消息',
  },
  {
    key: 'milestones',
    icon: <FlagOutlined />,
    label: '里程碑',
  },
  {
    key: 'graph',
    icon: <ApartmentOutlined />,
    label: '资源画布',
  },
  {
    key: 'members',
    icon: <TeamOutlined />,
    label: '团队成员',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '团队设置',
  },
];

/**
 * TeamLayout - Sub-navigation layout for team-scoped routes.
 * Renders a horizontal tab/menu bar and an <Outlet /> for child pages.
 */
const TeamLayout: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine which menu item is active based on the current path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  // pathSegments: ["org", orgId, "team", teamId, ...rest]
  const activeKey = pathSegments.length >= 5 ? pathSegments[4] : 'dashboard';

  const handleMenuClick = (info: { key: string }) => {
    if (!orgId || !teamId) return;
    if (info.key === 'dashboard') {
      navigate(teamPath(orgId, teamId));
    } else {
      navigate(teamSubPath(orgId, teamId, info.key));
    }
  };

  return (
    <div>
      {/* Team navigation tabs */}
      <Menu
        mode="horizontal"
        selectedKeys={[activeKey]}
        items={teamMenuItems}
        onClick={handleMenuClick}
        style={{
          marginBottom: 24,
          borderBottom: '1px solid #f0f0f0',
        }}
      />

      {/* Team page content */}
      <Outlet />
    </div>
  );
};

export default TeamLayout;
