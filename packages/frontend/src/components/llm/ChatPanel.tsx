import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, Button, List, Avatar, Typography, Space, Empty, message } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons';
import Loading from '@/components/common/Loading';

const { Text } = Typography;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SkillAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  prompt: string;
}

export interface ChatPanelProps {
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Called when the user sends a message */
  onSend: (content: string) => Promise<void> | void;
  /** Whether a response is being generated */
  loading?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Available quick skill actions */
  skillActions?: SkillAction[];
  /** Called when a skill action is clicked */
  onSkillAction?: (action: SkillAction) => void;
}

/**
 * ChatPanel - A reusable LLM chat interface component.
 * Displays a message list with an input area and optional skill trigger buttons.
 */
const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSend,
  loading = false,
  placeholder = '输入消息... (Enter 发送, Shift+Enter 换行)',
  skillActions,
  onSkillAction,
}) => {
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content) return;

    setInputValue('');
    try {
      await onSend(content);
    } catch {
      message.error('发送失败，请重试');
    }
  }, [inputValue, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
      }}
    >
      {/* Skill action buttons */}
      {skillActions && skillActions.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
          }}
        >
          <Space wrap size="small">
            {skillActions.map((action) => (
              <Button
                key={action.key}
                size="small"
                icon={action.icon ?? <BulbOutlined />}
                onClick={() => onSkillAction?.(action)}
                type="dashed"
              >
                {action.label}
              </Button>
            ))}
          </Space>
        </div>
      )}

      {/* Messages list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="开始对话"
            />
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <List.Item
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f5f5f5',
                }}
              >
                <List.Item.Meta
                  avatar={
                    msg.role === 'assistant' ? (
                      <Avatar
                        icon={<RobotOutlined />}
                        style={{ background: '#1677ff' }}
                      />
                    ) : (
                      <Avatar icon={<UserOutlined />} />
                    )
                  }
                  title={
                    <Space>
                      <Text strong style={{ fontSize: 13 }}>
                        {msg.role === 'assistant' ? 'AI 助手' : '我'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                      </Text>
                    </Space>
                  }
                  description={
                    <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Loading tip="AI 思考中..." size="small" />
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid #f0f0f0',
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
          background: '#fafafa',
        }}
      >
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          style={{ flex: 1, resize: 'none' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!inputValue.trim()}
          style={{ alignSelf: 'flex-end' }}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default ChatPanel;
