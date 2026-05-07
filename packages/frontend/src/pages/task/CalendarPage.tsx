import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Tag, Badge, Calendar } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { TaskStatus } from '@saas/shared-types';
import { useTasks } from '@/hooks/useTasks';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title, Text } = Typography;

const statusColorMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'default',
  [TaskStatus.IN_PROGRESS]: 'processing',
  [TaskStatus.DONE]: 'success',
  [TaskStatus.CLOSED]: 'warning',
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '待办',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.DONE]: '已完成',
  [TaskStatus.CLOSED]: '已关闭',
};

const CalendarPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useTasks({
    teamId,
    limit: 200,
  });

  const tasks = data?.items ?? [];

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = task.dueDate.split('T')[0];
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const dateCellRender = useCallback(
    (date: Dayjs) => {
      const key = date.format('YYYY-MM-DD');
      const dayTasks = tasksByDate.get(key);
      if (!dayTasks || dayTasks.length === 0) return null;

      return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {dayTasks.slice(0, 3).map((task) => (
            <li
              key={task.id}
              style={{
                fontSize: 11,
                padding: '1px 4px',
                cursor: 'pointer',
                borderRadius: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={() =>
                navigate(teamSubPath(orgId!, teamId!, `tasks/${task.id}`))
              }
            >
              <Badge
                status={statusColorMap[task.status] as 'default' | 'processing' | 'success' | 'warning'}
                text={task.title}
              />
            </li>
          ))}
          {dayTasks.length > 3 && (
            <li style={{ fontSize: 11, color: '#999', paddingLeft: 4 }}>
              +{dayTasks.length - 3} 更多
            </li>
          )}
        </ul>
      );
    },
    [tasksByDate, navigate, orgId, teamId]
  );

  const handleBack = () => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'board'));
    }
  };

  if (!orgId || !teamId) return null;
  if (isLoading) return <Loading tip="加载日历..." />;
  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取任务数据失败'}
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
            返回看板
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            日历视图
          </Title>
        </Space>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Calendar
          cellRender={(date) => dateCellRender(date as Dayjs)}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
