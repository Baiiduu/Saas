import React, { useCallback, useRef, useState } from 'react';
import { Upload, Typography, message, Button } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { useUploadFile } from '@/hooks/useDocuments';

const { Dragger } = Upload;
const { Text } = Typography;

export interface DocUploaderProps {
  teamId: string;
  parentId?: string;
  onSuccess?: (docId: string) => void;
}

const MAX_FILE_SIZE_MB = 50;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
];

const DocUploader: React.FC<DocUploaderProps> = ({
  teamId,
  parentId,
  onSuccess,
}) => {
  const uploadMutation = useUploadFile();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        message.error(`文件大小不能超过 ${MAX_FILE_SIZE_MB}MB`);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('type', 'FILE');
      formData.append('teamId', teamId);
      if (parentId) formData.append('parentId', parentId);

      setUploading(true);
      try {
        const result = await uploadMutation.mutateAsync(formData);
        message.success(`"${file.name}" 上传成功`);
        onSuccess?.(result.id);
      } catch {
        message.error(`"${file.name}" 上传失败`);
      } finally {
        setUploading(false);
      }
    },
    [teamId, parentId, uploadMutation, onSuccess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      files.forEach(handleFile);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(handleFile);
      if (e.target) e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div>
      <Dragger
        onDrop={handleDrop}
        style={{ marginBottom: 16 }}
        showUploadList={false}
        beforeUpload={() => false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">拖拽文件到此处上传</p>
        <p className="ant-upload-hint">
          支持图片、PDF、Office 文档等，单个文件不超过 {MAX_FILE_SIZE_MB}MB
        </p>
      </Dragger>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Text type="secondary">或</Text>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Button
          icon={<UploadOutlined />}
          onClick={handleClick}
          loading={uploading}
        >
          选择文件上传
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleInputChange}
          multiple
          accept={ALLOWED_TYPES.join(',')}
        />
      </div>
    </div>
  );
};

export default DocUploader;
