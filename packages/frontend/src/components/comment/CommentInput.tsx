import React, { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Input,
  Button,
  Space,
  message,
  Popover,
  List,
  Avatar,
  Typography,
} from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  PaperClipOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import * as commentService from '@/services/commentService';
import { post } from '@/services/api';
import { useTeamMembers } from '@/hooks/useTenant';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const { Text } = Typography;
const { TextArea } = Input;

export interface CommentInputProps {
  resourceType: string;
  resourceId: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Team ID for fetching members (falls back to workspace store) */
  teamId?: string;
}

/**
 * CommentInput — Rich text input for posting comments.
 * Provides a toolbar with Bold/Italic, @mention member selector, and file attach button.
 */
const CommentInput: React.FC<CommentInputProps> = ({
  resourceType,
  resourceId,
  placeholder = '输入评论...',
  teamId,
}) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);

  const storeTeamId = useWorkspaceStore((state) => state.currentTeam?.id);
  const effectiveTeamId = teamId || storeTeamId;
  const { data: members } = useTeamMembers(effectiveTeamId);

  const mutation = useMutation({
    mutationFn: (content: string) =>
      commentService.createComment({
        resourceType,
        resourceId,
        content,
      }),
    onSuccess: () => {
      setText('');
      setLastUploadedFile(null);
      message.success('评论发表成功');
      queryClient.invalidateQueries({
        queryKey: ['comments', resourceType, resourceId],
      });
    },
    onError: () => {
      message.error('评论发表失败');
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      message.warning('请输入评论内容');
      return;
    }
    mutation.mutate(trimmed);
  }, [text, mutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter to submit
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInsertMention = useCallback((member: { id: string; displayName?: string }) => {
    setText((prev) => `${prev}@${member.displayName ?? ''} `);
    setMentionOpen(false);
  }, []);

  const handleFileAttach = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '*/*';
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const result = await post<{ filename: string; url: string }>(
            '/storage/upload',
            formData,
          );
          setText((prev) => `${prev}\n[附件](${result.url})`);
          setLastUploadedFile(file.name);
          message.success(`文件上传成功: ${file.name}`);
        } catch {
          message.error('文件上传失败');
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  }, []);

  const hasMembers = members && members.length > 0;
  const mentionPopoverContent = hasMembers ? (
    <List
      size="small"
      dataSource={members}
      renderItem={(member) => (
        <List.Item
          key={member.id}
          onClick={() => handleInsertMention(member)}
          style={{ cursor: 'pointer', padding: '4px 8px' }}
        >
          <Space size={8}>
            <Avatar size={20} icon={<UserOutlined />} />
            <Text>{member.displayName ?? member.id}</Text>
          </Space>
        </List.Item>
      )}
      style={{ width: 180 }}
    />
  ) : (
    <div style={{ width: 180, padding: '8px', textAlign: 'center', color: '#999' }}>
      暂无成员
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <Space style={{ marginBottom: 8 }}>
        <Button
          type="text"
          size="small"
          icon={<BoldOutlined />}
          title="加粗"
          onClick={() => {
            setText((prev) => prev + '**粗体文字**');
          }}
        />
        <Button
          type="text"
          size="small"
          icon={<ItalicOutlined />}
          title="斜体"
          onClick={() => {
            setText((prev) => prev + '*斜体文字*');
          }}
        />
        <Popover
          content={mentionPopoverContent}
          title="提及成员"
          trigger="click"
          open={mentionOpen}
          onOpenChange={setMentionOpen}
        >
          <Button
            type="text"
            size="small"
            icon={<UserOutlined />}
            title="@提及"
          />
        </Popover>
        <Button
          type="text"
          size="small"
          icon={<PaperClipOutlined />}
          title="上传附件"
          onClick={handleFileAttach}
          disabled={uploading}
        />
      </Space>

      {/* Upload status indicator */}
      {lastUploadedFile && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
          <PaperClipOutlined style={{ marginRight: 4 }} />
          {lastUploadedFile}
        </div>
      )}

      {/* Textarea row with send button */}
      <Space.Compact style={{ width: '100%' }}>
        <TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${placeholder} (Ctrl+Enter 发送)`}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={mutation.isPending}
          style={{ height: 'auto' }}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  );
};

export default CommentInput;
