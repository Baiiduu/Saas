import React, { useState } from 'react';
import { Avatar, Popover, List, Button, Typography, Input, Space, Spin, message } from 'antd';
import { UserOutlined, CheckOutlined } from '@ant-design/icons';
import { useAssignTask } from '@/hooks/useTasks';

const { Search } = Input;
const { Text } = Typography;

export interface TaskAssignPopoverProps {
  taskId: string;
  currentAssigneeId?: string;
  memberOptions: { label: string; value: string }[];
  loading?: boolean;
  teamId?: string;
  children: React.ReactNode;
}

const TaskAssignPopover: React.FC<TaskAssignPopoverProps> = ({
  taskId,
  currentAssigneeId,
  memberOptions,
  loading = false,
  teamId,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const assignMutation = useAssignTask();

  const filteredOptions = memberOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleAssign = async (userId: string) => {
    try {
      await assignMutation.mutateAsync({ id: taskId, userIds: [userId] });
      message.success('分配成功');
      setOpen(false);
    } catch {
      message.error('分配失败，请重试');
    }
  };

  const handleUnassign = async () => {
    try {
      await assignMutation.mutateAsync({ id: taskId, userIds: [] });
      message.success('已取消分配');
      setOpen(false);
    } catch {
      message.error('操作失败，请重试');
    }
  };

  const content = (
    <div style={{ width: 240 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
          <div style={{ marginTop: 8, color: '#999' }}>加载团队成员...</div>
        </div>
      ) : memberOptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
          暂无团队成员，请先邀请成员加入团队
        </div>
      ) : (
        <>
          <Search
            placeholder="搜索成员..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <List
            size="small"
            dataSource={filteredOptions}
            renderItem={(item) => {
              const isSelected = item.value === currentAssigneeId;
              return (
                <List.Item
                  onClick={() => handleAssign(item.value)}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: isSelected ? '#e6f7ff' : undefined,
                  }}
                >
                  <Space>
                    <Avatar size={20} icon={<UserOutlined />} />
                    <Text>{item.label}</Text>
                  </Space>
                  {isSelected && <CheckOutlined style={{ color: '#1890ff' }} />}
                </List.Item>
              );
            }}
            locale={{ emptyText: '无匹配成员' }}
          />
          {currentAssigneeId && (
            <Button
              type="link"
              danger
              size="small"
              onClick={handleUnassign}
              style={{ marginTop: 4, padding: 0 }}
            >
              取消分配
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="分配任务"
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      {children}
    </Popover>
  );
};

export default TaskAssignPopover;
