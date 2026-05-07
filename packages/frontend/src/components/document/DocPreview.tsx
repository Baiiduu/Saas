import React, { useState, useMemo } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Descriptions,
  Image,
  Empty,
  Spin,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { IDocument } from '@saas/shared-types';
import { DocumentType } from '@saas/shared-types';
import { API_BASE_URL } from '@/services/api';

const { Title, Text } = Typography;

export interface DocPreviewProps {
  document: IDocument;
  content?: string; // optional content for text/markdown files
  contentLoading?: boolean; // loading state for content fetch
  onDownload?: (doc: IDocument) => void;
}

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const PDF_MIME_TYPE = 'application/pdf';
const MARKDOWN_MIME_TYPES = ['text/markdown'];
const TEXT_MIME_TYPES = ['text/plain', 'text/csv'];
const OFFICE_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

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
`;

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <FileOutlined style={{ fontSize: 48, color: '#999' }} />;
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return <FileImageOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
  }
  if (mimeType === PDF_MIME_TYPE) {
    return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />;
  }
  return <FileTextOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocPreview: React.FC<DocPreviewProps> = ({
  document,
  content,
  contentLoading,
  onDownload,
}) => {
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  if (document.type === DocumentType.FOLDER) {
    return (
      <Card>
        <Empty description="这是一个文件夹，无法预览" />
      </Card>
    );
  }

  const isImage = document.mimeType && IMAGE_MIME_TYPES.includes(document.mimeType);
  const isPdf = document.mimeType === PDF_MIME_TYPE;
  const isMarkdown = useMemo(() => {
    if (!document.mimeType) return false;
    if (MARKDOWN_MIME_TYPES.includes(document.mimeType)) return true;
    const name = document.name?.toLowerCase() || '';
    return name.endsWith('.md') || name.endsWith('.markdown');
  }, [document]);
  const isText = document.mimeType
    ? TEXT_MIME_TYPES.includes(document.mimeType)
    : false;
  const isOffice = document.mimeType
    ? OFFICE_MIME_TYPES.includes(document.mimeType)
    : false;
  const isUnsupported = !isImage && !isPdf && !isMarkdown && !isText && !isOffice;

  const renderPreviewContent = () => {
    // Image
    if (isImage && document.fileUrl) {
      return (
        <Image
          src={document.fileUrl}
          alt={document.name}
          style={{ maxWidth: '100%', maxHeight: 500 }}
          placeholder
        />
      );
    }

    // PDF
    if (isPdf && document.fileUrl) {
      const pdfFileUrl = `${API_BASE_URL}/documents/${document.id}/file`;
      return (
        <div>
          <Spin spinning={pdfLoading} tip="加载PDF中...">
            <iframe
              src={pdfFileUrl}
              title={document.name}
              style={{ width: '100%', height: 500, border: 'none' }}
              onLoad={() => setPdfLoading(false)}
              onError={() => {
                setPdfLoading(false);
                setPdfError(true);
              }}
            />
          </Spin>
          {pdfError && (
            <Alert
              message="PDF 预览加载失败"
              type="error"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Space>
              <Button
                type="link"
                icon={<LinkOutlined />}
                href={pdfFileUrl}
                target="_blank"
              >
                在新窗口打开
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={pdfFileUrl}
                target="_blank"
              >
                下载
              </Button>
            </Space>
          </div>
        </div>
      );
    }

    // Markdown
    if (isMarkdown) {
      if (contentLoading) {
        return <Spin tip="加载内容中..." />;
      }
      if (content) {
        return (
          <div
            className="markdown-preview"
            style={{ textAlign: 'left', padding: '16px 24px', maxWidth: '100%', overflow: 'auto' }}
          >
            <style>{markdownStyles}</style>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        );
      }
      return <Empty description="暂无内容" />;
    }

    // Text
    if (isText) {
      if (contentLoading) {
        return <Spin tip="加载内容中..." />;
      }
      if (content) {
        return (
          <pre
            style={{
              textAlign: 'left',
              padding: 16,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: 13,
              lineHeight: 1.6,
              overflow: 'auto',
              maxHeight: 500,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: '#f5f5f5',
              borderRadius: 4,
              margin: 0,
            }}
          >
            {content}
          </pre>
        );
      }
      return <Empty description="暂无内容" />;
    }

    // Unsupported (office docs, others)
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <FileOutlined style={{ fontSize: 48, color: '#999' }} />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">当前格式暂不支持在线预览，可下载查看</Text>
        </div>
        {document.fileUrl && (
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              href={document.fileUrl}
              target="_blank"
            >
              下载
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Preview Area */}
      <Card style={{ marginBottom: 16, minHeight: 200, textAlign: 'center' }}>
        {renderPreviewContent()}
      </Card>

      {/* File Info */}
      <Card>
        <Space
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            {document.name}
          </Title>
          {onDownload && document.fileUrl && !isPdf && (
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

        <Descriptions size="small" column={2}>
          <Descriptions.Item label="类型">
            <Tag>{document.mimeType || '未知'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="大小">
            {formatFileSize(document.fileSize)}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {document.createdAt
              ? new Date(document.createdAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {document.updatedAt
              ? new Date(document.updatedAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default DocPreview;
