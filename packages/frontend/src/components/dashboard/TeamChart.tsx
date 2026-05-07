import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

export interface TeamChartProps {
  teamId: string;
  tasksByStatus?: Record<string, number>;
  totalTasks?: number;
  activeMembers?: number;
  totalMilestones?: number;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  CLOSED: '已关闭',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: '#d9d9d9',
  IN_PROGRESS: '#1890ff',
  DONE: '#52c41a',
  CLOSED: '#faad14',
  CANCELLED: '#ff4d4f',
};

const TeamChart: React.FC<TeamChartProps> = ({
  teamId: _teamId,
  tasksByStatus,
  totalTasks,
  activeMembers,
  totalMilestones,
}) => {
  const statusEntries = tasksByStatus
    ? Object.entries(tasksByStatus)
        .filter(([, count]) => count > 0)
        .sort(([a], [b]) => {
          const order = ['TODO', 'IN_PROGRESS', 'DONE', 'CLOSED', 'CANCELLED'];
          return order.indexOf(a) - order.indexOf(b);
        })
    : [];

  return (
    <Card title="团队任务分布" style={{ borderRadius: 8 }}>
      {statusEntries.length > 0 ? (
        <>
          {statusEntries.map(([status, count]) => (
            <div key={status} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                <span>{STATUS_LABELS[status] || status}</span>
                <span>
                  {count} ({(totalTasks && totalTasks > 0) ? Math.round((count / totalTasks) * 100) : 0}%)
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: '#f0f0f0',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(totalTasks && totalTasks > 0) ? (count / totalTasks) * 100 : 0}%`,
                    height: '100%',
                    background: STATUS_COLORS[status] || '#1890ff',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#888' }}>
            <Text type="secondary">活跃成员: {activeMembers ?? '-'} 人</Text>
            <br />
            <Text type="secondary">里程碑: {totalMilestones ?? '-'} 个</Text>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          暂无任务数据
        </div>
      )}
    </Card>
  );
};

export default TeamChart;
