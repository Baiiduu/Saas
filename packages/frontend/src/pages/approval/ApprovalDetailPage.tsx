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
import { useApproval } from '@/hooks/useApprovals';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import ApprovalTimeline from '@/components/approval/ApprovalTimeline';
import type { ApprovalNode } from '@/components/approval/ApprovalTimeline';

const { Title, Text, Paragraph } = Typography;

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

const ApprovalDetailPage: React.FC = () => {
  const { orgId, teamId, approvalId } = useParams<{
    orgId: string;
    teamId: string;
    approvalId: string;
  }>();
  const navigate = useNavigate();

  const { data: approval, isLoading, isError, error } = useApproval(approvalId);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | 'redirect'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
    setActionLoading(true);
    try {
      // In a real implementation, this would call the API
      // await approvalService.processApproval(approvalId, { action: actionType, comment: actionComment });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const actionLabels: Record<string, string> = {
        approve: '审批通过',
        reject: '已驳回',
        return: '已退回',
        redirect: '已转交',
      };
      message.success(`${actionLabels[actionType] || '操作'}成功`);
      setActionModalOpen(false);
    } catch {
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  }, [actionType, actionComment]);

  // Compute timeline nodes from approval data (if the API includes approvalNodes)
  const timelineNodes: ApprovalNode[] = useMemo(() => {
    if (!approval) return [];
    // Use approval.approvalNodes if available, otherwise create a single node
    const nodes = (approval as unknown as Record<string, unknown>).approvalNodes as ApprovalNode[] | undefined;
    if (nodes && nodes.length > 0) return nodes;

    // Fallback: create a simple timeline based on status
    const fallbackNodes: ApprovalNode[] = [
      {
        id: 'submitted',
        name: '提交申请',
        processorName: approval.creatorId,
        status: 'approved',
        processedAt: approval.createdAt,
      },
    ];

    if (approval.status === ApprovalStatus.APPROVED) {
      fallbackNodes.push({
        id: 'approved',
        name: '审批通过',
        processorName: approval.currentProcessorId || '审批人',
        status: 'approved',
        processedAt: approval.updatedAt,
      });
    } else if (approval.status === ApprovalStatus.REJECTED) {
      fallbackNodes.push({
        id: 'rejected',
        name: '审批驳回',
        processorName: approval.currentProcessorId || '审批人',
        status: 'rejected',
        processedAt: approval.updatedAt,
      });
    } else if (approval.status === ApprovalStatus.PENDING) {
      fallbackNodes.push({
        id: 'pending',
        name: '审批处理中',
        processorId: approval.currentProcessorId,
        status: 'pending',
      });
    } else if (approval.status === ApprovalStatus.CANCELED) {
      fallbackNodes.push({
        id: 'canceled',
        name: '已取消',
        status: 'skipped',
        processedAt: approval.updatedAt,
      });
    }

    return fallbackNodes;
  }, [approval]);

  const formDataEntries = useMemo(() => {
    if (!approval?.formData) return [];
    return Object.entries(approval.formData).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
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

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回审批列表
        </Button>
      </Space>

      {/* Basic Info */}
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
            <Title level={4} style={{ margin: 0 }}>
              {approval.title}
            </Title>
            <Tag color={statusColorMap[approval.status]} style={{ marginTop: 8 }}>
              {statusLabelMap[approval.status]}
            </Tag>
          </div>

          {/* Action buttons for pending approvals */}
          {isPending && (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => openActionModal('approve')}
              >
                通过
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => openActionModal('reject')}
              >
                驳回
              </Button>
              <Button
                icon={<RollbackOutlined />}
                onClick={() => openActionModal('return')}
              >
                退回
              </Button>
              <Button
                icon={<SwapOutlined />}
                onClick={() => openActionModal('redirect')}
              >
                转交
              </Button>
            </Space>
          )}
        </div>

        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="创建人">
            <Space>
              <UserOutlined />
              <Text>{approval.creatorId}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="模板 ID">
            {approval.templateId}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {approval.createdAt
              ? new Date(approval.createdAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {approval.updatedAt
              ? new Date(approval.updatedAt).toLocaleString('zh-CN')
              : '-'}
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
              {formDataEntries.map(({ key, value }) => (
                <Descriptions.Item key={key} label={key}>
                  {value || '-'}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Card>

      {/* Approval Timeline */}
      <Card title="审批进度">
        <ApprovalTimeline
          nodes={timelineNodes}
          currentProcessorId={approval.currentProcessorId}
        />
      </Card>

      {/* Approval Action Modal */}
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
        confirmLoading={actionLoading}
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
