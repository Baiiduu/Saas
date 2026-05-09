import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Segmented, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Gantt, ViewMode, type Task } from 'gantt-task-react';
import { TaskStatus } from '@saas/shared-types';
import { useTasks } from '@/hooks/useTasks';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import 'gantt-task-react/dist/index.css';
import './taskViews.css';

const { Title, Text } = Typography;

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '#b7c0cd',
  [TaskStatus.IN_PROGRESS]: '#2b6cf6',
  [TaskStatus.DONE]: '#1f9d55',
  [TaskStatus.CLOSED]: '#c9861a',
};

const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '待办',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.DONE]: '已完成',
  [TaskStatus.CLOSED]: '已关闭',
};

const progressMap: Record<TaskStatus, number> = {
  [TaskStatus.TODO]: 8,
  [TaskStatus.IN_PROGRESS]: 55,
  [TaskStatus.DONE]: 100,
  [TaskStatus.CLOSED]: 100,
};

const viewModeOptions = [
  { label: '天', value: ViewMode.Day },
  { label: '周', value: ViewMode.Week },
  { label: '月', value: ViewMode.Month },
  { label: '季', value: ViewMode.Year },
];

function normalizeRange(createdAt: string, dueDate: string) {
  const start = new Date(createdAt);
  const end = new Date(dueDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (start.getTime() >= end.getTime()) {
    const fallbackEnd = new Date(start);
    fallbackEnd.setDate(fallbackEnd.getDate() + 1);
    fallbackEnd.setHours(23, 59, 59, 999);
    return { start, end: fallbackEnd };
  }

  return { start, end };
}

const GanttTooltip: React.FC<{
  task: Task;
  fontSize: string;
  fontFamily: string;
}> = ({ task, fontSize, fontFamily }) => {
  const status = task.type === 'task' ? (task.id.split('__')[1] as TaskStatus) : undefined;

  return (
    <div
      style={{
        background: '#0f172a',
        color: '#fff',
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.24)',
        fontFamily,
        fontSize,
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{task.name}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        {status ? <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> : null}
        <Text style={{ color: 'rgba(255,255,255,0.72)' }}>{task.progress}%</Text>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.72)' }}>
        {task.start.toLocaleDateString('zh-CN')} - {task.end.toLocaleDateString('zh-CN')}
      </div>
    </div>
  );
};

const GanttTaskListHeader: React.FC<{
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}> = ({ headerHeight, rowWidth, fontFamily, fontSize }) => {
  return (
    <div
      style={{
        height: headerHeight,
        width: rowWidth,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        borderBottom: '1px solid #e7ebf3',
        fontFamily,
        fontSize,
        fontWeight: 700,
        color: '#23314f',
        background: '#f7f9fc',
      }}
    >
      任务
    </div>
  );
};

const GanttTaskListTable: React.FC<{
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}> = ({
  rowHeight,
  rowWidth,
  fontFamily,
  fontSize,
  tasks,
  selectedTaskId,
  setSelectedTask,
}) => {
  return (
    <div className="task-gantt-list" style={{ width: rowWidth }}>
      {tasks.map((task) => {
        const status = task.id.split('__')[1] as TaskStatus;
        const isSelected = selectedTaskId === task.id;

        return (
          <button
            key={task.id}
            type="button"
            className={`task-gantt-list-row${isSelected ? ' is-selected' : ''}`}
            style={{
              height: rowHeight,
              width: rowWidth,
              fontFamily,
              fontSize,
            }}
            onClick={() => setSelectedTask(task.id)}
            title={task.name}
          >
            <span
              className="task-gantt-list-dot"
              style={{ backgroundColor: statusColors[status] }}
            />
            <span className="task-gantt-list-name">{task.name}</span>
          </button>
        );
      })}
    </div>
  );
};

const GanttPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);

  const { data, isLoading, isError, error } = useTasks({
    teamId,
    limit: 300,
    sortBy: 'dueDate',
    sortOrder: 'asc',
  });

  const ganttTasks = useMemo<Task[]>(() => {
    const items = data?.items ?? [];

    return items
      .filter((task) => task.createdAt && task.dueDate)
      .map((task, index) => {
        const { start, end } = normalizeRange(task.createdAt, task.dueDate!);
        const color = statusColors[task.status];

        return {
          id: `${task.id}__${task.status}`,
          type: 'task',
          name: task.title,
          start,
          end,
          progress: progressMap[task.status],
          displayOrder: index,
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: color,
            progressColor: 'rgba(255,255,255,0.48)',
            progressSelectedColor: 'rgba(255,255,255,0.68)',
          },
        } satisfies Task;
      });
  }, [data]);

  const taskCountText = useMemo(() => {
    if (!data?.items?.length) {
      return '暂无任务';
    }

    const withSchedule = ganttTasks.length;
    return `共 ${data.items.length} 个任务，其中 ${withSchedule} 个具备时间区间`;
  }, [data, ganttTasks.length]);

  const handleBack = () => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'board'));
    }
  };

  const handleSelect = (task: Task) => {
    if (!orgId || !teamId) {
      return;
    }

    const taskId = task.id.split('__')[0];
    navigate(teamSubPath(orgId, teamId, `tasks/${taskId}`));
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
    <div className="task-view-page">
      <div className="task-view-header">
        <Space size={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回看板
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              甘特图
            </Title>
            <Text type="secondary">{taskCountText}</Text>
          </div>
        </Space>
        <Segmented
          options={viewModeOptions}
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
        />
      </div>

      <Alert
        type="info"
        showIcon
        className="task-view-alert"
        message="甘特图以任务创建时间到截止时间构成时间区间。没有截止日期的任务不会出现在此视图。"
      />

      {ganttTasks.length === 0 ? (
        <EmptyState title="暂无可展示任务" description="请先为任务补充截止日期。" />
      ) : (
        <Card className="task-gantt-shell" bordered={false}>
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            locale="zh-CN"
            listCellWidth="220px"
            columnWidth={
              viewMode === ViewMode.Year
                ? 120
                : viewMode === ViewMode.Month
                  ? 96
                  : viewMode === ViewMode.Week
                    ? 72
                    : 56
            }
            rowHeight={52}
            barCornerRadius={10}
            todayColor="rgba(43, 108, 246, 0.08)"
            TooltipContent={GanttTooltip}
            TaskListHeader={GanttTaskListHeader}
            TaskListTable={GanttTaskListTable}
            onClick={handleSelect}
            onDoubleClick={handleSelect}
          />
        </Card>
      )}
    </div>
  );
};

export default GanttPage;
