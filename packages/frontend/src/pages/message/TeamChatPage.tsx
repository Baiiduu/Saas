import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Input,
  List,
  Avatar,
  Tag,
  message,
  Spin,
  Tooltip,
  Badge,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  UserOutlined,
  CheckCircleOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import type { IMessage } from '@saas/shared-types';
import { getMessages, sendMessage, searchMessages } from '@/services/messageService';
import { getTasks } from '@/services/taskService';
import { getDocumentTree, searchDocuments } from '@/services/documentService';
import { teamPath, teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import QuickTaskInput from '@/components/message/QuickTaskInput';
import type { QuickRefItem } from '@/components/message/QuickTaskInput';
import { useAuthStore } from '@/stores/authStore';
import type { IDocument } from '@saas/shared-types';

const { Title, Text } = Typography;

const REFERENCE_PATTERN = /@\[(task|doc)\|([^\]]+)\]\(([^)]+)\)/g;

interface MessageReference {
  type: 'task' | 'doc';
  resourceId: string;
  label: string;
  url?: string;
}

interface MessageWithSender extends IMessage {
  metadata?: {
    references?: MessageReference[];
  };
  sender?: {
    id: string;
    email: string;
    displayName: string;
    avatar?: string;
    avatarUrl?: string;
  };
  reads?: Array<{ userId: string; readAt: string }>;
}

interface DocumentTreeItem extends IDocument {
  children?: DocumentTreeItem[];
}

function flattenDocuments(items: DocumentTreeItem[]): DocumentTreeItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenDocuments(item.children ?? []),
  ]);
}

const TeamChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<QuickRefItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'polling'>('disconnected');
  const [pollingMode, setPollingMode] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<MessageWithSender[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load historical messages
  useEffect(() => {
    if (!teamId) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const data = await getMessages(teamId, { limit: 50 });
        const msgs = (data.items || []) as MessageWithSender[];
        setMessages(msgs);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore ?? msgs.length >= 50);
      } catch {
        // Silently fail - messages might not be available yet
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Connect to WebSocket for real-time chat
    const socket = io('/messages', {
      auth: {
        userId: user?.id,
        email: user?.email,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      setPollingMode(false);
      socket.emit('join_room', { teamId });
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setSocketStatus('disconnected');
    });

    socket.on('reconnecting', () => {
      setSocketStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      setSocketStatus('connected');
    });

    socket.on('new_message', (payload: any) => {
      const msg = payload?.message ?? payload;
      setMessages((prev) => [...prev, msg as MessageWithSender]);
    });

    socket.on('message_sent', (payload: any) => {
      const msg = payload?.message ?? payload;
      setMessages((prev) => [...prev, msg as MessageWithSender]);
    });

    // HTTP fallback polling — if socket not connected within 5s, start polling
    const pollingTimer = setTimeout(() => {
      if (socketRef.current?.connected !== true) {
        setPollingMode(true);
        setSocketStatus('polling');
      }
    }, 5000);

    const pollInterval = setInterval(async () => {
      if (!teamId) return;
      if (socketRef.current?.connected === true) {
        // Socket is connected, no need to poll
        return;
      }
      try {
        const data = await getMessages(teamId, { limit: 50 });
        if (data.items.length > 0) {
          setMessages((prev) => {
            // Merge: only add messages not already in state
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = data.items.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newMsgs];
          });
        }
      } catch {
        // Silent fail
      }
    }, 10000);

    return () => {
      clearTimeout(pollingTimer);
      clearInterval(pollInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [teamId, user?.id, user?.email]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const extractReferences = useCallback((content: string): MessageReference[] => {
    const references: MessageReference[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    REFERENCE_PATTERN.lastIndex = 0;
    while ((match = REFERENCE_PATTERN.exec(content)) !== null) {
      const [, refType, label, resourceId] = match;
      const type = refType === 'task' ? 'task' : 'doc';
      const key = `${type}:${resourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      references.push({
        type,
        resourceId,
        label,
        url: type === 'task' ? `tasks/${resourceId}` : `documents/${resourceId}`,
      });
    }

    selectedRefs.forEach((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return;
      references.push({
        type: item.type,
        resourceId: item.id,
        label: item.label,
        url: item.type === 'task' ? `tasks/${item.id}` : `documents/${item.id}`,
      });
    });

    return references;
  }, [selectedRefs]);

  const handleSend = useCallback(async (content: string) => {
    if (!content || !teamId) return;

    setSending(true);
    try {
      const references = extractReferences(content);
      if (socketRef.current?.connected) {
        // Send via WebSocket
        socketRef.current.emit('send_message', {
          teamId,
          content,
          type: 'TEXT',
          references,
        });
        // Message arrives via message_sent event
        setInputValue('');
        setSelectedRefs([]);
      } else {
        // Fallback to HTTP
        const msg = await sendMessage(teamId, { content, references });
        setMessages((prev) => [...prev, msg]);
        setInputValue('');
        setSelectedRefs([]);
      }
    } catch {
      message.error('发送消息失败');
    } finally {
      setSending(false);
    }
  }, [teamId, extractReferences]);

  const handleScroll = useCallback(async () => {
    if (!listRef.current || !teamId) return;
    const { scrollTop } = listRef.current;

    if (scrollTop < 50 && hasMore && !loadingMore && cursor) {
      setLoadingMore(true);
      try {
        const data = await getMessages(teamId, { cursor, limit: 50 });
        if (data.items.length > 0) {
          setMessages((prev) => [...data.items, ...prev]);
          setCursor(data.nextCursor);
          setHasMore(data.hasMore ?? false);
        } else {
          setHasMore(false);
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingMore(false);
      }
    }
  }, [teamId, cursor, hasMore, loadingMore]);

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamPath(orgId, teamId));
    }
  }, [orgId, teamId, navigate]);

  const handleReferenceSelect = useCallback((item: QuickRefItem) => {
    setSelectedRefs((prev) => {
      if (prev.some((ref) => ref.type === item.type && ref.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
    message.success(`已引用${item.type === 'task' ? '任务' : '文档'}: ${item.label}`);
  }, []);

  const handleSearchRefs = useCallback(
    async (type: 'task' | 'doc', keyword: string): Promise<QuickRefItem[]> => {
      if (!teamId) return [];
      const normalizedKeyword = keyword.trim();
      try {
        if (type === 'task') {
          const result = await getTasks({
            ...(normalizedKeyword ? { search: normalizedKeyword } : {}),
            teamId,
            limit: 10,
          });
          return (result.items || []).map((task) => ({
            id: task.id,
            type: 'task' as const,
            label: task.title,
            description: `任务: ${task.title}`,
          }));
        } else {
          const docs = normalizedKeyword
            ? await searchDocuments(teamId, normalizedKeyword)
            : flattenDocuments((await getDocumentTree(teamId)) as DocumentTreeItem[])
                .filter((doc) => doc.type !== 'FOLDER')
                .slice(0, 10);
          return (docs || []).slice(0, 10).map((doc) => ({
            id: doc.id,
            type: 'doc' as const,
            label: doc.name,
            description: `文档: ${doc.name}`,
          }));
        }
      } catch {
        return [];
      }
    },
    [teamId]
  );

  const displayMessages = isSearching ? searchResults : (messages as MessageWithSender[]);

  const renderReferenceCards = useCallback((msg: MessageWithSender) => {
    const references = msg.metadata?.references ?? [];
    if (references.length === 0) return null;

    return (
      <Space size={[8, 6]} wrap style={{ marginTop: 8 }}>
        {references.map((ref) => (
          <Tag
            key={`${ref.type}:${ref.resourceId}`}
            color={ref.type === 'task' ? 'green' : 'blue'}
            style={{ cursor: 'pointer', padding: '3px 8px' }}
            onClick={() => {
              if (!orgId || !teamId) return;
              navigate(teamSubPath(orgId, teamId, ref.url || (ref.type === 'task' ? `tasks/${ref.resourceId}` : `documents/${ref.resourceId}`)));
            }}
          >
            {ref.type === 'task' ? '任务' : '文档'}：{ref.label}
          </Tag>
        ))}
      </Space>
    );
  }, [navigate, orgId, teamId]);

  const renderMessageContent = useCallback(
    (content: string) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      REFERENCE_PATTERN.lastIndex = 0;
      while ((match = REFERENCE_PATTERN.exec(content)) !== null) {
        const [raw, refType, label, resourceId] = match;
        const start = match.index;

        if (start > lastIndex) {
          parts.push(content.slice(lastIndex, start));
        }

        parts.push(
          <a
            key={`${resourceId}-${start}`}
            onClick={() => {
              if (!orgId || !teamId) return;
              navigate(
                teamSubPath(
                  orgId,
                  teamId,
                  refType === 'task' ? `tasks/${resourceId}` : `documents/${resourceId}`,
                ),
              );
            }}
          >
            {label}
          </a>,
        );

        lastIndex = start + raw.length;
      }

      if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
      }

      return parts.length > 0 ? parts : content;
    },
    [navigate, orgId, teamId],
  );

  if (!orgId || !teamId) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 180px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            团队聊天
          </Title>
          {socketStatus === 'connected' && !pollingMode && (
            <Tag color="success" style={{ marginLeft: 8 }}>已连接</Tag>
          )}
          {socketStatus === 'disconnected' && !pollingMode && (
            <Tag color="error" style={{ marginLeft: 8 }}>未连接</Tag>
          )}
          {socketStatus === 'reconnecting' && (
            <Tag color="warning" style={{ marginLeft: 8 }}>重连中...</Tag>
          )}
          {pollingMode && (
            <Tag color="processing" style={{ marginLeft: 8 }}>轮询模式</Tag>
          )}
        </Space>
      </div>

      <div style={{ padding: '0 16px 8px' }}>
        <Input.Search
          placeholder="搜索消息..."
          allowClear
          value={searchKeyword}
          onChange={(e) => {
            const val = e.target.value;
            setSearchKeyword(val);
            if (!val) {
              setSearchResults([]);
              setIsSearching(false);
            }
          }}
          onSearch={async (value) => {
            if (!value || !teamId) return;
            setIsSearching(true);
            try {
              const result = await searchMessages(teamId, value);
              setSearchResults((result as any)?.items || []);
            } catch {
              message.error('搜索失败');
            }
          }}
          style={{ maxWidth: 400 }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        {/* Messages list */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}
        >
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <Spin size="small" />
            </div>
          )}
          {loading ? (
            <Loading tip="加载消息..." />
          ) : displayMessages.length === 0 ? (
            isSearching ? (
              <Empty description="未找到匹配的消息" />
            ) : (
              <EmptyState
                title="暂无消息"
                description="开始发送第一条消息吧"
              />
            )
          ) : (
            <List
              dataSource={displayMessages}
              renderItem={(msg) => (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #f5f5f5',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        src={(msg as MessageWithSender).sender?.avatar || (msg as MessageWithSender).sender?.avatarUrl}
                        icon={<UserOutlined />}
                      />
                    }
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>
                          {(msg as MessageWithSender).sender?.displayName || msg.senderId}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(msg.createdAt).toLocaleTimeString('zh-CN')}
                        </Text>
                        {msg.type && msg.type !== 'TEXT' && (
                          <Tag style={{ fontSize: 10 }}>{msg.type}</Tag>
                        )}
                        <Tooltip title="已读">
                          <CheckCircleOutlined
                            style={{ fontSize: 11, color: '#52c41a' }}
                          />
                        </Tooltip>
                      </Space>
                    }
                    description={
                      <div>
                        <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                          {renderMessageContent(msg.content)}
                        </Text>
                        {renderReferenceCards(msg as MessageWithSender)}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>

        {/* Input area with @task/@doc quick reference */}
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            background: '#fafafa',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {selectedRefs.length > 0 && (
                <Space size={[6, 4]} wrap style={{ marginBottom: 6 }}>
                  {selectedRefs.map((ref) => (
                    <Tag
                      key={`${ref.type}:${ref.id}`}
                      closable
                      color={ref.type === 'task' ? 'green' : 'blue'}
                      onClose={() =>
                        setSelectedRefs((prev) =>
                          prev.filter((item) => !(item.type === ref.type && item.id === ref.id)),
                        )
                      }
                    >
                      已引用{ref.type === 'task' ? '任务' : '文档'}：{ref.label}
                    </Tag>
                  ))}
                </Space>
              )}
              <QuickTaskInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                onReferenceSelect={handleReferenceSelect}
                onSearch={handleSearchRefs}
              />
            </div>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend(inputValue)}
              loading={sending}
              disabled={!inputValue.trim()}
              style={{ alignSelf: 'flex-end', marginTop: 22 }}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamChatPage;
