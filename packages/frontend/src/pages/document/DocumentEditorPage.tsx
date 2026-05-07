import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Input,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useDocument, useUpdateDocument, useSaveDocumentContent, useDocumentContent } from '@/hooks/useDocuments';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title } = Typography;
const { TextArea } = Input;

const DocumentEditorPage: React.FC = () => {
  const { orgId, teamId, docId } = useParams<{
    orgId: string;
    teamId: string;
    docId: string;
  }>();
  const navigate = useNavigate();

  const { data: document, isLoading, isError, error } = useDocument(docId);
  const updateMutation = useUpdateDocument();
  const saveContentMutation = useSaveDocumentContent();
  const { data: docContent, isLoading: contentLoading } = useDocumentContent(docId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);

  // Initialize title from document metadata
  useEffect(() => {
    if (document) {
      setTitle(document.name);
    }
  }, [document]);

  // Initialize content from the dedicated content API
  useEffect(() => {
    if (docContent) {
      setContent(docContent.content || '');
    }
  }, [docContent]);

  const handleBack = useCallback(() => {
    if (dirty) {
      const confirmed = window.confirm('有未保存的更改，确定离开吗？');
      if (!confirmed) return;
    }
    if (orgId && teamId && docId) {
      navigate(teamSubPath(orgId, teamId, `documents/${docId}`));
    }
  }, [orgId, teamId, docId, navigate, dirty]);

  const handleSave = useCallback(async () => {
    if (!docId) return;
    try {
      await updateMutation.mutateAsync({
        id: docId,
        data: { name: title },
      });
      await saveContentMutation.mutateAsync({
        docId,
        content,
      });
      setDirty(false);
      message.success('文档已保存');
    } catch {
      message.error('保存失败');
    }
  }, [docId, title, content, updateMutation, saveContentMutation]);

  if (!orgId || !teamId || !docId) return null;

  if (isLoading) return <Loading tip="加载文档..." />;

  if (contentLoading) return <Loading tip="加载内容..." />;

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
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            style={{
              width: 400,
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              borderBottom: '1px solid #d9d9d9',
            }}
            placeholder="文档标题"
          />
        </Space>

        <Space>
          {dirty && (
            <span style={{ color: '#faad14', fontSize: 12 }}>未保存</span>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={updateMutation.isPending || saveContentMutation.isPending}
          >
            保存
          </Button>
        </Space>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          padding: 16,
          minHeight: 'calc(100vh - 240px)',
        }}
      >
        <TextArea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          placeholder="在此输入文档内容..."
          style={{
            width: '100%',
            minHeight: 'calc(100vh - 300px)',
            border: 'none',
            resize: 'vertical',
            fontSize: 14,
            lineHeight: 1.8,
          }}
        />
      </div>
    </div>
  );
};

export default DocumentEditorPage;
