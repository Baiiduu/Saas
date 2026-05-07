import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Tooltip,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { Priority, TaskStatus } from '@saas/shared-types';
import type { ITask } from '@saas/shared-types';
import { useTasks, useDeleteTask, useUpdateTask } from '@/hooks/useTasks';
import { useTeamMembers } from '@/hooks/useTenant';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import TaskFilter from '@/components/task/TaskFilter';
import TaskForm from '@/components/task/TaskForm';
import TaskAssignPopover from '@/components/task/TaskAssignPopover';
import MemberAvatar from '@/components/member/MemberAvatar';
import BatchActionBar from '@/components/task/BatchActionBar';
import type { TaskFilterValues } from '@/components/task/TaskFilter';

const { Title } = Typography;

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

const TaskListPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const [filterValues, setFilterValues] = useState<TaskFilterValues>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<ITask | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend');

  const { data, isLoading, isError, error } = useTasks({
    status: filterValues.status,
    priority: filterValues.priority,
    assigneeId: filterValues.assigneeId,
    search: filterValues.search,
    dueDateFrom: filterValues.dueDateStart,
    dueDateTo: filterValues.dueDateEnd,
    sortBy: sortField,
    sortOrder: sortOrder === 'ascend' ? 'asc' : 'desc',
    teamId,
    page: pagination.page,
    limit: pagination.pageSize,
  });

  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers(teamId);

  const memberOptions = useMemo(() => {
    return teamMembers.map(m => ({
      label: m.displayName || m.userId,
      value: m.userId,
    }));
  }, [teamMembers]);

  const memberMap = useMemo(() => {
    const map = new Map<string, { displayName: string; avatarUrl?: string }>();
    teamMembers.forEach(m => map.set(m.userId, {
      displayName: m.displayName || m.userId,
      avatarUrl: m.avatarUrl,
    }));
    return map;
  }, [teamMembers]);

  const deleteMutation = useDeleteTask();
  const updateMutation = useUpdateTask();

  const tasks = data?.items ?? [];
  const total = data?.meta?.total ?? 0;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        message.success('任务已删除');
      } catch {
        message.error('删除失败，请重试');
      }
    },
    [deleteMutation]
  );

  const handleEdit = useCallback((task: ITask) => {
    setEditTask(task);
    setFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditTask(null);
    setFormOpen(true);
  }, []);

  // Batch action handlers
  const handleBatchStatusChange = useCallback(
    async (ids: string[], status: TaskStatus) => {
      await Promise.all(
        ids.map((id) =>
          updateMutation.mutateAsync({ id, data: { status } })
        )
      );
      setSelectedRowKeys([]);
    },
    [updateMutation]
  );

  const handleBatchAssign = useCallback(
    async (ids: string[], assigneeId: string) => {
      await Promise.all(
        ids.map((id) =>
          updateMutation.mutateAsync({ id, data: { assigneeId } })
        )
      );
      setSelectedRowKeys([]);
    },
    [updateMutation]
  );

  const handleBatchDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      setSelectedRowKeys([]);
    },
    [deleteMutation]
  );

  const handleTableChange = useCallback(
    (
      pag: TablePaginationConfig,
      _filters: Record<string, unknown>,
      sorter: SorterResult<ITask> | SorterResult<ITask>[]
    ) => {
      setPagination({
        page: pag.current || 1,
        pageSize: pag.pageSize || 20,
      });
      if (!Array.isArray(sorter) && sorter.field) {
        setSortField(sorter.field as string);
        setSortOrder(sorter.order || 'descend');
      }
    },
    []
  );

  const columns: ColumnsType<ITask> = useMemo(
    () => [
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        sorter: true,
        render: (title: string, record: ITask) => (
          <Space>
            <Tag>{statusLabelMap[record.status]}</Tag>
            <a onClick={() => navigate(teamSubPath(orgId!, teamId!, `tasks/${record.id}`))}>
              {title}
            </a>
          </Space>
        ),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 90,
        sorter: true,
        render: (priority: Priority) => (
          <Tag color={priorityColorMap[priority]}>{priorityLabelMap[priority]}</Tag>
        ),
      },
      {
        title: '负责人',
        dataIndex: 'assigneeId',
        key: 'assigneeId',
        width: 120,
        sorter: true,
        render: (assigneeId: string | undefined, record: ITask) => {
          const member = assigneeId ? memberMap.get(assigneeId) : null;
          return (
            <TaskAssignPopover
              taskId={record.id}
              currentAssigneeId={assigneeId}
              memberOptions={memberOptions}
              loading={membersLoading}
            >
              {member ? (
                <Tooltip title={member.displayName}>
                  <MemberAvatar user={{ displayName: member.displayName, avatarUrl: member.avatarUrl }} size={24} />
                </Tooltip>
              ) : (
                <Tag style={{ cursor: 'pointer' }}>未分配</Tag>
              )}
            </TaskAssignPopover>
          );
        },
      },
      {
        title: '截止日期',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 120,
        sorter: true,
        render: (dueDate: string | undefined) => {
          if (!dueDate) return '-';
          const isOverdue = new Date(dueDate) < new Date();
          return (
            <Space size={4}>
              <CalendarOutlined />
              <span style={{ color: isOverdue ? 'red' : undefined }}>
                {new Date(dueDate).toLocaleDateString('zh-CN')}
              </span>
            </Space>
          );
        },
      },
      {
        title: '标签',
        dataIndex: 'tags',
        key: 'tags',
        width: 160,
        ellipsis: true,
        render: (tags: string[]) => (
          <Space size={4} wrap>
            {tags?.length > 0
              ? tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)
              : '-'}
          </Space>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 120,
        sorter: true,
        render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_: unknown, record: ITask) => (
          <Space size={4}>
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() =>
                  navigate(teamSubPath(orgId!, teamId!, `tasks/${record.id}`))
                }
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除此任务？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [navigate, orgId, teamId, handleEdit, handleDelete, memberMap, memberOptions, membersLoading]
  );

  if (!orgId || !teamId) return null;

  if (isLoading) return <Loading tip="加载任务列表..." />;

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取任务列表失败'}
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
          任务管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建任务
        </Button>
      </div>

      <TaskFilter values={filterValues} onChange={setFilterValues} memberOptions={memberOptions} memberLoading={membersLoading} />

      <BatchActionBar
        selectedIds={selectedRowKeys as string[]}
        totalCount={total}
        onBatchStatusChange={handleBatchStatusChange}
        onBatchAssign={handleBatchAssign}
        onBatchDelete={handleBatchDelete}
        memberOptions={memberOptions}
        memberLoading={membersLoading}
      />

      <Table<ITask>
        rowKey="id"
        columns={columns}
        dataSource={tasks}
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        scroll={{ x: 900 }}
        size="middle"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      <TaskForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTask(null);
        }}
        teamId={teamId}
        editTask={editTask}
      />
    </div>
  );
};

export default TaskListPage;
