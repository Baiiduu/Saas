import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { orgPath } from '@/router/routes';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePermission } from '@/hooks/usePermission';
import {
  AiMessage,
  AiSessionDetail,
  AiSessionSummary,
  AiSkillDefinition,
  AiSkillResult,
  AiToolCall,
  createSession,
  executeSkill,
  getSessionDetail,
  listSessions,
  listSkills,
  listMcpTools,
  sendSessionMessage,
  confirmToolCall,
} from '@/services/llmService';
import { getApprovalTemplates } from '@/services/approvalService';
import Loading from '@/components/common/Loading';

const { Title, Text, Paragraph } = Typography;

const ONE_CLICK_SKILL_IDS = new Set([
  'summary',
  'weekly-report',
  'task-suggestion',
  'doc-draft',
]);

const TEAM_CONTEXT_SKILL_IDS = new Set([
  'summary',
  'weekly-report',
  'task-suggestion',
  'doc-draft',
  'approval-assist',
]);

const APPROVAL_ASSIST_SKILL_ID = 'approval-assist';

interface ApprovalAssistTemplate {
  id: string;
  name: string;
  description?: string;
  formFields?: Record<string, unknown> | null;
}

interface ApprovalAssistField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'switch';
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

const normalizeFieldOptions = (options: unknown): Array<{ label: string; value: string }> => {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      if (typeof option === 'string') {
        return {
          label: option,
          value: option,
        };
      }

      if (
        option &&
        typeof option === 'object' &&
        'label' in option &&
        'value' in option &&
        typeof (option as Record<string, unknown>).label === 'string' &&
        typeof (option as Record<string, unknown>).value === 'string'
      ) {
        return {
          label: (option as Record<string, string>).label,
          value: (option as Record<string, string>).value,
        };
      }

      return null;
    })
    .filter((option): option is { label: string; value: string } => !!option);
};

const normalizeTemplateFields = (
  formFields?: Record<string, unknown> | null,
): ApprovalAssistField[] => {
  if (!formFields || typeof formFields !== 'object') {
    return [];
  }

  const seededFields = (formFields as { fields?: unknown }).fields;
  if (Array.isArray(seededFields)) {
    return seededFields.flatMap((field) => {
        if (!field || typeof field !== 'object') {
          return [];
        }

        const record = field as Record<string, unknown>;
        const rawName = record.name;
        const rawLabel = record.label;
        const rawType = record.type;

        if (typeof rawName !== 'string' || typeof rawLabel !== 'string') {
          return [];
        }

        return [{
          name: rawName,
          label: rawLabel,
          type: rawType === 'boolean' ? 'switch' : (rawType as ApprovalAssistField['type']) || 'text',
          required: Boolean(record.required),
          options: normalizeFieldOptions(record.options),
        }];
      });
  }

  return Object.entries(formFields).flatMap(([name, value]) => {
      if (!value || typeof value !== 'object') {
        return [];
      }

      const record = value as Record<string, unknown>;
      const rawType = typeof record.type === 'string' ? record.type : 'text';
      return [{
        name,
        label: typeof record.label === 'string' ? record.label : name,
        type: rawType === 'boolean' ? 'switch' : (rawType as ApprovalAssistField['type']),
        required: Boolean(record.required),
        options: normalizeFieldOptions(record.options),
      }];
    });
};

const sanitizeFormValues = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFormValues(item));
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toISOString?: unknown }).toISOString === 'function' &&
    Object.prototype.toString.call(value) !== '[object Object]'
  ) {
    return (value as { toISOString: () => string }).toISOString();
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeFormValues(item),
      ]),
    );
  }

  return value;
};

const getSessionPreview = (session: AiSessionSummary): string => {
  const previewMessage = session.messages?.find((message) => message.role !== 'TOOL');
  return previewMessage?.content || '暂无预览';
};

const ChatPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const currentTeam = useWorkspaceStore((state) => state.currentTeam);
  const { can } = usePermission();
  const [approvalAssistForm] = Form.useForm();

  const [sessions, setSessions] = useState<AiSessionSummary[]>([]);
  const [skills, setSkills] = useState<AiSkillDefinition[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<AiSessionDetail | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [approvalAssistOpen, setApprovalAssistOpen] = useState(false);
  const [approvalTemplates, setApprovalTemplates] = useState<ApprovalAssistTemplate[]>([]);
  const [approvalTemplatesLoading, setApprovalTemplatesLoading] = useState(false);

  const canReadLlm = can('llm.read');
  const canCreateLlm = can('llm.create');
  const selectedTemplateId = Form.useWatch('templateId', approvalAssistForm);

  const approvalAssistSkill = useMemo(
    () => skills.find((skill) => skill.id === APPROVAL_ASSIST_SKILL_ID) ?? null,
    [skills],
  );

  const selectedApprovalTemplate = useMemo(
    () => approvalTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [approvalTemplates, selectedTemplateId],
  );

  const approvalAssistFields = useMemo(
    () => normalizeTemplateFields(selectedApprovalTemplate?.formFields),
    [selectedApprovalTemplate],
  );

  useEffect(() => {
    if (!orgId || !canReadLlm) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setInitialLoading(true);
      try {
        const teamId = currentTeam?.id;
        const [sessionList, skillList, toolList] = await Promise.all([
          listSessions({ teamId, limit: 30 }),
          listSkills(teamId),
          listMcpTools(teamId),
        ]);

        if (cancelled) {
          return;
        }

        setSessions(sessionList);
        setSkills(skillList);
        setToolCount(toolList.length);

        if (sessionList.length > 0) {
          const nextSessionId = activeSessionId ?? sessionList[0].id;
          setActiveSessionId(nextSessionId);
          await loadSessionDetail(nextSessionId);
        } else {
          setActiveSessionId(null);
          setSessionDetail(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          message.error(error?.response?.data?.message || error?.message || '加载 AI 工作台失败');
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [orgId, currentTeam?.id, canReadLlm]);

  useEffect(() => {
    if (!approvalAssistOpen || !currentTeam?.id) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setApprovalTemplatesLoading(true);
      try {
        const templates = await getApprovalTemplates(currentTeam.id);
        if (!cancelled) {
          setApprovalTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (error: any) {
        if (!cancelled) {
          message.error(error?.response?.data?.message || error?.message || '加载审批模板失败');
        }
      } finally {
        if (!cancelled) {
          setApprovalTemplatesLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [approvalAssistOpen, currentTeam?.id]);

  useEffect(() => {
    if (approvalAssistOpen) {
      approvalAssistForm.setFieldsValue({
        title: `AI 发起审批 ${new Date().toLocaleDateString('zh-CN')}`,
        approvalId: undefined,
        templateId: undefined,
        formData: {},
      });
    } else {
      approvalAssistForm.resetFields();
    }
  }, [approvalAssistOpen, approvalAssistForm]);

  useEffect(() => {
    if (approvalAssistOpen) {
      approvalAssistForm.setFieldValue('formData', {});
    }
  }, [approvalAssistOpen, selectedTemplateId, approvalAssistForm]);

  const loadSessionDetail = async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const detail = await getSessionDetail(sessionId);
      setSessionDetail(detail);
      setActiveSessionId(sessionId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '加载会话失败');
    } finally {
      setMessagesLoading(false);
    }
  };

  const refreshSessions = async (preferredSessionId?: string) => {
    const refreshed = await listSessions({
      teamId: currentTeam?.id,
      limit: 30,
    });
    setSessions(refreshed);

    const nextSessionId = preferredSessionId ?? activeSessionId ?? refreshed[0]?.id ?? null;
    if (nextSessionId) {
      await loadSessionDetail(nextSessionId);
    } else {
      setSessionDetail(null);
      setActiveSessionId(null);
    }
  };

  const ensureSession = async () => {
    if (activeSessionId) {
      return activeSessionId;
    }

    const session = await createSession({
      teamId: currentTeam?.id,
      title: currentTeam ? `${currentTeam.name} AI 会话` : undefined,
    });

    setActiveSessionId(session.id);
    await refreshSessions(session.id);
    return session.id;
  };

  const handleCreateSession = async () => {
    if (!canCreateLlm) {
      message.warning('当前角色仅具备 AI 读取权限，不能新建会话。');
      return;
    }

    try {
      const session = await createSession({
        teamId: currentTeam?.id,
        title: currentTeam ? `${currentTeam.name} AI 会话` : undefined,
      });
      setInputValue('');
      await refreshSessions(session.id);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '创建会话失败');
    }
  };

  const handleSend = async () => {
    if (!canCreateLlm) {
      message.warning('当前角色仅具备 AI 读取权限，不能发送消息。');
      return;
    }

    const content = inputValue.trim();
    if (!content) {
      return;
    }

    setSending(true);
    try {
      const sessionId = await ensureSession();
      setInputValue('');
      await sendSessionMessage(sessionId, {
        content,
        teamId: currentTeam?.id,
      });
      await refreshSessions(sessionId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '发送消息失败');
    } finally {
      setSending(false);
    }
  };

  const buildSkillArgs = (skillId: string): Record<string, unknown> | null => {
    const teamId = currentTeam?.id;

    if (!teamId && TEAM_CONTEXT_SKILL_IDS.has(skillId)) {
      return null;
    }

    if (skillId === 'summary' || skillId === 'weekly-report' || skillId === 'task-suggestion') {
      return { teamId };
    }

    if (skillId === 'doc-draft') {
      return {
        teamId,
        name: `AI 草稿 ${new Date().toLocaleDateString('zh-CN')}`,
        prompt: '请生成一份适合作为团队协作文档起点的结构化草稿',
      };
    }

    return teamId ? { teamId } : {};
  };

  const executeSkillRequest = async (
    skillId: string,
    args?: Record<string, unknown>,
  ): Promise<AiSkillResult | null> => {
    setSending(true);
    try {
      const sessionId = await ensureSession();
      const result = await executeSkill(skillId, args, currentTeam?.id, sessionId);
      await refreshSessions(sessionId);

      if (result.status === 'pending_confirmation') {
        message.info('技能已生成待确认操作，请在会话中确认。');
        return result;
      }

      if (!result.success) {
        message.error(result.error || '技能执行失败');
      }

      return result;
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '技能执行失败');
      return null;
    } finally {
      setSending(false);
    }
  };

  const handleRunSkill = async (skill: AiSkillDefinition) => {
    if (!can(skill.requiredPermission)) {
      message.warning(`当前角色缺少 ${skill.requiredPermission} 权限。`);
      return;
    }

    if (skill.id === APPROVAL_ASSIST_SKILL_ID) {
      if (!currentTeam?.id) {
        message.warning('审批辅助技能需要先进入团队上下文。');
        return;
      }
      setApprovalAssistOpen(true);
      return;
    }

    const args = buildSkillArgs(skill.id);
    if (args === null) {
      message.warning('该技能需要先进入团队上下文。');
      return;
    }

    await executeSkillRequest(skill.id, args);
  };

  const handleSubmitApprovalAssist = async () => {
    if (!currentTeam?.id || !approvalAssistSkill) {
      message.warning('审批辅助技能需要先进入团队上下文。');
      return;
    }

    try {
      const values = await approvalAssistForm.validateFields();
      const result = await executeSkillRequest(approvalAssistSkill.id, {
        teamId: currentTeam.id,
        approvalId: values.approvalId?.trim() || undefined,
        templateId: values.templateId,
        title: values.title,
        formData: (sanitizeFormValues(values.formData ?? {}) as Record<string, unknown>) ?? {},
      });

      if (result && (result.success || result.status === 'pending_confirmation')) {
        setApprovalAssistOpen(false);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      const requestError = error as { response?: { data?: { message?: string } }; message?: string };
      message.error(requestError?.response?.data?.message || requestError?.message || '审批辅助执行失败');
    }
  };

  const handleConfirmToolCall = async (toolCall: AiToolCall) => {
    setConfirmingId(toolCall.id);
    try {
      await confirmToolCall(toolCall.id);
      message.success(`${toolCall.toolName} 已确认执行`);
      if (sessionDetail?.id) {
        await refreshSessions(sessionDetail.id);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '确认执行失败');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleBack = () => {
    if (orgId) {
      navigate(orgPath(orgId));
    }
  };

  const renderApprovalField = (field: ApprovalAssistField) => {
    const rules = field.required
      ? [{ required: true, message: `请输入${field.label}` }]
      : undefined;

    if (field.type === 'textarea') {
      return (
        <Form.Item key={field.name} name={['formData', field.name]} label={field.label} rules={rules}>
          <Input.TextArea rows={3} placeholder={`请输入${field.label}`} />
        </Form.Item>
      );
    }

    if (field.type === 'number') {
      return (
        <Form.Item key={field.name} name={['formData', field.name]} label={field.label} rules={rules}>
          <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.label}`} />
        </Form.Item>
      );
    }

    if (field.type === 'date') {
      return (
        <Form.Item key={field.name} name={['formData', field.name]} label={field.label} rules={rules}>
          <Input type="date" />
        </Form.Item>
      );
    }

    if (field.type === 'select') {
      return (
        <Form.Item key={field.name} name={['formData', field.name]} label={field.label} rules={rules}>
          <Select
            placeholder={`请选择${field.label}`}
            options={field.options}
          />
        </Form.Item>
      );
    }

    if (field.type === 'switch') {
      return (
        <Form.Item
          key={field.name}
          name={['formData', field.name]}
          label={field.label}
          valuePropName="checked"
          rules={rules}
        >
          <Switch />
        </Form.Item>
      );
    }

    return (
      <Form.Item key={field.name} name={['formData', field.name]} label={field.label} rules={rules}>
        <Input placeholder={`请输入${field.label}`} />
      </Form.Item>
    );
  };

  const renderMessage = (item: AiMessage) => {
    const metadata = item.metadata ?? {};
    const steps = Array.isArray(metadata.steps) ? metadata.steps as Array<Record<string, unknown>> : [];
    const sources = Array.isArray(metadata.sources) ? metadata.sources as Array<Record<string, unknown>> : [];

    return (
      <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
        <List.Item.Meta
          avatar={
            item.role === 'USER' ? (
              <Avatar icon={<UserOutlined />} />
            ) : (
              <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />
            )
          }
          title={
            <Space size={8}>
              <Text strong>{item.role === 'USER' ? '我' : 'AI 助手'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </Text>
              {typeof metadata.skillId === 'string' && (
                <Tag color="blue">{metadata.skillId}</Tag>
              )}
            </Space>
          }
          description={
            <div>
              <Paragraph style={{ marginBottom: steps.length ? 8 : 0, whiteSpace: 'pre-wrap' }}>
                {item.content}
              </Paragraph>
              {steps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {steps.map((step, index) => (
                    <Tag
                      key={`${item.id}-${index}`}
                      color={String(step.status).includes('failed') ? 'red' : String(step.status).includes('pending') ? 'gold' : 'green'}
                    >
                      {String(step.toolId)} · {String(step.status ?? 'completed')}
                    </Tag>
                  ))}
                </div>
              )}
              {sources.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    数据来源
                  </Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {sources.map((source, index) => (
                      <Text key={`${item.id}-source-${index}`} style={{ fontSize: 12 }}>
                        {String(source.title ?? '未命名对象')}
                        {source.id ? ` · ${String(source.id)}` : ''}
                        {source.subtitle ? ` · ${String(source.subtitle)}` : ''}
                      </Text>
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
        />
      </List.Item>
    );
  };

  if (!orgId) {
    return null;
  }

  if (initialLoading) {
    return <Loading tip="加载 AI 工作台..." />;
  }

  const quickSkills = skills.filter((skill) => ONE_CLICK_SKILL_IDS.has(skill.id));
  const visibleMessages = sessionDetail?.messages?.filter((item) => item.role !== 'TOOL') ?? [];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 180px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回
            </Button>
            <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>
              AI 工作台
            </Title>
            {currentTeam && <Tag color="blue">{currentTeam.name}</Tag>}
          </Space>
          <Text type="secondary">
            可用技能 {skills.length} 个，可用工具 {toolCount} 个，当前会话 {sessions.length} 条
          </Text>
        </div>

        {!canCreateLlm && (
          <Alert
            type="info"
            showIcon
            message="当前账号只有 AI 读取权限"
            description="你可以查看历史会话和可用技能，但不能发送消息、新建会话或执行需要 llm.create 的技能。"
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 0, flex: 1 }}>
          <Card
            title="历史会话"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleCreateSession}
                disabled={!canCreateLlm}
              >
                新建
              </Button>
            }
            bodyStyle={{ padding: 0, height: '100%', overflow: 'auto' }}
          >
            {sessions.length === 0 ? (
              <div style={{ padding: 24 }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" />
              </div>
            ) : (
              <List
                dataSource={sessions}
                renderItem={(session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <List.Item
                      onClick={() => void loadSessionDetail(session.id)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: active ? '#f0f5ff' : undefined,
                        borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        <Text strong ellipsis style={{ display: 'block', maxWidth: 220 }}>
                          {session.title || '未命名会话'}
                        </Text>
                        <Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 220, fontSize: 12 }}>
                          {getSessionPreview(session)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(session.lastActiveAt).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>

          <Card
            bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
            title={sessionDetail?.title || 'AI 对话'}
            extra={
              currentTeam ? <Tag color="processing">{currentTeam.name}</Tag> : <Tag>企业级上下文</Tag>
            }
          >
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                快捷技能
              </Text>
              <Space wrap>
                {quickSkills.map((skill) => (
                  <Button
                    key={skill.id}
                    onClick={() => void handleRunSkill(skill)}
                    disabled={sending || !can(skill.requiredPermission) || (TEAM_CONTEXT_SKILL_IDS.has(skill.id) && !currentTeam?.id)}
                  >
                    {skill.name}
                  </Button>
                ))}
                {approvalAssistSkill && (
                  <Button
                    onClick={() => void handleRunSkill(approvalAssistSkill)}
                    disabled={sending || !can(approvalAssistSkill.requiredPermission) || !currentTeam?.id}
                  >
                    {approvalAssistSkill.name}
                  </Button>
                )}
              </Space>
            </div>

            {sessionDetail?.pendingToolCalls?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {sessionDetail.pendingToolCalls.map((toolCall) => (
                  <Alert
                    key={toolCall.id}
                    type="warning"
                    showIcon
                    message={`待确认操作: ${toolCall.toolName}`}
                    description={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <Text type="secondary">
                          风险级别: {toolCall.riskLevel}
                        </Text>
                        <Button
                          type="primary"
                          danger
                          size="small"
                          loading={confirmingId === toolCall.id}
                          onClick={() => void handleConfirmToolCall(toolCall)}
                          disabled={!canCreateLlm}
                        >
                          确认执行
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : null}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 8 }}>
              {messagesLoading ? (
                <Loading tip="加载消息..." />
              ) : visibleMessages.length ? (
                <List dataSource={visibleMessages} renderItem={renderMessage} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="开始与 AI 协作" />
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 12 }}>
              <Input.TextArea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                rows={3}
                disabled={!canCreateLlm}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text type="secondary">
                  {currentTeam ? `当前团队: ${currentTeam.name}` : '当前为企业级 AI 上下文'}
                </Text>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sending}
                  disabled={!canCreateLlm || !inputValue.trim()}
                  onClick={() => void handleSend()}
                >
                  发送
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="审批辅助"
        open={approvalAssistOpen}
        onCancel={() => setApprovalAssistOpen(false)}
        onOk={() => void handleSubmitApprovalAssist()}
        confirmLoading={sending}
        destroyOnClose
        width={680}
      >
        <Form form={approvalAssistForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="title"
            label="审批标题"
            rules={[{ required: true, message: '请输入审批标题' }]}
          >
            <Input placeholder="例如：AI 发起采购审批" />
          </Form.Item>

          <Form.Item
            name="templateId"
            label="审批模板"
            rules={[{ required: true, message: '请选择审批模板' }]}
          >
            <Select
              placeholder="选择审批模板"
              loading={approvalTemplatesLoading}
              options={approvalTemplates.map((template) => ({
                label: template.name,
                value: template.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="approvalId"
            label="参考审批 ID"
            extra="可选。填写后，AI 会先读取该审批，再基于其内容准备新的审批单。"
          >
            <Input placeholder="留空则直接按模板发起新的审批" />
          </Form.Item>

          {selectedApprovalTemplate?.description && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={selectedApprovalTemplate.name}
              description={selectedApprovalTemplate.description}
            />
          )}

          {approvalAssistFields.length > 0 ? (
            <Card size="small" title="模板字段">
              {approvalAssistFields.map((field) => renderApprovalField(field))}
            </Card>
          ) : selectedTemplateId ? (
            <Text type="secondary">当前模板没有额外表单字段。</Text>
          ) : null}
        </Form>
      </Modal>
    </>
  );
};

export default ChatPage;
