import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Spin,
  Empty,
  Progress,
} from 'antd';
import {
  UnorderedListOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import * as dashboardService from '@/services/dashboardService';

const { Title } = Typography;

/**
 * UserStatsPage - Personal task statistics dashboard.
 *
 * Displays:
 * - Total tasks count
 * - Completion rate (percentage with progress ring)
 * - Pending task count
 * - Overdue task count
 *
 * Optional simple chart area reserved for future enhancement.
 */
const UserStatsPage: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => dashboardService.getUserStats(),
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载统计数据..." />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <Empty
        description={error instanceof Error ? error.message : '加载统计数据失败'}
      />
    );
  }

  const completionPercent = Math.round(stats.completionRate);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        个人统计
      </Title>

      {/* Stat cards row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<UnorderedListOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="完成率"
              value={completionPercent}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress
              percent={completionPercent}
              size="small"
              style={{ marginTop: 8 }}
              strokeColor="#52c41a"
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="待处理"
              value={stats.pendingCount}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="已逾期"
              value={stats.overdueCount}
              prefix={
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              }
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Reserved area for future chart integration */}
      <Card
        title="任务趋势"
        style={{ marginTop: 24 }}
      >
        <div
          style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          图表区域（将在后续版本中集成）
        </div>
      </Card>
    </div>
  );
};

export default UserStatsPage;
