import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Row, Col, Modal, Form, Input, DatePicker, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { IMilestone } from '@saas/shared-types';
import { teamPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import MilestoneCard from '@/components/milestone/MilestoneCard';
import { getMilestones, createMilestone } from '@/services/milestoneService';

const { Title } = Typography;

const MilestonePage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [milestones, setMilestones] = useState<IMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch milestones from API on mount
  useEffect(() => {
    if (!teamId) return;
    const fetchMilestones = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getMilestones(teamId);
        setMilestones(data.items || []);
      } catch {
        setMilestones([]);
        setLoadError('获取里程碑失败');
      } finally {
        setLoading(false);
      }
    };
    fetchMilestones();
  }, [teamId]);

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamPath(orgId, teamId));
    }
  }, [orgId, teamId, navigate]);

  const handleCreateMilestone = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (!teamId) {
        message.error('缺少团队信息');
        return;
      }
      await createMilestone({
        name: values.name,
        description: values.description || '',
        dueDate: values.dueDate,
        teamId,
      });
      message.success('里程碑已创建');
      setModalOpen(false);
      form.resetFields();
      // Refresh the list
      try {
        const data = await getMilestones(teamId);
        setMilestones(data.items || []);
      } catch {
        // ignore refresh error
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('创建里程碑失败');
    }
  }, [form, teamId]);

  const handleMilestoneClick = useCallback((milestone: IMilestone) => {
    message.info(`里程碑: ${milestone.name} (进度: ${milestone.progress}%)`);
  }, []);

  const groupedMilestones = useMemo(() => {
    const active = milestones.filter((m) => m.status === 'active' || m.status === 'overdue');
    const completed = milestones.filter((m) => m.status === 'completed');
    return { active, completed };
  }, [milestones]);

  if (!orgId || !teamId) return null;

  if (loading) {
    return <Loading tip="加载里程碑..." />;
  }

  if (loadError) {
    return <EmptyState title="加载失败" description={loadError} />;
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
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            里程碑看板
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          创建里程碑
        </Button>
      </div>

      <Title level={5} style={{ marginBottom: 12 }}>
        进行中 ({groupedMilestones.active.length})
      </Title>
      {groupedMilestones.active.length === 0 ? (
        <EmptyState description="暂无进行中的里程碑" />
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {groupedMilestones.active.map((ms) => (
            <Col key={ms.id} xs={24} sm={12} lg={8}>
              <MilestoneCard
                milestone={ms}
                onClick={handleMilestoneClick}
              />
            </Col>
          ))}
        </Row>
      )}

      <Title level={5} style={{ marginBottom: 12 }}>
        已完成 ({groupedMilestones.completed.length})
      </Title>
      {groupedMilestones.completed.length === 0 ? (
        <EmptyState description="暂无已完成的里程碑" />
      ) : (
        <Row gutter={[16, 16]}>
          {groupedMilestones.completed.map((ms) => (
            <Col key={ms.id} xs={24} sm={12} lg={8}>
              <MilestoneCard
                milestone={ms}
                onClick={handleMilestoneClick}
              />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="创建里程碑"
        open={modalOpen}
        onOk={handleCreateMilestone}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="里程碑名称"
            rules={[{ required: true, message: '请输入里程碑名称' }]}
          >
            <Input placeholder="例如：V2.0 发布" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="里程碑描述..." />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="截止日期"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MilestonePage;
