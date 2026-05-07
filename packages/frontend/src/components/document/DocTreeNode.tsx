import React from 'react';
import { Typography, Space } from 'antd';
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { IDocument } from '@saas/shared-types';
import { DocumentType } from '@saas/shared-types';

const { Text } = Typography;

export interface DocTreeNodeProps {
  document: IDocument;
  isSelected: boolean;
  onSelect: (doc: IDocument) => void;
  style?: React.CSSProperties;
}

const DocTreeNode: React.FC<DocTreeNodeProps> = ({
  document,
  isSelected,
  onSelect,
  style,
}) => {
  const isFolder = document.type === DocumentType.FOLDER;

  return (
    <div
      onClick={() => onSelect(document)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        cursor: 'pointer',
        borderRadius: 4,
        backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
        transition: 'background-color 0.2s',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }
      }}
    >
      <Space size={8}>
        {isFolder ? (
          isSelected ? (
            <FolderOpenOutlined style={{ color: '#faad14', fontSize: 16 }} />
          ) : (
            <FolderOutlined style={{ color: '#faad14', fontSize: 16 }} />
          )
        ) : (
          <FileOutlined style={{ color: '#1890ff', fontSize: 16 }} />
        )}
        <Text
          ellipsis={{ tooltip: document.name }}
          style={{ maxWidth: 180, fontSize: 13 }}
        >
          {document.name}
        </Text>
      </Space>
    </div>
  );
};

export default DocTreeNode;
