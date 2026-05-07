import React, { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Row, Col, Button, Card, message } from 'antd';
import {
  UnorderedListOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useTeamStats, useUserStats } from '@/hooks/useDashboard';
import { useAuthStore } from '@/stores/authStore';
import { teamSubPath } from '@/router/routes';
import StatCard from '@/components/dashboard/StatCard';
import TeamChart from '@/components/dashboard/TeamChart';
import UserChart from '@/components/dashboard/UserChart';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title } = Typography;

const DashboardPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const { data: teamStats, isLoading: teamLoading, isError: teamError, error: teamErr } = useTeamStats(teamId);
  const { data: userStats, isLoading: userLoading, isError: userError, error: userErr } = useUserStats();

  const isLoading = teamLoading || userLoading;

  const stats = useMemo(() => {
    if (!teamStats) {
      return { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 };
    }
    const tbs = teamStats.tasksByStatus || {};
    const completed = (tbs['DONE'] || 0) + (tbs['CLOSED'] || 0);
    const inProgress = tbs['IN_PROGRESS'] || 0;
    const todo = tbs['TODO'] || 0;
    return {
      total: teamStats.totalTasks,
      completed,
      inProgress,
      todo,
      overdue: teamStats.overdueTasks,
    };
  }, [teamStats]);

  const completionRate = teamStats ? teamStats.completionRate : 0;

  const handleExportCSV = useCallback(() => {
    const rows = [
      ['指标', '数值'],
      ['总任务', stats.total.toString()],
      ['已完成', stats.completed.toString()],
      ['进行中', stats.inProgress.toString()],
      ['已逾期', stats.overdue.toString()],
      ['完成率', `${completionRate}%`],
    ];

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('仪表盘数据已导出为 CSV');
  }, [stats, completionRate]);

  if (!orgId || !teamId) return null;
  if (isLoading) return <Loading tip="加载仪表盘..." />;
  if (teamError) {
    return (
      <EmptyState
        title="加载失败"
        description={(teamErr as Error)?.message || '获取仪表盘数据失败'}
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
        <Title level={4} style={{ margin: 0 }}>
          仪表盘
        </Title>
        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
          导出 CSV
        </Button>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="总任务"
            value={stats.total}
            icon={<UnorderedListOutlined />}
            color="#1890ff"
            onClick={() => navigate(teamSubPath(orgId, teamId, 'tasks'))}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="已完成"
            value={stats.completed}
            icon={<CheckCircleOutlined />}
            color="#52c41a"
            trend={stats.total > 0 ? 'up' : 'neutral'}
            trendValue={`完成率 ${completionRate}%`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="进行中"
            value={stats.inProgress}
            icon={<ClockCircleOutlined />}
            color="#faad14"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="已逾期"
            value={stats.overdue}
            icon={<ExclamationCircleOutlined />}
            color="#ff4d4f"
            trend={stats.overdue > 0 ? 'down' : 'neutral'}
            trendValue={stats.overdue > 0 ? `${stats.overdue} 个任务逾期` : '无逾期'}
          />
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <TeamChart
            teamId={teamId}
            tasksByStatus={teamStats?.tasksByStatus}
            totalTasks={teamStats?.totalTasks}
            activeMembers={teamStats?.activeMembers}
            totalMilestones={teamStats?.totalMilestones}
          />
        </Col>
        <Col xs={24} lg={12}>
          {userError ? (
            <Card title="个人效率概览" style={{ borderRadius: 8 }}>
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#ff4d4f' }}>
                {(userErr as Error)?.message || '加载个人数据失败，请稍后重试'}
              </div>
            </Card>
          ) : (
            <UserChart
              userId={user?.id}
              userStats={userStats || undefined}
            />
          )}
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
