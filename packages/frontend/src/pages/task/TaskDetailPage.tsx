import React, { useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Descriptions,
  Tag,
  Button,
  Space,
  Tabs,
  Card,
  Avatar,
  message,
  Select,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  CalendarOutlined,
  BranchesOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { Priority, TaskStatus } from '@saas/shared-types';
import type { ITask } from '@saas/shared-types';
import { useTask, useUpdateTask, useTasks, useCreateTask, useDeleteTask } from '@/hooks/useTasks';
import { useTeamMembers } from '@/hooks/useTenant';
import MemberAvatar from '@/components/member/MemberAvatar';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import CommentList from '@/components/comment/CommentList';
import CommentInput from '@/components/comment/CommentInput';
import SubTaskList from '@/components/task/SubTaskList';
import TaskAssignPopover from '@/components/task/TaskAssignPopover';
import TaskRelationPicker from '@/components/task/TaskRelationPicker';

const { Title, Text, Paragraph } = Typography;

const priorityColorMap: Record<Priority, string> = {
  [Priority.LOW]: 'default',
  [Priority.MEDIUM]: 'blue',
  [Priority.HIGH]: 'orange',
  [Priority.URGENT]: 'red',
};

const priorityLabelMap: Record<Priority, string> = {
  [Priority.LOW]: '低',
  [Priority.MEDIUM]: '中',
  [Priority.HIGH]: '高',
  [Priority.URGENT]: '紧急',
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '待办',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.DONE]: '已完成',
  [TaskStatus.CLOSED]: '已关闭',
};

const statusOptions = [
  { label: '待办', value: TaskStatus.TODO },
  { label: '进行中', value: TaskStatus.IN_PROGRESS },
  { label: '已完成', value: TaskStatus.DONE },
  { label: '已关闭', value: TaskStatus.CLOSED },
];

const TaskDetailPage: React.FC = () => {
  const { orgId, teamId, taskId } = useParams<{
    orgId: string;
    teamId: string;
    taskId: string;
  }>();
  const navigate = useNavigate();

  const { data: task, isLoading, isError, error } = useTask(taskId);
  const updateMutation = useUpdateTask();
  const createTaskMutation = useCreateTask();
  const deleteTaskMutation = useDeleteTask();

  // Subtask state
  const { data: allTasksData } = useTasks({ teamId, limit: 100 });
  const subTasks = (allTasksData?.items ?? []).filter(
    (t) => t.parentTaskId === taskId
  );
  const availableForRelation = (allTasksData?.items ?? []).filter(
    (t) => t.id !== taskId
  );

  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers(teamId);

  const memberMap = useMemo(() => {
    const map = new Map<string, { displayName: string; avatarUrl?: string }>();
    teamMembers.forEach(m => map.set(m.userId, {
      displayName: m.displayName || m.userId,
      avatarUrl: m.avatarUrl,
    }));
    return map;
  }, [teamMembers]);

  const memberOptions = useMemo(() => {
    return teamMembers.map(m => ({
      label: m.displayName || m.userId,
      value: m.userId,
    }));
  }, [teamMembers]);

  const [relationPickerOpen, setRelationPickerOpen] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState<ITask[]>([]);

  const handleAddSubTask = useCallback(
    async (title: string) => {
      if (!teamId || !taskId) return;
      await createTaskMutation.mutateAsync({
        title,
        teamId,
      });
      // Note: In a real API, parentTaskId would be sent to create the subtask relation
    },
    [teamId, taskId, createTaskMutation]
  );

  const handleToggleSubTask = useCallback(
    async (id: string, done: boolean) => {
      await updateMutation.mutateAsync({
        id,
        data: { status: done ? TaskStatus.DONE : TaskStatus.TODO },
      });
    },
    [updateMutation]
  );

  const handleDeleteSubTask = useCallback(
    async (id: string) => {
      await deleteTaskMutation.mutateAsync(id);
    },
    [deleteTaskMutation]
  );

  const handleAddRelation = useCallback(
    async (_relatedTaskId: string, _relationType: string) => {
      // In a real implementation, this would call an API to create the relation
      message.success('关联已添加 (模拟)');
    },
    []
  );

  const handleRemoveRelation = useCallback(
    async (_relatedTaskId: string) => {
      // In a real implementation, this would call an API to remove the relation
      message.success('关联已移除 (模拟)');
    },
    []
  );

  const handleStatusChange = useCallback(
    async (status: TaskStatus) => {
      if (!taskId) return;
      try {
        await updateMutation.mutateAsync({ id: taskId, data: { status } });
        message.success('状态更新成功');
      } catch {
        message.error('状态更新失败');
      }
    },
    [taskId, updateMutation]
  );

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'tasks'));
    }
  }, [orgId, teamId, navigate]);

  if (!taskId || !orgId || !teamId) return null;

  if (isLoading) return <Loading tip="加载任务详情..." />;

  if (isError || !task) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取任务详情失败'}
      />
    );
  }

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== TaskStatus.DONE &&
    task.status !== TaskStatus.CLOSED;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回任务列表
        </Button>
      </Space>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {task.title}
            </Title>
            <Space style={{ marginTop: 8 }}>
              <Tag>{statusLabelMap[task.status]}</Tag>
              <Tag color={priorityColorMap[task.priority]}>
                {priorityLabelMap[task.priority]}
              </Tag>
            </Space>
          </div>

          <Space>
            <Select
              value={task.status}
              onChange={handleStatusChange}
              style={{ width: 120 }}
              options={statusOptions}
            />
          </Space>
        </div>

        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="负责人">
            {(() => {
              if (!task.assigneeId) {
                return (
                  <TaskAssignPopover
                    taskId={taskId}
                    currentAssigneeId={undefined}
                    memberOptions={memberOptions}
                    loading={membersLoading}
                  >
                    <Tag style={{ cursor: 'pointer' }}>未分配</Tag>
                  </TaskAssignPopover>
                );
              }
              const assigneeInfo = memberMap.get(task.assigneeId);
              if (assigneeInfo) {
                return (
                  <TaskAssignPopover
                    taskId={taskId}
                    currentAssigneeId={task.assigneeId}
                    memberOptions={memberOptions}
                    loading={membersLoading}
                  >
                    <Space style={{ cursor: 'pointer' }}>
                      <MemberAvatar
                        user={{ displayName: assigneeInfo.displayName, avatarUrl: assigneeInfo.avatarUrl }}
                        size={24}
                      />
                      <Text>{assigneeInfo.displayName}</Text>
                    </Space>
                  </TaskAssignPopover>
                );
              }
              return (
                <TaskAssignPopover
                  taskId={taskId}
                  currentAssigneeId={task.assigneeId}
                  memberOptions={memberOptions}
                  loading={membersLoading}
                >
                  <Space style={{ cursor: 'pointer' }}>
                    <Avatar size={24} icon={<UserOutlined />} />
                    <Text>{task.assigneeId}</Text>
                  </Space>
                </TaskAssignPopover>
              );
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="创建者">
            <Space>
              <Avatar size={24} icon={<UserOutlined />} />
              <Text>{task.creatorId}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="截止日期">
            {task.dueDate ? (
              <Space>
                <CalendarOutlined />
                <Text type={isOverdue ? 'danger' : undefined}>
                  {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                  {isOverdue && ' (已逾期)'}
                </Text>
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(task.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="标签" span={2}>
            {task.tags?.length > 0
              ? task.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        {task.description && (
          <>
            <Divider />
            <Title level={5}>描述</Title>
            <Paragraph>{task.description}</Paragraph>
          </>
        )}
      </Card>

      <Tabs
        defaultActiveKey="comments"
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'comments',
            label: '评论',
            children: (
              <Card>
                <CommentInput
                  resourceType="task"
                  resourceId={taskId}
                  placeholder="输入评论..."
                />
                <Divider />
                <CommentList resourceType="task" resourceId={taskId} />
              </Card>
            ),
          },
          {
            key: 'subtasks',
            label: (
              <Space>
                <CheckSquareOutlined />
                子任务
              </Space>
            ),
            children: (
              <Card>
                <SubTaskList
                  parentTaskId={taskId}
                  subTasks={subTasks}
                  onAdd={handleAddSubTask}
                  onToggle={handleToggleSubTask}
                  onDelete={handleDeleteSubTask}
                />
              </Card>
            ),
          },
          {
            key: 'relations',
            label: (
              <Space>
                <BranchesOutlined />
                关联
              </Space>
            ),
            children: (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <span>关联任务</span>
                  <Button
                    size="small"
                    onClick={() => setRelationPickerOpen(true)}
                  >
                    管理关联
                  </Button>
                </div>
                {relatedTasks.length === 0 ? (
                  <EmptyState
                    title="暂无关联"
                    description="与其他任务建立关联关系"
                  />
                ) : (
                  relatedTasks.map((rt) => (
                    <div key={rt.id}>{rt.title}</div>
                  ))
                )}
              </Card>
            ),
          },
          {
            key: 'attachments',
            label: '附件',
            children: (
              <Card>
                <EmptyState title="暂无附件" description="该任务暂无附件" />
              </Card>
            ),
          },
        ]}
      />

      <TaskRelationPicker
        open={relationPickerOpen}
        onClose={() => setRelationPickerOpen(false)}
        taskId={taskId}
        relatedTasks={relatedTasks}
        onAddRelation={handleAddRelation}
        onRemoveRelation={handleRemoveRelation}
        availableTasks={availableForRelation}
      />
    </div>
  );
};

export default TaskDetailPage;
