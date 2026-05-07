import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Popover, List, Typography, Space, Tag, Empty } from 'antd';
import {
  BellOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNotifications } from '@/hooks/useNotifications';
import { useMarkAsRead } from '@/hooks/useNotifications';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { formatRelativeTime } from '@/utils/format';
import { teamSubPath, orgPath } from '@/router/routes';
import { NotificationType } from '@saas/shared-types';
import type { INotification } from '@saas/shared-types';

const { Text } = Typography;

/** Map notification type to a display label and color */
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

function getTypeTag(type: NotificationType): React.ReactNode {
  const config = typeConfig[type] ?? { label: type, color: 'default' };
  return (
    <Tag color={config.color} style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
      {config.label}
    </Tag>
  );
}

/**
 * NotificationBell - Header icon with unread count badge and dropdown popover
 * showing the last 5 unread notifications, plus a "View All" link.
 */
const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = useAuthStore((state) => state.tenant?.id);
  const teamId = useWorkspaceStore((state) => state.currentTeam?.id);
  const { data: notificationsData } = useNotifications({ limit: 5 });
  const { mutate: markAsRead } = useMarkAsRead();

  const notifications = notificationsData?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = (notification: INotification) => {
    if (!tenantId) return; // No tenant context, do not navigate
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    // Navigate to the resource if applicable
    if (notification.resourceType && notification.resourceId) {
      if (teamId) {
        navigate(teamSubPath(tenantId, teamId, `${notification.resourceType}s/${notification.resourceId}`));
      } else {
        // No team context - navigate to top-level notifications
        navigate('/notifications');
      }
    } else {
      // No resource - navigate to top-level notifications
      navigate('/notifications');
    }
  };

  const popoverContent = (
    <div style={{ width: 320 }}>
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无通知"
          style={{ margin: '12px 0' }}
        />
      ) : (
        <>
          <List
            size="small"
            dataSource={notifications}
            renderItem={(item: INotification) => (
              <List.Item
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: item.isRead ? 'transparent' : '#f6f8ff',
                  borderRadius: 4,
                  marginBottom: 2,
                }}
              >
                <List.Item.Meta
                  avatar={getTypeTag(item.type)}
                  title={
                    <Text strong style={{ fontSize: 13 }}>
                      {item.title}
                    </Text>
                  }
                  description={
                    <div>
                      <Text
                        type="secondary"
                        ellipsis={{ tooltip: item.content }}
                        style={{ fontSize: 12, display: 'block' }}
                      >
                        {item.content}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
          <div
            style={{
              borderTop: '1px solid #f0f0f0',
              padding: '8px 12px',
              textAlign: 'center',
            }}
          >
            <Button
              type="link"
              size="small"
              icon={<RightOutlined />}
              onClick={() => {
                if (tenantId) {
                  navigate(orgPath(tenantId) + '/notifications');
                } else {
                  navigate('/notifications');
                }
              }}
            >
              查看全部通知
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title="通知"
      trigger="click"
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ width: 40, height: 40 }}
        />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
