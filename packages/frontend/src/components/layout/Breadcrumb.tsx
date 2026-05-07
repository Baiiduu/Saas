import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

/**
 * Maps path segments to readable Chinese labels.
 */
const segmentLabelMap: Record<string, string> = {
  org: '企业',
  team: '团队',
  tasks: '任务管理',
  board: '看板视图',
  documents: '文档中心',
  approvals: '审批管理',
  messages: '团队消息',
  milestones: '里程碑',
  settings: '团队设置',
  dashboard: '团队仪表盘',
};

/**
 * BreadcrumbNav - Auto-generated breadcrumb from the current route path.
 * Parses `location.pathname` segments and maps them to Chinese labels.
 */
const BreadcrumbNav: React.FC = () => {
  const location = useLocation();

  // Split path into segments, filtering out empty strings
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const breadcrumbItems = [
    {
      key: 'home',
      title: (
        <Link to="/">
          <HomeOutlined style={{ marginRight: 4 }} />
          首页
        </Link>
      ),
    },
    ...pathSegments.map((segment, index) => {
      // Build the cumulative path up to this segment
      const path = '/' + pathSegments.slice(0, index + 1).join('/');
      const isLast = index === pathSegments.length - 1;

      // Try to get a readable label; fall back to the raw segment
      const label = segmentLabelMap[segment] || segment;

      return {
        key: path,
        title: isLast ? (
          label
        ) : (
          <Link to={path}>{label}</Link>
        ),
      };
    }),
  ];

  return <Breadcrumb items={breadcrumbItems} />;
};

export default BreadcrumbNav;
