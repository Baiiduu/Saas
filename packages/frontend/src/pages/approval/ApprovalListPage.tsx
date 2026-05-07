import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Tabs,
  Input,
  DatePicker,
  message,
} from 'antd';
import { PlusOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ApprovalStatus } from '@saas/shared-types';
import type { IApproval } from '@saas/shared-types';
import { useApprovals } from '@/hooks/useApprovals';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import ApprovalForm from '@/components/approval/ApprovalForm';

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

const statusLabelMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: '待审批',
  [ApprovalStatus.APPROVED]: '已通过',
  [ApprovalStatus.REJECTED]: '已驳回',
  [ApprovalStatus.CANCELED]: '已取消',
};

const statusColorMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'processing',
  [ApprovalStatus.APPROVED]: 'success',
  [ApprovalStatus.REJECTED]: 'error',
  [ApprovalStatus.CANCELED]: 'default',
};

const TAB_ALL = 'all';
const statusTabs = [
  { key: TAB_ALL, label: '全部' },
  { key: ApprovalStatus.PENDING, label: '待审批' },
  { key: ApprovalStatus.APPROVED, label: '已通过' },
  { key: ApprovalStatus.REJECTED, label: '已驳回' },
  { key: ApprovalStatus.CANCELED, label: '已取消' },
];

const ApprovalListPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [formOpen, setFormOpen] = useState(false);

  const statusFilter =
    activeTab === TAB_ALL ? undefined : (activeTab as ApprovalStatus);

  const { data, isLoading, isError, error } = useApprovals({
    status: statusFilter,
    page: pagination.page,
    limit: pagination.limit,
  });

  const approvals = data?.items ?? [];
  const total = data?.meta?.total ?? 0;

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const filteredApprovals = useMemo(() => {
    if (!searchText) return approvals;
    const lower = searchText.toLowerCase();
    return approvals.filter(
      (a) =>
        a.title.toLowerCase().includes(lower) ||
        a.creatorId?.toLowerCase().includes(lower)
    );
  }, [approvals, searchText]);

  const columns: ColumnsType<IApproval> = useMemo(
    () => [
      {
        title: '审批标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        render: (title: string, record: IApproval) => (
          <a
            onClick={() =>
              navigate(
                teamSubPath(orgId!, teamId!, `approvals/${record.id}`)
              )
            }
          >
            {title}
          </a>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: ApprovalStatus) => (
          <Tag color={statusColorMap[status]}>
            {statusLabelMap[status]}
          </Tag>
        ),
      },
      {
        title: '创建人',
        dataIndex: 'creatorId',
        key: 'creatorId',
        width: 120,
        ellipsis: true,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        render: (date: string) =>
          date ? new Date(date).toLocaleString('zh-CN') : '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_: unknown, record: IApproval) => (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() =>
              navigate(
                teamSubPath(orgId!, teamId!, `approvals/${record.id}`)
              )
            }
          >
            查看
          </Button>
        ),
      },
    ],
    [navigate, orgId, teamId]
  );

  if (!orgId || !teamId) return null;

  if (isLoading) return <Loading tip="加载审批列表..." />;

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取审批列表失败'}
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
          审批管理
        </Title>
        <Space>
          <Button
            icon={<FileTextOutlined />}
            onClick={() =>
              navigate(teamSubPath(orgId!, teamId!, 'approvals/templates'))
            }
          >
            模板管理
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFormOpen(true)}
          >
            发起审批
          </Button>
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
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={statusTabs}
          style={{ marginBottom: 0 }}
        />
        <Search
          placeholder="搜索标题或创建人..."
          allowClear
          style={{ width: 280 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <Table<IApproval>
        rowKey="id"
        columns={columns}
        dataSource={filteredApprovals}
        loading={isLoading}
        onChange={(pag) =>
          setPagination({
            page: pag.current || 1,
            limit: pag.pageSize || 20,
          })
        }
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        size="middle"
      />

      <ApprovalForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teamId={teamId}
      />
    </div>
  );
};

export default ApprovalListPage;
