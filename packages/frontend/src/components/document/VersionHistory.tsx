import React, { useState } from 'react';
import { Button, List, Typography, Space, Tag, message, Modal, Tooltip, Empty, Spin } from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,
  DiffOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export interface DocVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  summary?: string;
  fileSize?: number;
}

export interface VersionHistoryProps {
  /** List of document versions */
  versions: DocVersion[];
  /** Called when the user requests a rollback to a specific version */
  onRollback?: (versionId: string) => void;
  /** Called when the user wants to diff two versions */
  onDiff?: (versionIdA: string, versionIdB: string) => void;
  /** Whether the versions are still loading */
  loading?: boolean;
  /** Currently active version ID */
  activeVersionId?: string;
}

/**
 * VersionHistory - Document version history panel.
 * Displays a list of document versions with rollback and diff actions.
 */
const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  onRollback,
  onDiff,
  loading = false,
  activeVersionId,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [versionToRollback, setVersionToRollback] = useState<string | null>(null);

  const handleRollbackClick = (versionId: string) => {
    setVersionToRollback(versionId);
    setRollbackModalOpen(true);
  };

  const handleConfirmRollback = () => {
    if (versionToRollback && onRollback) {
      onRollback(versionToRollback);
      message.success('已回滚到指定版本');
    }
    setRollbackModalOpen(false);
    setVersionToRollback(null);
  };

  const handleDiff = (versionId: string) => {
    if (selectedVersion && selectedVersion !== versionId) {
      onDiff?.(selectedVersion, versionId);
      setSelectedVersion(null);
    } else {
      setSelectedVersion(versionId);
      message.info('请选择另一个版本进行对比');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin tip="加载版本历史..." />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无版本历史"
        />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <HistoryOutlined style={{ fontSize: 16, color: '#1677ff' }} />
        <Text strong>版本历史</Text>
      </div>

      <List
        size="small"
        dataSource={versions}
        renderItem={(version) => {
          const isActive = version.id === activeVersionId;
          const isSelected = version.id === selectedVersion;

          return (
            <List.Item
              style={{
                padding: '8px 12px',
                background: isActive ? '#e6f7ff' : 'transparent',
                borderLeft: isActive ? '3px solid #1677ff' : '3px solid transparent',
                marginBottom: 4,
                borderRadius: 4,
              }}
              actions={[
                <Tooltip title="对比此版本" key="diff">
                  <Button
                    type="text"
                    size="small"
                    icon={<DiffOutlined />}
                    onClick={() => handleDiff(version.id)}
                    style={{ color: isSelected ? '#1677ff' : undefined }}
                  />
                </Tooltip>,
                <Tooltip title="回滚到此版本" key="rollback">
                  <Button
                    type="text"
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => handleRollbackClick(version.id)}
                    disabled={isActive}
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Tag color="blue">v{version.versionNumber}</Tag>
                }
                title={
                  <Space size={4}>
                    <Text style={{ fontSize: 13 }}>
                      {version.summary || `版本 ${version.versionNumber}`}
                    </Text>
                    {isActive && (
                      <Tag color="green" style={{ fontSize: 10, lineHeight: '16px' }}>
                        当前
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space size="small">
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      {version.createdBy}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {new Date(version.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />

      {/* Rollback confirmation modal */}
      <Modal
        title="确认回滚"
        open={rollbackModalOpen}
        onOk={handleConfirmRollback}
        onCancel={() => {
          setRollbackModalOpen(false);
          setVersionToRollback(null);
        }}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Text>
          确定要回滚到此版本吗？此操作将覆盖当前文档内容。
        </Text>
      </Modal>
    </div>
  );
};

export default VersionHistory;
