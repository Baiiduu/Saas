import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Input, List, Avatar, Tag, message, Empty } from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  FormOutlined,
  FileTextOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { orgPath } from '@/router/routes';
import * as llmService from '@/services/llmService';
import Loading from '@/components/common/Loading';
import ChatPanel from '@/components/llm/ChatPanel';

const { Title, Text } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SKILL_TRIGGERS = [
  { key: 'summary', label: '总结', icon: <BulbOutlined />, color: '#1677ff' },
  { key: 'task', label: '创建任务', icon: <FormOutlined />, color: '#52c41a' },
  { key: 'doc', label: '生成文档', icon: <FileTextOutlined />, color: '#faad14' },
  { key: 'code', label: '代码审查', icon: <CodeOutlined />, color: '#ff4d4f' },
];

const ChatPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  const handleBack = useCallback(() => {
    if (orgId) {
      navigate(orgPath(orgId));
    }
  }, [orgId, navigate]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || !orgId) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      const response = await llmService.chat({
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content },
        ],
      });
      // Check if the response is a simulated fallback (LLM not configured)
      const replyContent = response.choices?.[0]?.message?.content || '';
      const isSimulated =
        response.id?.startsWith('sim-') || replyContent.startsWith('[SIMULATED]');
      if (isSimulated) {
        throw new Error('LLM 服务未配置（模拟模式）');
      }
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: replyContent || '（无响应）',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || '';
      const isLLMNotConfigured = errorMsg.includes('API key') || errorMsg.includes('未配置') || errorMsg.includes('503');
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: isLLMNotConfigured
          ? 'LLM 服务未配置（模拟模式）。\n配置文件: packages/backend/.env\n环境变量: LLM_API_KEY\n配置后需重启后端服务。'
          : `对话请求失败: ${errorMsg || '未知错误'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setSending(false);
    }
  }, [inputValue, messages, orgId]);

  const handleSkillClick = useCallback(async (skillKey: string) => {
    const skillNames: Record<string, string> = {
      summary: 'summarize',
      task: 'create-task',
      doc: 'generate-doc',
      code: 'review-code',
    };
    const skillId = skillNames[skillKey];
    if (!skillId) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: SKILL_TRIGGERS.find(s => s.key === skillKey)?.label || skillKey,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const result = await llmService.executeSkill(skillId, { prompt: skillKey }, undefined);
      const reply = result?.data || result?.result || JSON.stringify(result);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: typeof reply === 'string' ? reply : JSON.stringify(reply, null, 2),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || '';
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `技能执行失败: ${errorMsg || '未知错误'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setSending(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!orgId) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 180px)',
      }}
    >
      {/* Header */}
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
          <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            AI 助手
          </Title>
        </Space>
      </div>

      {/* Skill trigger buttons */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          快捷操作:
        </Text>
        <Space wrap>
          {SKILL_TRIGGERS.map((skill) => (
            <Button
              key={skill.key}
              icon={skill.icon}
              onClick={() => handleSkillClick(skill.key)}
              style={{
                borderColor: skill.color,
                color: skill.color,
              }}
            >
              {skill.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* Chat panel */}
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
        {/* Messages area */}
        <div
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
                description="开始与 AI 助手对话"
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
          {sending && (
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
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={2}
            style={{ flex: 1, resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={!inputValue.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
