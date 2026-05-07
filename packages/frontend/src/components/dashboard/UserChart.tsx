import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { DashboardUserStats } from '@/services/dashboardService';

export interface UserChartProps {
  userId?: string;
  userStats?: DashboardUserStats;
}

const UserChart: React.FC<UserChartProps> = ({ userId: _userId, userStats }) => {
  const stats = userStats ? [
    { key: 'total', label: '总任务', value: userStats.totalTasks, icon: <InboxOutlined />, color: '#1890ff' },
    { key: 'completed', label: '已完成', value: Math.round(userStats.totalTasks * userStats.completionRate / 100), icon: <CheckCircleOutlined />, color: '#52c41a' },
    { key: 'inProgress', label: '进行中', value: userStats.pendingCount, icon: <ClockCircleOutlined />, color: '#faad14' },
    { key: 'overdue', label: '已逾期', value: userStats.overdueCount, icon: <ExclamationCircleOutlined />, color: '#ff4d4f' },
  ] : [];

  return (
    <Card title="个人效率概览" style={{ borderRadius: 8 }}>
      {stats.length > 0 ? (
        <>
          <Row gutter={[16, 16]}>
            {stats.map((stat) => (
              <Col key={stat.key} span={12}>
                <div
                  style={{
                    textAlign: 'center',
                    padding: '12px 8px',
                    background: '#fafafa',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 24, color: stat.color, marginBottom: 4 }}>
                    {stat.icon}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{stat.label}</div>
                </div>
              </Col>
            ))}
          </Row>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Statistic
              title="完成率"
              value={userStats?.completionRate ?? 0}
              suffix="%"
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          {_userId ? '加载中...' : '暂无个人数据'}
        </div>
      )}
    </Card>
  );
};

export default UserChart;
