import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { io, Socket } from 'socket.io-client';
import { useDocument, useUpdateDocument, useSaveDocumentContent, useDocumentContent } from '@/hooks/useDocuments';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';

const { Title } = Typography;
const { TextArea } = Input;

const AUTH_TOKEN_KEY = 'auth_token';
const TENANT_ID_KEY = 'current_tenant_id';

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
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'saving' | 'saved' | 'offline'>('connecting');
  const socketRef = useRef<Socket | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const versionRef = useRef(0);

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
      contentRef.current = docContent.content || '';
    }
  }, [docContent]);

  useEffect(() => {
    if (!docId) return undefined;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const tenantId = localStorage.getItem(TENANT_ID_KEY);

    if (!token || !tenantId) {
      setSyncStatus('offline');
      return undefined;
    }

    const socket = io('/documents', {
      transports: ['websocket', 'polling'],
      auth: { token, tenantId },
    });

    socketRef.current = socket;
    setSyncStatus('connecting');

    socket.on('connect', () => {
      setSyncStatus('connected');
      socket.emit('join_document', { docId });
    });

    socket.on('disconnect', () => {
      setSyncStatus('offline');
    });

    socket.on('document_state', (payload: { content?: string | null }) => {
      const nextContent = payload.content || '';
      setContent(nextContent);
      contentRef.current = nextContent;
      setDirty(false);
      setSyncStatus('connected');
    });

    socket.on('document_changed', (payload: { content?: string | null }) => {
      const nextContent = payload.content || '';
      setContent(nextContent);
      contentRef.current = nextContent;
      setDirty(false);
    });

    socket.on('document_saved', (payload: { content?: string | null }) => {
      contentRef.current = payload.content || '';
      setDirty(false);
      setSyncStatus('saved');
    });

    socket.on('document_save_failed', (payload: { message?: string }) => {
      setSyncStatus('offline');
      message.error(payload.message || '文档同步保存失败');
    });

    socket.on('document_error', (payload: { message?: string }) => {
      setSyncStatus('offline');
      message.error(payload.message || '文档协作连接失败');
    });

    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [docId]);

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
      socketRef.current?.emit('document_save', { docId, content });
      setDirty(false);
      message.success('文档已保存');
    } catch {
      message.error('保存失败');
    }
  }, [docId, title, content, updateMutation, saveContentMutation]);

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent);
    contentRef.current = nextContent;
    setDirty(true);
    versionRef.current += 1;

    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('document_change', {
        docId,
        content: contentRef.current,
        version: versionRef.current,
      });
    }, 250);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!docId || !socketRef.current?.connected) return;
      setSyncStatus('saving');
      socketRef.current.emit('document_save', {
        docId,
        content: contentRef.current,
      });
    }, 1200);
  }, [docId]);

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
          <span style={{ color: syncStatus === 'offline' ? '#ff4d4f' : '#8c8c8c', fontSize: 12 }}>
            {syncStatus === 'saving'
              ? '同步保存中'
              : syncStatus === 'saved'
                ? '已同步'
                : syncStatus === 'connected'
                  ? '协作已连接'
                  : syncStatus === 'connecting'
                    ? '连接协作中'
                    : '协作离线'}
          </span>
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
          onChange={(e) => handleContentChange(e.target.value)}
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
