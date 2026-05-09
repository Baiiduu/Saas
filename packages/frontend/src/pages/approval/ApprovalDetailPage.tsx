import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Descriptions,
  Tag,
  Button,
  Space,
  Card,
  Divider,
  Modal,
  Input,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { ApprovalStatus } from '@saas/shared-types';
import { useApproval, useProcessApprovalAction } from '@/hooks/useApprovals';
import { useTeamMembers } from '@/hooks/useTenant';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import ApprovalTimeline from '@/components/approval/ApprovalTimeline';
import type { ApprovalNode } from '@/components/approval/ApprovalTimeline';

const { Title, Text } = Typography;

interface ApprovalDetail {
  id: string;
  title?: string;
  templateId: string;
  formData?: Record<string, unknown>;
  status: ApprovalStatus;
  creatorId: string;
  currentProcessorId?: string;
  currentNode?: { id: string; name: string; sortOrder: number; config?: Record<string, unknown> } | null;
  template?: {
    id: string;
    name?: string;
    formFields?: Record<string, unknown>;
    nodes?: Array<{ id: string; name: string; sortOrder: number; config?: Record<string, unknown> }>;
  };
  creator?: { displayName?: string; email?: string };
  actions?: Array<{
    id: string;
    action: string;
    comment?: string | null;
    createdAt: string;
    node?: { id: string; name: string; sortOrder: number };
    processor?: { displayName?: string; email?: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

const statusLabelMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: '待审批',
  [ApprovalStatus.APPROVED]: '已通过',
  [ApprovalStatus.REJECTED]: '已驳回',
  [ApprovalStatus.CANCELED]: '已取消',
};

const statusColorMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'processing',
  [ApprovalStatus.APPROVED]: 'success',
  [ApprovalStatus.REJECTED]: 'error',
  [ApprovalStatus.CANCELED]: 'default',
};

function normalizeFieldLabels(formFields?: Record<string, unknown>): Map<string, string> {
  if (!formFields) return new Map<string, string>();
  const rawFields = Array.isArray(formFields)
    ? formFields
    : Array.isArray((formFields as { fields?: unknown }).fields)
      ? (formFields as { fields: unknown[] }).fields
      : Object.entries(formFields).map(([name, config]) => ({
          name,
          ...(typeof config === 'object' && config ? (config as Record<string, unknown>) : {}),
        }));

  const entries: Array<[string, string]> = rawFields
    .filter((field): field is Record<string, unknown> => Boolean(field) && typeof field === 'object')
    .map((field) => [
      String(field.name || field.key || ''),
      String(field.label || field.name || field.key || ''),
    ] as [string, string])
    .filter(([name]) => Boolean(name));

  return new Map(entries);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

const ApprovalDetailPage: React.FC = () => {
  const { orgId, teamId, approvalId } = useParams<{
    orgId: string;
    teamId: string;
    approvalId: string;
  }>();
  const navigate = useNavigate();

  const { data: approvalRaw, isLoading, isError, error } = useApproval(approvalId);
  const { data: members = [] } = useTeamMembers(teamId);
  const approval = approvalRaw as unknown as ApprovalDetail | undefined;
  const actionMutation = useProcessApprovalAction(approvalId);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | 'redirect'>('approve');
  const [actionComment, setActionComment] = useState('');

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'approvals'));
    }
  }, [orgId, teamId, navigate]);

  const openActionModal = useCallback((type: 'approve' | 'reject' | 'return' | 'redirect') => {
    setActionType(type);
    setActionComment('');
    setActionModalOpen(true);
  }, []);

  const handleActionSubmit = useCallback(async () => {
    try {
      const actionMap = {
        approve: 'APPROVE',
        reject: 'REJECT',
        return: 'RETURN',
        redirect: 'REDIRECT',
      } as const;
      await actionMutation.mutateAsync({
        action: actionMap[actionType],
        comment: actionComment || undefined,
      });
      const actionLabels: Record<string, string> = {
        approve: '审批通过',
        reject: '已驳回',
        return: '已退回',
        redirect: '已转交',
      };
      message.success(`${actionLabels[actionType] || '操作'}成功`);
      setActionModalOpen(false);
    } catch (err) {
      const errorMessage = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message;
      message.error(errorMessage || '操作失败');
    }
  }, [actionType, actionComment, actionMutation]);

  const timelineNodes: ApprovalNode[] = useMemo(() => {
    if (!approval) return [];
    const memberNameById = new Map(
      members.map((member) => [
        member.userId,
        member.displayName || member.email || member.userId,
      ])
    );
    const formatApproverIds = (ids?: unknown[]) =>
      ids?.map((id) => memberNameById.get(String(id)) || String(id)).join(', ');

    if (approval.actions?.length) {
      return approval.actions.map((action) => ({
        id: action.id,
        name: action.node?.name || action.action,
        processorName: action.processor?.displayName || action.processor?.email || '审批人',
        status: action.action === 'REJECTED' ? 'rejected' : 'approved',
        processedAt: action.createdAt,
      }));
    }

    const templateNodes = approval.template?.nodes?.map((node): ApprovalNode => ({
      id: node.id,
      name: node.name,
      processorName: Array.isArray((node.config as { approverIds?: unknown[] } | undefined)?.approverIds)
        ? formatApproverIds((node.config as { approverIds: unknown[] }).approverIds)
        : undefined,
      status: approval.currentNode?.id === node.id ? 'pending' : 'skipped',
    }));
    if (templateNodes?.length) return templateNodes;

    return [
      {
        id: 'submitted',
        name: '提交申请',
        processorName: approval.creator?.displayName || approval.creator?.email || approval.creatorId,
        status: 'approved',
        processedAt: approval.createdAt,
      },
    ];
  }, [approval, members]);

  const formDataEntries = useMemo(() => {
    if (!approval?.formData) return [];
    const labels = normalizeFieldLabels(approval.template?.formFields);
    return Object.entries(approval.formData).map(([key, value]) => ({
      key,
      label: labels.get(key) || key,
      value: formatValue(value),
    }));
  }, [approval]);

  if (!orgId || !teamId || !approvalId) return null;

  if (isLoading) return <Loading tip="加载审批详情..." />;

  if (isError || !approval) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取审批详情失败'}
      />
    );
  }

  const actionLabels: Record<string, string> = {
    approve: '审批通过',
    reject: '驳回',
    return: '退回',
    redirect: '转交',
  };

  const actionIcons: Record<string, React.ReactNode> = {
    approve: <CheckCircleOutlined />,
    reject: <CloseCircleOutlined />,
    return: <RollbackOutlined />,
    redirect: <SwapOutlined />,
  };

  const isPending = approval.status === ApprovalStatus.PENDING;
  const currentApproverIds = (approval.currentNode?.config as { approverIds?: unknown[] } | undefined)?.approverIds;
  const memberNameById = new Map(
    members.map((member) => [
      member.userId,
      member.displayName || member.email || member.userId,
    ])
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回审批列表
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, color: 'rgba(0,0,0,0.88)' }}>
              {approval.title || approval.template?.name || '审批详情'}
            </Title>
            <Tag color={statusColorMap[approval.status]} style={{ marginTop: 8 }}>
              {statusLabelMap[approval.status]}
            </Tag>
          </div>

          {isPending && (
            <Space>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openActionModal('approve')}>
                通过
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => openActionModal('reject')}>
                驳回
              </Button>
              <Button icon={<RollbackOutlined />} onClick={() => openActionModal('return')}>
                退回
              </Button>
              <Button icon={<SwapOutlined />} onClick={() => openActionModal('redirect')}>
                转交
              </Button>
            </Space>
          )}
        </div>

        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="创建人">
            <Space>
              <UserOutlined />
              <Text>{approval.creator?.displayName || approval.creator?.email || approval.creatorId}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="审批模板">
            {approval.template?.name || approval.templateId}
          </Descriptions.Item>
          {approval.currentNode && (
            <Descriptions.Item label="当前节点">
              {approval.currentNode.name}
            </Descriptions.Item>
          )}
          {Array.isArray(currentApproverIds) && (
            <Descriptions.Item label="默认接收人">
              {currentApproverIds.map((id) => memberNameById.get(String(id)) || String(id)).join(', ') || '-'}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="模板 ID">{approval.templateId}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {approval.createdAt ? new Date(approval.createdAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {approval.updatedAt ? new Date(approval.updatedAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          {approval.currentProcessorId && (
            <Descriptions.Item label="当前处理人">
              <Space>
                <UserOutlined />
                <Text>{approval.currentProcessorId}</Text>
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        {formDataEntries.length > 0 && (
          <>
            <Divider />
            <Title level={5}>表单数据</Title>
            <Descriptions column={1} size="small" bordered>
              {formDataEntries.map(({ key, label, value }) => (
                <Descriptions.Item key={key} label={label}>
                  {value}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Card>

      <Card title="审批进度">
        <ApprovalTimeline nodes={timelineNodes} currentProcessorId={approval.currentProcessorId} />
      </Card>

      <Modal
        title={
          <Space>
            {actionIcons[actionType]}
            <span>{actionLabels[actionType]}</span>
          </Space>
        }
        open={actionModalOpen}
        onCancel={() => setActionModalOpen(false)}
        onOk={handleActionSubmit}
        confirmLoading={actionMutation.isPending}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>审批意见</span>
        </div>
        <Input.TextArea
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
          rows={4}
          placeholder={`请输入${actionLabels[actionType]}意见...`}
        />
      </Modal>
    </div>
  );
};

export default ApprovalDetailPage;
