import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Typography,
  message,
  Input,
  Spin,
  Alert,
  Drawer,
  Collapse,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  ShareAltOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useDocument,
  useDocumentVersions,
  useRollbackVersion,
  useDocumentContent,
  useSaveDocumentContent,
} from '@/hooks/useDocuments';
import { teamSubPath } from '@/router/routes';
import DocPreview from '@/components/document/DocPreview';
import VersionHistory from '@/components/document/VersionHistory';
import type { DocVersion } from '@/components/document/VersionHistory';
import ShareDialog from '@/components/document/ShareDialog';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title, Text } = Typography;
const { TextArea } = Input;

const markdownStyles = `
.markdown-preview h1 { font-size: 24px; margin: 16px 0 8px; }
.markdown-preview h2 { font-size: 20px; margin: 14px 0 8px; }
.markdown-preview h3 { font-size: 16px; margin: 12px 0 8px; }
.markdown-preview p { margin: 8px 0; line-height: 1.8; }
.markdown-preview code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
.markdown-preview pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow: auto; }
.markdown-preview pre code { background: none; padding: 0; }
.markdown-preview table { border-collapse: collapse; width: 100%; margin: 12px 0; }
.markdown-preview th, .markdown-preview td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
.markdown-preview th { background: #fafafa; font-weight: 600; }
.markdown-preview blockquote { border-left: 4px solid #1890ff; padding-left: 16px; margin: 12px 0; color: #666; }
.markdown-preview ul, .markdown-preview ol { padding-left: 24px; margin: 8px 0; }
.markdown-preview a { color: #1890ff; }
.markdown-preview img { max-width: 100%; }

.markdown-editor-layout {
  display: flex;
  gap: 16px;
  min-height: calc(100vh - 280px);
}

@media (max-width: 767px) {
  .markdown-editor-layout {
    flex-direction: column;
  }
}
`;

const DocumentPreviewPage: React.FC = () => {
  const { orgId, teamId, docId } = useParams<{
    orgId: string;
    teamId: string;
    docId: string;
  }>();
  const navigate = useNavigate();

  const { data: document, isLoading, isError, error } = useDocument(docId);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);

  const { data: versionsData, isLoading: versionsLoading } = useDocumentVersions(docId);
  const rollbackMutation = useRollbackVersion();

  // Markdown editor state
  const [mdContent, setMdContent] = useState('');
  const [mdDirty, setMdDirty] = useState(false);

  const saveContentMutation = useSaveDocumentContent();

  // Detect file type
  const isMarkdown = useMemo(() => {
    if (!document) return false;
    if (document.mimeType === 'text/markdown') return true;
    const name = document.name?.toLowerCase() || '';
    return name.endsWith('.md') || name.endsWith('.markdown');
  }, [document]);

  const isText = useMemo(() => {
    if (!document || isMarkdown) return false;
    if (
      document.mimeType === 'text/plain' ||
      document.mimeType === 'text/csv'
    )
      return true;
    const name = document.name?.toLowerCase() || '';
    return (
      name.endsWith('.txt') || name.endsWith('.json') || name.endsWith('.csv')
    );
  }, [document, isMarkdown]);

  // Fetch content for markdown and text files via the /content API endpoint
  const { data: docContent, isLoading: contentLoading } = useDocumentContent(
    (isMarkdown || isText) ? docId : undefined
  );

  // Initialize markdown content from fetched data
  useEffect(() => {
    if (isMarkdown && docContent) {
      setMdContent(docContent.content || '');
      setMdDirty(false);
    }
  }, [isMarkdown, docContent]);

  // Map backend version data to DocVersion type expected by VersionHistory
  const docVersions: DocVersion[] = (versionsData ?? []).map((version: any) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    createdBy: '未知',
    fileSize: version.fileSize,
  }));

  const activeVersionId =
    docVersions.length > 0
      ? docVersions.reduce((prev, curr) =>
          curr.versionNumber > prev.versionNumber ? curr : prev
        ).id
      : undefined;

  const handleBack = useCallback(() => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'documents'));
    }
  }, [orgId, teamId, navigate]);

  const handleDownload = useCallback(() => {
    if (document?.fileUrl) {
      window.open(document.fileUrl, '_blank');
    }
  }, [document]);

  const handleEdit = useCallback(() => {
    if (orgId && teamId && docId) {
      navigate(teamSubPath(orgId, teamId, `documents/${docId}/edit`));
    }
  }, [orgId, teamId, docId, navigate]);

  const handleShare = useCallback(() => {
    if (docId) {
      setShareDocId(docId);
    }
  }, [docId]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!docId) return;
    try {
      await saveContentMutation.mutateAsync({ docId, content: mdContent });
      setMdDirty(false);
      message.success('文档已保存');
    } catch {
      message.error('保存失败');
    }
  }, [docId, mdContent, saveContentMutation]);

  if (!orgId || !teamId || !docId) return null;

  if (isLoading) return <Loading tip="加载文档..." />;

  if (isError || !document) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取文档详情失败'}
      />
    );
  }

  return (
    <div>
      <style>{markdownStyles}</style>

      {/* Header */}
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
            返回文档中心
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {document.name}
          </Title>
        </Space>

        <Space>
          {isMarkdown && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveMarkdown}
              loading={saveContentMutation.isPending}
              disabled={!mdDirty}
            >
              保存
            </Button>
          )}
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setVersionDrawerOpen(true)}
          >
            版本历史
          </Button>
          {!isMarkdown && (
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
          )}
          <Button icon={<ShareAltOutlined />} onClick={handleShare}>
            分享
          </Button>
          {document.fileUrl && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              href={document.fileUrl}
              target="_blank"
            >
              下载
            </Button>
          )}
        </Space>
      </div>

      {/* Content Area */}
      {isMarkdown ? (
        <div>
          {mdDirty && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <Text type="warning" style={{ fontSize: 12 }}>
                有未保存的更改
              </Text>
            </div>
          )}
          {contentLoading ? (
            <Spin tip="加载文档内容..." />
          ) : (
            <div className="markdown-editor-layout">
              {/* Editor pane */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text strong>编辑</Text>
                </div>
                <TextArea
                  value={mdContent}
                  onChange={(e) => {
                    setMdContent(e.target.value);
                    setMdDirty(true);
                  }}
                  placeholder="在此输入 Markdown 内容..."
                  style={{
                    flex: 1,
                    fontFamily:
                      'Consolas, Monaco, "Courier New", monospace',
                    fontSize: 14,
                    lineHeight: 1.8,
                    resize: 'none',
                    minHeight: 400,
                  }}
                />
              </div>
              {/* Preview pane */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text strong>预览</Text>
                </div>
                <div
                  className="markdown-preview"
                  style={{
                    flex: 1,
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                    padding: '16px 24px',
                    overflow: 'auto',
                    minHeight: 400,
                  }}
                >
                  {mdContent ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mdContent}
                    </ReactMarkdown>
                  ) : (
                    <Text type="secondary">
                      编辑内容后，预览将实时更新
                    </Text>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <DocPreview
          document={document}
          content={isText ? docContent?.content ?? undefined : undefined}
          contentLoading={isText ? contentLoading : undefined}
          onDownload={handleDownload}
        />
      )}

      {/* Version history drawer */}
      <Drawer
        title="版本历史"
        placement="right"
        width={380}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
      >
        <VersionHistory
          versions={docVersions}
          loading={versionsLoading}
          onRollback={(versionId) => {
            rollbackMutation.mutate(
              { docId: docId!, versionId },
              {
                onSuccess: () => {
                  message.success('已回滚到指定版本');
                  setVersionDrawerOpen(false);
                },
                onError: () => {
                  message.error('回滚失败');
                },
              }
            );
          }}
          onDiff={(verA, verB) => {
            message.info(`版本对比: ${verA} ↔ ${verB} (待实现) `);
          }}
          activeVersionId={activeVersionId}
        />
      </Drawer>

      {/* Share Dialog */}
      <ShareDialog
        open={!!shareDocId}
        onClose={() => setShareDocId(null)}
        docId={shareDocId || ''}
      />
    </div>
  );
};

export default DocumentPreviewPage;
