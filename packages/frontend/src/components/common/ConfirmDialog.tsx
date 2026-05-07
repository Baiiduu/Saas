import React from 'react';
import { Modal } from 'antd';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Dialog title */
  title?: string;
  /** Dialog body content */
  content: React.ReactNode;
  /** Callback when the confirm action is triggered */
  onConfirm: () => void;
  /** Callback when the dialog is dismissed */
  onCancel: () => void;
  /** Text for the confirm button */
  confirmText?: string;
  /** Text for the cancel button */
  cancelText?: string;
  /** If true, the confirm button renders with a danger style */
  danger?: boolean;
  /** Whether the confirm button is in a loading state */
  loading?: boolean;
}

/**
 * ConfirmDialog - A reusable confirmation modal dialog.
 * Wraps Ant Design's `Modal` component with consistent defaults
 * for confirmation-type dialogs.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = '确认操作',
  content,
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  loading = false,
}) => {
  return (
    <Modal
      open={open}
      title={title}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{ danger, loading }}
      cancelButtonProps={{ disabled: loading }}
      destroyOnClose
      centered
    >
      {content}
    </Modal>
  );
};

export default ConfirmDialog;
