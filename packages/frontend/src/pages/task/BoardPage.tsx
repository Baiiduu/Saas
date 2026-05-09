import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, message, Space, Tooltip } from 'antd';
import { PlusOutlined, SettingOutlined, BarChartOutlined, CalendarOutlined } from '@ant-design/icons';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TaskStatus } from '@saas/shared-types';
import type { ITask } from '@saas/shared-types';
import { useBoard, useUpdateTaskPosition } from '@/hooks/useTasks';
import { teamSubPath } from '@/router/routes';
import KanbanColumn from '@/components/task/KanbanColumn';
import TaskCard from '@/components/task/TaskCard';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import BoardColumnConfig, { type ColumnConfig } from '@/components/task/BoardColumnConfig';

const { Title } = Typography;

const STATUS_ORDER: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
  TaskStatus.CLOSED,
];

const COLUMN_CONFIG: Record<
  TaskStatus,
  { title: string; color: string }
> = {
  [TaskStatus.TODO]: { title: '待办', color: '#d9d9d9' },
  [TaskStatus.IN_PROGRESS]: { title: '进行中', color: '#1890ff' },
  [TaskStatus.DONE]: { title: '已完成', color: '#52c41a' },
  [TaskStatus.CLOSED]: { title: '已关闭', color: '#faad14' },
};

const BoardPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useBoard(teamId);
  const updatePositionMutation = useUpdateTaskPosition();

  const [activeTask, setActiveTask] = React.useState<ITask | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([
    { status: TaskStatus.TODO, title: '待办', color: '#d9d9d9', visible: true },
    { status: TaskStatus.IN_PROGRESS, title: '进行中', color: '#1890ff', visible: true },
    { status: TaskStatus.DONE, title: '已完成', color: '#52c41a', visible: true },
    { status: TaskStatus.CLOSED, title: '已关闭', color: '#faad14', visible: true },
  ]);

  const tasks = (data?.items ?? []) as ITask[];

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, ITask[]> = {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.DONE]: [],
      [TaskStatus.CLOSED]: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    Object.values(grouped).forEach((columnTasks) => {
      columnTasks.sort((a, b) => {
        const sortDelta = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (sortDelta !== 0) {
          return sortDelta;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });

    return STATUS_ORDER
      .filter((status) => {
        const config = columnConfigs.find((c) => c.status === status);
        return config ? config.visible : true;
      })
      .map((status) => {
        const config = columnConfigs.find((c) => c.status === status);
        return {
          status,
          title: config?.title || COLUMN_CONFIG[status].title,
          color: config?.color || COLUMN_CONFIG[status].color,
          tasks: grouped[status],
          count: grouped[status].length,
        };
      });
  }, [tasks, columnConfigs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const draggedTask = tasks.find((t) => t.id === event.active.id);
      if (draggedTask) setActiveTask(draggedTask);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Dropping over a card yields that task id, while dropping over an empty
      // column yields the column status id. Resolve both forms to a target column.
      const targetStatus =
        STATUS_ORDER.find((status) => status === overId) ??
        tasks.find((task) => task.id === overId)?.status;
      if (!targetStatus) return;

      const draggedTask = tasks.find((t) => t.id === taskId);
      if (!draggedTask) return;

      const targetTasks = [...(columns.find((c) => c.status === targetStatus)?.tasks ?? [])];
      const sourceTasks = [...(columns.find((c) => c.status === draggedTask.status)?.tasks ?? [])];
      const isSameColumn = draggedTask.status === targetStatus;

      const sourceIndex = sourceTasks.findIndex((task) => task.id === taskId);
      let targetIndex =
        STATUS_ORDER.includes(overId as TaskStatus)
          ? targetTasks.length
          : targetTasks.findIndex((task) => task.id === overId);

      if (targetIndex < 0) {
        targetIndex = targetTasks.length;
      }

      if (isSameColumn) {
        if (sourceIndex < 0) return;
        if (overId === taskId) return;
        if (targetIndex > sourceIndex) {
          targetIndex -= 1;
        }
        if (targetIndex === sourceIndex) return;
      }

      try {
        await updatePositionMutation.mutateAsync({
          id: taskId,
          sortOrder: targetIndex,
          status: targetStatus,
        });
        message.success('任务状态已更新');
      } catch {
        message.error('更新失败');
      }
    },
    [tasks, columns, updatePositionMutation]
  );

  const handleTaskClick = useCallback(
    (task: ITask) => {
      if (orgId && teamId) {
        navigate(teamSubPath(orgId, teamId, `tasks/${task.id}`));
      }
    },
    [orgId, teamId, navigate]
  );

  if (!orgId || !teamId) return null;

  if (isLoading) return <Loading tip="加载看板..." />;

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取看板数据失败'}
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
            看板视图
          </Title>
          <Space>
            <Tooltip title="甘特图">
              <Button
                icon={<BarChartOutlined />}
                onClick={() => navigate(teamSubPath(orgId, teamId, 'gantt'))}
              />
            </Tooltip>
            <Tooltip title="日历视图">
              <Button
                icon={<CalendarOutlined />}
                onClick={() => navigate(teamSubPath(orgId, teamId, 'calendar'))}
              />
            </Tooltip>
            <Tooltip title="列配置">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setConfigOpen(true)}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(teamSubPath(orgId, teamId, 'tasks'))}
            >
              创建任务
            </Button>
          </Space>
        </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            paddingBottom: 16,
          }}
        >
          {columns.map((col) => (
            <KanbanColumn
              key={col.status}
              id={col.status}
              title={col.title}
              color={col.color}
              tasks={col.tasks}
              count={col.count}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} style={{ width: 280 }} sortable={false} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BoardColumnConfig
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        columns={columnConfigs}
        onSave={async (newConfigs) => {
          setColumnConfigs(newConfigs);
          message.success('看板配置已更新');
        }}
      />
    </div>
  );
};

export default BoardPage;
