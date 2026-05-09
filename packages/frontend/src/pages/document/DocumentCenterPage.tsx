import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Layout,
  Tree,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Dropdown,
  message,
  Input,
  Modal,
  Form,
  Popconfirm,
} from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  PlusOutlined,
  UploadOutlined,
  DeleteOutlined,
  MoreOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  EyeOutlined,
  InboxOutlined,
  SearchOutlined,
  HomeOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { DocumentType } from '@saas/shared-types';
import type { IDocument } from '@saas/shared-types';
import {
  useDocuments,
  useDocumentTree,
  useCreateFolder,
  useDeleteDocument,
  useSearchDocuments,
} from '@/hooks/useDocuments';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import DocUploader from '@/components/document/DocUploader';
import ShareDialog from '@/components/document/ShareDialog';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

type DocumentTreeItem = IDocument & {
  children?: DocumentTreeItem[];
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildTreeData(docs: IDocument[]): DataNode[] {
  const childrenMap: Record<string, DocumentTreeItem[]> = {};
  const roots: DocumentTreeItem[] = [];

  docs.forEach((doc) => {
    if (doc.type === DocumentType.FOLDER) {
      if (doc.parentId) {
        if (!childrenMap[doc.parentId]) childrenMap[doc.parentId] = [];
        childrenMap[doc.parentId].push(doc);
      } else {
        roots.push(doc);
      }
    }
  });

  function buildNode(folder: DocumentTreeItem): DataNode {
    const children = childrenMap[folder.id] || [];
    return {
      key: folder.id,
      title: folder.name,
      icon: <FolderOutlined />,
      isLeaf: children.length === 0,
      children: children.length > 0 ? children.map(buildNode) : undefined,
    };
  }

  return roots.map(buildNode);
}

function findFolderPath(docs: DocumentTreeItem[], targetId?: string): DocumentTreeItem[] {
  if (!targetId) {
    return [];
  }

  const walk = (
    items: DocumentTreeItem[],
    path: DocumentTreeItem[],
  ): DocumentTreeItem[] | null => {
    for (const item of items) {
      if (item.type !== DocumentType.FOLDER) {
        continue;
      }

      const nextPath = [...path, item];
      if (item.id === targetId) {
        return nextPath;
      }

      const result = item.children ? walk(item.children, nextPath) : null;
      if (result) {
        return result;
      }
    }
    return null;
  };

  return walk(docs, []) ?? [];
}

const DocumentCenterPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [newFolderForm] = Form.useForm();

  const { data: treeData, isLoading: treeLoading } = useDocumentTree(teamId);
  const {
    data: documents,
    isLoading: docsLoading,
    isError,
    error,
  } = useDocuments(selectedFolderId, teamId);
  const createFolderMutation = useCreateFolder();
  const deleteDocumentMutation = useDeleteDocument();

  const treeNodes = useMemo(() => {
    if (!treeData) return [];
    return buildTreeData(treeData);
  }, [treeData]);

  const folderPath = useMemo(
    () => findFolderPath(treeData ?? [], selectedFolderId),
    [treeData, selectedFolderId],
  );

  const currentFolder = folderPath[folderPath.length - 1];

  const { data: searchResults, isLoading: searchLoading } = useSearchDocuments(
    searchText ? teamId : undefined,
    searchText
  );

  const docList = useMemo(() => {
    if (searchText && searchResults) {
      return searchResults;
    }
    return documents ?? [];
  }, [documents, searchText, searchResults]);

  const handleTreeSelect = useCallback(
    (keys: React.Key[]) => {
      setSelectedFolderId(keys[0] as string | undefined);
    },
    []
  );

  const handleNewFolder = useCallback(async () => {
    if (!teamId) return;
    try {
      const values = await newFolderForm.validateFields();
      await createFolderMutation.mutateAsync({
        name: values.name,
        parentId: selectedFolderId,
        teamId,
      });
      message.success('文件夹创建成功');
      setNewFolderModalOpen(false);
      newFolderForm.resetFields();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('创建文件夹失败');
    }
  }, [teamId, selectedFolderId, createFolderMutation, newFolderForm]);

  const handleUploadSuccess = useCallback((docId: string) => {
    setUploadModalOpen(false);
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, `documents/${docId}`));
    }
  }, [orgId, teamId, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteDocumentMutation.mutateAsync(id);
        message.success('删除成功');
      } catch {
        message.error('删除失败');
      }
    },
    [deleteDocumentMutation]
  );

  const handleDocClick = useCallback(
    (doc: IDocument) => {
      if (doc.type === DocumentType.FOLDER) {
        setSelectedFolderId(doc.id);
      } else if (orgId && teamId) {
        navigate(teamSubPath(orgId, teamId, `documents/${doc.id}`));
      }
    },
    [orgId, teamId, navigate]
  );

  const handleOpenRoot = useCallback(() => {
    setSelectedFolderId(undefined);
  }, []);

  const handleOpenParent = useCallback(() => {
    if (folderPath.length <= 1) {
      setSelectedFolderId(undefined);
      return;
    }
    setSelectedFolderId(folderPath[folderPath.length - 2].id);
  }, [folderPath]);

  const columns: ColumnsType<IDocument> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record: IDocument) => (
          <Space
            style={{ cursor: 'pointer' }}
            onClick={() => handleDocClick(record)}
          >
            {record.type === DocumentType.FOLDER ? (
              <FolderOutlined style={{ color: '#faad14' }} />
            ) : (
              <FileOutlined style={{ color: '#1890ff' }} />
            )}
            <Text ellipsis={{ tooltip: name }}>{name}</Text>
          </Space>
        ),
      },
      {
        title: '类型',
        dataIndex: 'mimeType',
        key: 'mimeType',
        width: 120,
        render: (mimeType: string | undefined, record: IDocument) => (
          <Tag>{record.type === DocumentType.FOLDER ? '文件夹' : mimeType || '文件'}</Tag>
        ),
      },
      {
        title: '大小',
        dataIndex: 'fileSize',
        key: 'fileSize',
        width: 100,
        render: (size: number | undefined) => formatFileSize(size),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 160,
        render: (date: string) =>
          date ? new Date(date).toLocaleString('zh-CN') : '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        render: (_: unknown, record: IDocument) => (
          <Dropdown
            menu={{
              items: [
                ...(record.type !== DocumentType.FOLDER
                  ? [
                      {
                        key: 'preview',
                        icon: <EyeOutlined />,
                        label: '预览',
                        onClick: () => handleDocClick(record),
                      },
                      {
                        key: 'share',
                        icon: <ShareAltOutlined />,
                        label: '分享',
                        onClick: () => setShareDocId(record.id),
                      },
                      {
                        key: 'download',
                        icon: <DownloadOutlined />,
                        label: '下载',
                        disabled: !record.fileUrl,
                        onClick: () =>
                          record.fileUrl && window.open(record.fileUrl, '_blank'),
                      },
                    ]
                  : []),
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => handleDelete(record.id),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        ),
      },
    ],
    [handleDocClick, handleDelete]
  );

  if (!orgId || !teamId) return null;

  return (
    <Layout style={{ background: 'transparent', minHeight: 'calc(100vh - 160px)' }}>
      <Sider
        width={260}
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 12,
          border: '1px solid #f0f0f0',
          marginRight: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            文档目录
          </Title>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setNewFolderModalOpen(true)}
          />
        </div>

        <Button
          block
          icon={<UploadOutlined />}
          style={{ marginBottom: 12 }}
          onClick={() => setUploadModalOpen(true)}
        >
          上传文件
        </Button>

        {treeLoading ? (
          <Loading tip="加载目录..." />
        ) : treeNodes.length === 0 ? (
          <EmptyState description="暂无文件夹" />
        ) : (
          <Tree
            treeData={treeNodes}
            onSelect={handleTreeSelect}
            defaultExpandAll
            showIcon
            selectedKeys={selectedFolderId ? [selectedFolderId] : []}
          />
        )}
      </Sider>

      <Content>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            文档列表
          </Title>
          <Space wrap>
            <Input
              placeholder="搜索文档..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              上传
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setNewFolderModalOpen(true)}
            >
              新建文件夹
            </Button>
          </Space>
        </div>

        <Space wrap style={{ marginBottom: 12 }}>
          <Button
            icon={<HomeOutlined />}
            onClick={handleOpenRoot}
            disabled={!selectedFolderId}
          >
            全部文档
          </Button>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleOpenParent}
            disabled={!selectedFolderId}
          >
            返回上级
          </Button>
          <Text type="secondary">
            当前位置：
            <a onClick={handleOpenRoot}>根目录</a>
            {folderPath.map((folder) => (
              <React.Fragment key={folder.id}>
                {' / '}
                <a onClick={() => setSelectedFolderId(folder.id)}>{folder.name}</a>
              </React.Fragment>
            ))}
          </Text>
        </Space>

        <Table<IDocument>
          rowKey="id"
          columns={columns}
          dataSource={docList}
          loading={docsLoading || searchLoading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <EmptyState
                description={
                  searchText
                    ? '没有匹配的文档'
                    : currentFolder
                      ? '该文件夹为空'
                      : '暂无文档'
                }
              />
            ),
          }}
        />
      </Content>

      {/* New Folder Modal */}
      <Modal
        title="新建文件夹"
        open={newFolderModalOpen}
        onOk={handleNewFolder}
        onCancel={() => {
          setNewFolderModalOpen(false);
          newFolderForm.resetFields();
        }}
        confirmLoading={createFolderMutation.isPending}
        destroyOnClose
      >
        <Form form={newFolderForm} layout="vertical">
          <Form.Item
            name="name"
            label="文件夹名称"
            rules={[
              { required: true, message: '请输入文件夹名称' },
              { max: 100, message: '名称不能超过 100 个字符' },
            ]}
          >
            <Input placeholder="请输入文件夹名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Upload Modal */}
      <Modal
        title="上传文件"
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <DocUploader
          teamId={teamId}
          parentId={selectedFolderId}
          onSuccess={handleUploadSuccess}
        />
      </Modal>

      {/* Share Dialog */}
      <ShareDialog
        open={!!shareDocId}
        onClose={() => setShareDocId(null)}
        docId={shareDocId || ''}
      />
    </Layout>
  );
};

export default DocumentCenterPage;
