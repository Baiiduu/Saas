import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Typography, Avatar, Space, Dropdown, Button, AutoComplete, Input, Tooltip } from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  BulbOutlined,
  BulbFilled,
  FormOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useSearchDocuments } from '@/hooks/useDocuments';
import NotificationBell from '@/components/notification/NotificationBell';
import { teamSubPath, orgPath } from '@/router/routes';
import type { MenuProps } from 'antd';

const { Text } = Typography;
const AntHeader = Layout.Header;

const HeaderBar: React.FC = () => {
  const navigate = useNavigate();
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const themeMode = useUIStore((state) => state.themeMode);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const user = useAuthStore((state) => state.user);
  const { mutate: logout } = useLogout();

  // Global search state
  const [searchValue, setSearchValue] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Real search queries - only when debouncedSearch is non-empty
  const { data: taskSearchData } = useTasks(
    teamId && debouncedSearch ? { teamId, search: debouncedSearch, limit: 5 } : undefined
  );
  const { data: docSearchData } = useSearchDocuments(
    debouncedSearch ? teamId : undefined,
    debouncedSearch
  );

  // Build search options from real API data
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchOptions([]);
      return;
    }

    const options: { value: string; label: React.ReactNode }[] = [];

    if (taskSearchData?.items) {
      taskSearchData.items.forEach((task) => {
        options.push({
          value: `task-${task.id}`,
          label: (
            <Space>
              <FormOutlined style={{ color: '#52c41a' }} />
              <span>任务: {task.title}</span>
            </Space>
          ),
        });
      });
    }

    if (docSearchData) {
      (Array.isArray(docSearchData) ? docSearchData : []).forEach((doc) => {
        options.push({
          value: `doc-${doc.id}`,
          label: (
            <Space>
              <FileTextOutlined style={{ color: '#1677ff' }} />
              <span>文档: {doc.name}</span>
            </Space>
          ),
        });
      });
    }

    setSearchOptions(options);
  }, [debouncedSearch, taskSearchData, docSearchData]);

  const handleSearchSelect = useCallback(
    (value: string) => {
      if (value.startsWith('task-')) {
        const taskId = value.replace('task-', '');
        if (orgId && teamId) {
          navigate(teamSubPath(orgId, teamId, `tasks/${encodeURIComponent(taskId)}`));
        }
      } else if (value.startsWith('doc-')) {
        const docId = value.replace('doc-', '');
        if (orgId && teamId) {
          navigate(teamSubPath(orgId, teamId, `documents/${encodeURIComponent(docId)}`));
        }
      }
      setSearchValue('');
      setSearchOptions([]);
    },
    [orgId, teamId, navigate]
  );

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = (info) => {
    switch (info.key) {
      case 'profile':
        navigate(orgId ? orgPath(orgId) + '/user/profile' : '/user/profile');
        break;
      case 'settings':
        navigate(orgId ? orgPath(orgId) + '/user/settings' : '/user/settings');
        break;
      case 'logout':
        logout();
        break;
    }
  };

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 56,
        lineHeight: '56px',
      }}
    >
      {/* Left: Hamburger toggle */}
      <Button
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        style={{ fontSize: 16, width: 40, height: 40 }}
      />

      {/* Center: global search */}
      <AutoComplete
        value={searchValue}
        options={searchOptions}
        onSelect={handleSearchSelect}
        onSearch={(value) => setSearchValue(value)}
        style={{ width: 320 }}
        onBlur={() => setTimeout(() => setSearchOptions([]), 200)}
      >
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
          placeholder="搜索任务、文档..."
          allowClear
          style={{ borderRadius: 6 }}
        />
      </AutoComplete>

      {/* Right: dark mode toggle + notification bell + user avatar */}
      <Space size="middle">
        {/* Dark mode toggle */}
        <Tooltip title={themeMode === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
          <Button
            type="text"
            icon={themeMode === 'dark' ? <BulbOutlined style={{ fontSize: 18 }} /> : <BulbFilled style={{ fontSize: 18 }} />}
            onClick={toggleTheme}
            style={{ width: 40, height: 40 }}
          />
        </Tooltip>

        {/* Notification bell with dropdown */}
        <NotificationBell />

        {/* User avatar dropdown */}
        <Dropdown
          menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Space
            style={{ cursor: 'pointer' }}
            size={8}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              src={user?.avatarUrl}
              alt={user?.displayName}
            />
            <Text>{user?.displayName || '用户'}</Text>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default HeaderBar;
