import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Card,
  List,
  Tag,
  message,
  Modal,
  Descriptions,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useApprovalTemplates, useApprovalTemplate } from '@/hooks/useApprovals';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import TemplateBuilder from '@/components/approval/TemplateBuilder';

const { Title, Text } = Typography;

const ApprovalTemplatePage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const { data: templates, isLoading, isError, error } = useApprovalTemplates(teamId);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { data: templateDetail, isLoading: detailLoading } = useApprovalTemplate(
    selectedTemplateId || undefined
  );

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'approvals'));
    }
  }, [orgId, teamId, navigate]);

  const templateList = Array.isArray(templates) ? templates : [];

  if (!orgId || !teamId) return null;

  if (isLoading) return <Loading tip="加载审批模板..." />;

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取审批模板失败'}
      />
    );
  }

  return (
    <div>
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
            返回审批列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            审批模板管理
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setBuilderOpen(true)}
        >
          新建模板
        </Button>
      </div>

      {templateList.length === 0 ? (
        <EmptyState
          title="暂无模板"
          description="尚未创建审批模板"
          actionText="新建模板"
          onAction={() => setBuilderOpen(true)}
        />
      ) : (
        <List
          dataSource={templateList}
          renderItem={(template: {
            id: string;
            name: string;
            description: string;
            formFields: Record<string, unknown>;
          }) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              hoverable
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <Text strong style={{ fontSize: 15 }}>
                    {template.name}
                  </Text>
                  <br />
                  <Text type="secondary">{template.description || '无描述'}</Text>
                  <br />
                  <Tag style={{ marginTop: 6 }}>
                    {Object.keys(template.formFields || {}).length} 个字段
                  </Tag>
                </div>
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  查看
                </Button>
              </div>
            </Card>
          )}
        />
      )}

      <Modal
        title="模板详情"
        open={!!selectedTemplateId}
        onCancel={() => setSelectedTemplateId(null)}
        footer={null}
        width={640}
        loading={detailLoading}
      >
        {templateDetail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="模板名称">
              {(templateDetail as Record<string, unknown>)?.name as string}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {(templateDetail as Record<string, unknown>)?.description as string || '无'}
            </Descriptions.Item>
            <Descriptions.Item label="适用范围">
              {(templateDetail as Record<string, unknown>)?.scope as string || '通用'}
            </Descriptions.Item>
            <Descriptions.Item label="字段数量">
              {Object.keys(
                ((templateDetail as Record<string, unknown>)?.formFields as Record<string, unknown>) || {}
              ).length}
            </Descriptions.Item>
            <Descriptions.Item label="审批节点">
              {((templateDetail as Record<string, unknown>)?.nodes as Array<Record<string, unknown>>)?.length ? (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(
                    (templateDetail as Record<string, unknown>)?.nodes as Array<Record<string, unknown>>
                  )?.map((node, idx) => (
                    <li key={idx}>
                      {node.name as string} ({node.approverType as string})
                    </li>
                  ))}
                </ul>
              ) : (
                '无'
              )}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <TemplateBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        teamId={teamId}
      />
    </div>
  );
};

export default ApprovalTemplatePage;
