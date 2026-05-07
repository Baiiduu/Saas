import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Tabs,
  List,
  Tag,
  Space,
  Button,
  Empty,
  Spin,
  Card,
} from 'antd';
import {
  CheckCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/useNotifications';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { formatRelativeTime } from '@/utils/format';
import { teamSubPath, orgPath } from '@/router/routes';
import { NotificationType } from '@saas/shared-types';
import type { INotification } from '@saas/shared-types';

const { Title } = Typography;

/** Map notification type to display config */
const typeConfig: Record<
  NotificationType,
  { label: string; color: string }
> = {
  [NotificationType.TASK_ASSIGNED]: { label: '任务分配', color: 'blue' },
  [NotificationType.COMMENT_MENTION]: { label: '评论提及', color: 'geekblue' },
  [NotificationType.APPROVAL_NEEDED]: { label: '待审批', color: 'orange' },
  [NotificationType.APPROVAL_RESULT]: { label: '审批结果', color: 'green' },
  [NotificationType.DOCUMENT_SHARED]: { label: '文档分享', color: 'purple' },
  [NotificationType.MEMBER_JOINED]: { label: '新成员', color: 'cyan' },
  [NotificationType.TEAM_INVITE]: { label: '团队邀请', color: 'gold' },
  [NotificationType.MILESTONE_DUE]: { label: '里程碑', color: 'red' },
};

/** Filter chips for notification type */
const typeFilters = [
  { label: '全部', value: undefined },
  ...Object.entries(typeConfig).map(([key, cfg]) => ({
    label: cfg.label,
    value: key as NotificationType,
  })),
];

/**
 * NotificationCenterPage - Full notification list page.
 *
 * Layout:
 * - Ant Design Tabs: "未读" (unread) / "全部" (all)
 * - Type filter chips below tabs
 * - Notification list items with:
 *   - Color-coded type tag
 *   - Title, content preview, relative timestamp
 *   - Click navigates to the linked resource or notification detail
 * - "全部标为已读" button in header area
 */
const NotificationCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = useAuthStore((state) => state.tenant?.id);
  const teamId = useWorkspaceStore((state) => state.currentTeam?.id);
  const [activeTab, setActiveTab] = useState<string>('unread');
  const [typeFilter, setTypeFilter] = useState<NotificationType | undefined>(
    undefined
  );

  // Determine fetch params based on active tab
  const isUnreadTab = activeTab === 'unread';
  const { data, isLoading, isError, refetch } = useNotifications({
    isRead: isUnreadTab ? false : undefined,
    type: typeFilter,
    limit: 50,
  });

  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const notifications = data?.items ?? [];

  const handleItemClick = (notification: INotification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    // Navigate to resource if applicable AND teamId exists
    if (notification.resourceType && notification.resourceId && teamId && tenantId) {
      navigate(
        teamSubPath(tenantId, teamId, `${notification.resourceType}s/${notification.resourceId}`)
      );
      } else {
        // No valid resource URL - navigate to notifications center
        if (tenantId) {
          navigate(orgPath(tenantId) + '/notifications');
        } else {
          navigate('/notifications');
        }
      }
  };

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          通知中心
        </Title>
        <Space>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={() => markAllAsReadMutation.mutate()}
            loading={markAllAsReadMutation.isPending}
          >
            全部标为已读
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Tabs: Unread / All */}
      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'unread',
              label: `未读`,
            },
            {
              key: 'all',
              label: `全部`,
            },
          ]}
        />
      </Card>

      {/* Type filter chips */}
      <div style={{ margin: '12px 0' }}>
        <Space wrap size={[4, 8]}>
          {typeFilters.map((f) => (
            <Tag
              key={f.value ?? 'all'}
              color={typeFilter === f.value ? 'blue' : undefined}
              style={{ cursor: 'pointer', padding: '2px 12px' }}
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </Tag>
          ))}
        </Space>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="加载通知..." />
        </div>
      ) : isError ? (
        <Empty description="加载通知失败" />
      ) : notifications.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              isUnreadTab ? '暂无未读通知' : '暂无通知'
            }
          />
        </Card>
      ) : (
        <Card>
          <List
            dataSource={notifications}
            renderItem={(item: INotification) => {
              const typeCfg = typeConfig[item.type] ?? {
                label: item.type,
                color: 'default',
              };
              return (
                <List.Item
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    background: item.isRead ? 'transparent' : '#f6f8ff',
                    borderRadius: 6,
                    marginBottom: 4,
                  }}
                  actions={[
                    <Button
                      type="text"
                      size="small"
                      icon={<RightOutlined />}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Tag
                        color={typeCfg.color}
                        style={{
                          fontSize: 12,
                          lineHeight: '20px',
                          padding: '0 8px',
                        }}
                      >
                        {typeCfg.label}
                      </Tag>
                    }
                    title={
                      <Space size={8}>
                        <span style={{ fontWeight: item.isRead ? 400 : 600 }}>
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <Tag
                            color="blue"
                            style={{ fontSize: 10, lineHeight: '16px' }}
                          >
                            未读
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <span
                          style={{
                            color: '#666',
                            fontSize: 13,
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          {item.content}
                        </span>
                        <Space size={4}>
                          <ClockCircleOutlined
                            style={{ fontSize: 11, color: '#999' }}
                          />
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default NotificationCenterPage;
