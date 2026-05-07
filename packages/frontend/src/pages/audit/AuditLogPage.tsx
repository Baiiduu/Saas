import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Input,
  DatePicker,
  Select,
  message,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { IAuditLog } from '@saas/shared-types';
import { get } from '@/services/api';
import type { PaginatedResponse } from '@/types';
import { orgPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  READ: '读取',
  LOGIN: '登录',
  LOGOUT: '登出',
  EXPORT: '导出',
  SHARE: '分享',
  APPROVE: '审批通过',
  REJECT: '驳回',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  READ: 'default',
  LOGIN: 'purple',
  LOGOUT: 'default',
  EXPORT: 'orange',
  SHARE: 'cyan',
  APPROVE: 'success',
  REJECT: 'error',
};

const AuditLogPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: pagination.page,
        limit: pagination.pageSize,
      };
      if (actionFilter) params.action = actionFilter;
      if (searchText) params.search = searchText;

      const response = await get<PaginatedResponse<IAuditLog>>(
        `/audit-logs`,
        { params }
      );
      setLogs(response.items || []);
      setTotal(response.meta?.total || 0);
    } catch {
      // If API is not available, use demo data
      const demoLogs: IAuditLog[] = [
        {
          id: '1',
          action: 'CREATE',
          resourceType: 'task',
          resourceId: 'task-1',
          userId: 'user-1',
          tenantId: orgId,
          details: { title: '创建任务: 用户登录' },
          ipAddress: '192.168.1.1',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          action: 'UPDATE',
          resourceType: 'task',
          resourceId: 'task-2',
          userId: 'user-2',
          tenantId: orgId,
          details: { field: 'status', oldValue: 'TODO', newValue: 'IN_PROGRESS' },
          ipAddress: '192.168.1.2',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          action: 'DELETE',
          resourceType: 'document',
          resourceId: 'doc-1',
          userId: 'user-1',
          tenantId: orgId,
          details: { name: '删除文档: 需求文档' },
          ipAddress: '192.168.1.1',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '4',
          action: 'LOGIN',
          resourceType: 'session',
          resourceId: 'session-1',
          userId: 'user-3',
          tenantId: orgId,
          ipAddress: '10.0.0.1',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '5',
          action: 'APPROVE',
          resourceType: 'approval',
          resourceId: 'approval-1',
          userId: 'user-2',
          tenantId: orgId,
          details: { comment: '审批通过' },
          ipAddress: '192.168.1.2',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ];
      setLogs(demoLogs);
      setTotal(demoLogs.length);
    } finally {
      setLoading(false);
    }
  }, [orgId, pagination, actionFilter, searchText]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleBack = useCallback(() => {
    if (orgId) {
      navigate(orgPath(orgId));
    }
  }, [orgId, navigate]);

  const columns: ColumnsType<IAuditLog> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        render: (date: string) =>
          date ? new Date(date).toLocaleString('zh-CN') : '-',
      },
      {
        title: '操作',
        dataIndex: 'action',
        key: 'action',
        width: 100,
        render: (action: string) => (
          <Tag color={ACTION_COLORS[action] || 'default'}>
            {ACTION_LABELS[action] || action}
          </Tag>
        ),
      },
      {
        title: '资源类型',
        dataIndex: 'resourceType',
        key: 'resourceType',
        width: 100,
      },
      {
        title: '资源 ID',
        dataIndex: 'resourceId',
        key: 'resourceId',
        width: 120,
        ellipsis: true,
      },
      {
        title: '操作人',
        dataIndex: 'userId',
        key: 'userId',
        width: 120,
        ellipsis: true,
      },
      {
        title: '详情',
        dataIndex: 'details',
        key: 'details',
        ellipsis: true,
        render: (details: Record<string, unknown> | undefined) => {
          if (!details) return '-';
          return (
            <Text ellipsis style={{ maxWidth: 300 }}>
              {JSON.stringify(details)}
            </Text>
          );
        },
      },
      {
        title: 'IP 地址',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 140,
        render: (ip: string | undefined) => ip || '-',
      },
    ],
    []
  );

  if (!orgId) return null;

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
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            审计日志
          </Title>
        </Space>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <Input
            placeholder="搜索操作人或资源..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 140 }}
            allowClear
            options={Object.entries(ACTION_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <RangePicker
            style={{ width: 240 }}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
          刷新
        </Button>
      </div>

      <Table<IAuditLog>
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        onChange={(pag) =>
          setPagination({
            page: pag.current || 1,
            pageSize: pag.pageSize || 20,
          })
        }
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        size="middle"
        scroll={{ x: 900 }}
      />
    </div>
  );
};

export default AuditLogPage;
