import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Tooltip } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { TaskStatus } from '@saas/shared-types';
import { useTasks } from '@/hooks/useTasks';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title, Text } = Typography;

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '#d9d9d9',
  [TaskStatus.IN_PROGRESS]: '#1890ff',
  [TaskStatus.DONE]: '#52c41a',
  [TaskStatus.CLOSED]: '#faad14',
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '待办',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.DONE]: '已完成',
  [TaskStatus.CLOSED]: '已关闭',
};

interface GanttBar {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: TaskStatus;
  progress: number;
}

function calculateProgress(status: TaskStatus): number {
  switch (status) {
    case TaskStatus.TODO:
      return 0;
    case TaskStatus.IN_PROGRESS:
      return 50;
    case TaskStatus.DONE:
      return 100;
    case TaskStatus.CLOSED:
      return 100;
    default:
      return 0;
  }
}

const GanttPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useTasks({
    teamId,
    limit: 100,
  });

  const bars = useMemo(() => {
    if (!data?.items) return [];
    const items = data.items.filter(
      (t) => t.dueDate && t.createdAt
    );
    return items.map((t) => ({
      id: t.id,
      title: t.title,
      start: new Date(t.createdAt),
      end: new Date(t.dueDate!),
      status: t.status,
      progress: calculateProgress(t.status),
    })) as GanttBar[];
  }, [data]);

  const timelineStart = useMemo(() => {
    if (bars.length === 0) return new Date();
    const earliest = new Date(Math.min(...bars.map((b) => b.start.getTime())));
    earliest.setDate(earliest.getDate() - 1);
    return earliest;
  }, [bars]);

  const timelineEnd = useMemo(() => {
    if (bars.length === 0) return new Date();
    const latest = new Date(Math.max(...bars.map((b) => b.end.getTime())));
    latest.setDate(latest.getDate() + 1);
    return latest;
  }, [bars]);

  const totalDays = useMemo(() => {
    const diff = timelineEnd.getTime() - timelineStart.getTime();
    return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 1);
  }, [timelineStart, timelineEnd]);

  const dayWidth = 30;
  const rowHeight = 36;
  const labelWidth = 220;

  const getBarStyle = (bar: GanttBar) => {
    const startOffset =
      (bar.start.getTime() - timelineStart.getTime()) /
      (1000 * 60 * 60 * 24);
    const duration =
      (bar.end.getTime() - bar.start.getTime()) / (1000 * 60 * 60 * 24);
    const left = startOffset * dayWidth;
    const width = Math.max(duration * dayWidth, 20);
    return {
      left,
      width,
    };
  };

  const handleBack = () => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'board'));
    }
  };

  if (!orgId || !teamId) return null;
  if (isLoading) return <Loading tip="加载甘特图..." />;
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
            甘特图
          </Title>
        </Space>
      </div>

      {bars.length === 0 ? (
        <EmptyState title="暂无数据" description="没有带有截止日期的任务" />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
          <div style={{ display: 'flex', minWidth: labelWidth + totalDays * dayWidth }}>
            {/* Left label column */}
            <div style={{ width: labelWidth, flexShrink: 0, borderRight: '1px solid #f0f0f0' }}>
              <div
                style={{
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: 600,
                  background: '#fafafa',
                }}
              >
                任务
              </div>
              {bars.map((bar) => (
                <div
                  key={bar.id}
                  style={{
                    height: rowHeight,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderBottom: '1px solid #f5f5f5',
                    overflow: 'hidden',
                  }}
                >
                  <Tooltip title={`${bar.title} (${statusLabelMap[bar.status]})`}>
                    <Text ellipsis style={{ fontSize: 12, width: '100%' }}>
                      {bar.title}
                    </Text>
                  </Tooltip>
                </div>
              ))}
            </div>

            {/* Timeline area */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              {/* Day headers */}
              <div
                style={{
                  display: 'flex',
                  height: 40,
                  borderBottom: '1px solid #f0f0f0',
                  background: '#fafafa',
                }}
              >
                {Array.from({ length: totalDays }, (_, i) => {
                  const date = new Date(timelineStart);
                  date.setDate(date.getDate() + i);
                  return (
                    <div
                      key={i}
                      style={{
                        width: dayWidth,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: '#666',
                        borderRight: '1px solid #f5f5f5',
                      }}
                    >
                      {date.getDate()}/{date.getMonth() + 1}
                    </div>
                  );
                })}
              </div>

              {/* Bars */}
              <div style={{ position: 'relative' }}>
                {bars.map((bar, index) => {
                  const { left, width } = getBarStyle(bar);
                  return (
                    <div
                      key={bar.id}
                      style={{
                        position: 'relative',
                        height: rowHeight,
                        borderBottom: '1px solid #f5f5f5',
                      }}
                    >
                      <Tooltip
                        title={`${bar.title}: ${bar.start.toLocaleDateString('zh-CN')} - ${bar.end.toLocaleDateString('zh-CN')}`}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left,
                            width,
                            height: rowHeight - 8,
                            backgroundColor: statusColors[bar.status] || '#d9d9d9',
                            borderRadius: 4,
                            opacity: 0.8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 6,
                            overflow: 'hidden',
                          }}
                          onClick={() =>
                            navigate(
                              teamSubPath(orgId, teamId, `tasks/${bar.id}`)
                            )
                          }
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {bar.title}
                          </span>
                        </div>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttPage;
