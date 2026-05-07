import React from 'react';
import { Empty, Button, Typography } from 'antd';

const { Text } = Typography;

export interface EmptyStateProps {
  /** Custom title displayed above the description */
  title?: string;
  /** Descriptive text explaining why the list/view is empty */
  description?: string;
  /** Text for the optional action button */
  actionText?: string;
  /** Callback when the action button is clicked */
  onAction?: () => void;
  /** Custom image/icon node to replace the default empty image */
  image?: React.ReactNode;
}

/**
 * EmptyState - A reusable empty state placeholder.
 * Displays Ant Design's `Empty` component with optional title,
 * description, and a call-to-action button.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description = '暂无数据',
  actionText,
  onAction,
  image,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <Empty image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}>
        {title && (
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
            {title}
          </Text>
        )}
        <Text type="secondary">{description}</Text>
        {actionText && onAction && (
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={onAction}>
              {actionText}
            </Button>
          </div>
        )}
      </Empty>
    </div>
  );
};

export default EmptyState;
