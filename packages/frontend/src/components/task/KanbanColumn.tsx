import React from 'react';
import { Typography, Badge } from 'antd';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import type { ITask } from '@saas/shared-types';

const { Text } = Typography;

export interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: ITask[];
  count: number;
  onTaskClick?: (task: ITask) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  color,
  tasks,
  count,
  onTaskClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        maxWidth: 360,
        backgroundColor: isOver ? '#f0f5ff' : '#fafafa',
        borderRadius: 8,
        padding: 12,
        border: `1px solid ${isOver ? '#1890ff' : '#f0f0f0'}`,
        transition: 'background-color 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 200px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: `2px solid ${color}`,
        }}
      >
        <Badge color={color} />
        <Text strong style={{ marginLeft: 8, fontSize: 14 }}>
          {title}
        </Text>
        <Badge
          count={count}
          style={{
            marginLeft: 8,
            backgroundColor: color,
            fontSize: 11,
          }}
          showZero
        />
      </div>

      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 100,
          padding: '4px 2px',
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 24,
              color: '#d9d9d9',
              fontSize: 13,
              border: '1px dashed #d9d9d9',
              borderRadius: 8,
            }}
          >
            拖拽任务到此
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
