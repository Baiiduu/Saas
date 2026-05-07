import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { List, Avatar, Typography, Space, Tag, Spin, Empty } from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import * as commentService from '@/services/commentService';
import { formatRelativeTime } from '@/utils/format';
import type { IComment } from '@saas/shared-types';

const { Text, Link } = Typography;

export interface CommentListProps {
  resourceType: string;
  resourceId: string;
}

/**
 * Parse markdown link patterns [text](url) and render as mixed text/link content.
 */
function renderContent(content: string): React.ReactNode {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <Text key={key++}>{content.slice(lastIndex, match.index)}</Text>
      );
    }
    elements.push(
      <Link key={key++} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    elements.push(<Text key={key++}>{content.slice(lastIndex)}</Text>
    );
  }

  return elements.length > 0 ? elements : <Text>{content}</Text>;
}

/**
 * CommentList - Displays comments in reverse chronological order.
 * Each comment shows: avatar, display name, timestamp, content, and attachments.
 */
const CommentList: React.FC<CommentListProps> = ({ resourceType, resourceId }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['comments', resourceType, resourceId],
    queryFn: () => commentService.getComments(resourceType, resourceId),
    enabled: !!resourceId,
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin tip="加载评论..." />
      </div>
    );
  }

  if (isError) {
    return <Empty description="加载评论失败" />;
  }

  const comments = data?.items ?? [];

  if (comments.length === 0) {
    return <Empty description="暂无评论" />;
  }

  return (
    <List
      dataSource={comments}
      renderItem={(comment: IComment) => (
        <List.Item
          key={comment.id}
          style={{ padding: '12px 0' }}
        >
          <List.Item.Meta
            avatar={
              <Avatar icon={<UserOutlined />} />
            }
            title={
              <Space size={8}>
                <Text strong>{comment.creatorId}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {formatRelativeTime(comment.createdAt)}
                </Text>
                {comment.isEdited && (
                  <Tag style={{ fontSize: 10, lineHeight: '16px' }}>已编辑</Tag>
                )}
              </Space>
            }
            description={
              <div>
                <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                  {renderContent(comment.content)}
                </div>
                {comment.attachments && comment.attachments.length > 0 && (
                  <div>
                    {comment.attachments.map((url, idx) => (
                      <div key={idx}>
                        <Link href={url} target="_blank" rel="noopener noreferrer">
                          <PaperClipOutlined style={{ marginRight: 4 }} />
                          附件 {idx + 1}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default CommentList;
