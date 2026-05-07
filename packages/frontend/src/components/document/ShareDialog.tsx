import React, { useState, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Space,
  Button,
  Typography,
  message,
  Switch,
  Tag,
  Divider,
} from 'antd';
import { CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { useCreateShareLink } from '@/hooks/useDocuments';

const { Text } = Typography;

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  docId: string;
}

const permissionOptions = [
  { label: '查看', value: 'view' },
  { label: '编辑', value: 'edit' },
  { label: '评论', value: 'comment' },
];

const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, docId }) => {
  const [form] = Form.useForm();
  const createShareMutation = useCreateShareLink();
  const [shareResult, setShareResult] = useState<{
    url: string;
    accessCode?: string;
  } | null>(null);

  const handleGenerate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const result = await createShareMutation.mutateAsync({
        docId,
        data: {
          permission: values.permission,
          accessCode: values.enableAccessCode ? values.accessCode : undefined,
          expiresAt: undefined,
        },
      });
      setShareResult({
        url: result.url,
        accessCode: result.accessCode || values.accessCode,
      });
      message.success('分享链接已生成');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('生成分享链接失败');
    }
  }, [form, docId, createShareMutation]);

  const handleCopyLink = useCallback(async () => {
    if (!shareResult?.url) return;
    try {
      await navigator.clipboard.writeText(shareResult.url);
      message.success('链接已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动复制');
    }
  }, [shareResult]);

  const handleClose = useCallback(() => {
    setShareResult(null);
    form.resetFields();
    onClose();
  }, [form, onClose]);

  return (
    <Modal
      title="分享文档"
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnClose
      width={480}
    >
      {!shareResult ? (
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            name="permission"
            label="权限设置"
            initialValue="view"
            rules={[{ required: true, message: '请选择权限' }]}
          >
            <Select options={permissionOptions} />
          </Form.Item>

          <Form.Item name="enableAccessCode" label="访问码" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.enableAccessCode !== curr.enableAccessCode}
          >
            {({ getFieldValue }) =>
              getFieldValue('enableAccessCode') ? (
                <Form.Item
                  name="accessCode"
                  label="访问码"
                  rules={[
                    { required: true, message: '请设置访问码' },
                    { min: 4, message: '访问码至少 4 位' },
                  ]}
                >
                  <Input.Password placeholder="设置访问码（至少 4 位）" />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={handleGenerate}
              loading={createShareMutation.isPending}
            >
              生成分享链接
            </Button>
          </div>
        </Form>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>分享链接已生成：</Text>
          </div>

          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Input value={shareResult.url} readOnly />
            <Button icon={<CopyOutlined />} onClick={handleCopyLink}>
              复制
            </Button>
          </Space.Compact>

          {shareResult.accessCode && (
            <div
              style={{
                padding: 12,
                backgroundColor: '#fffbe6',
                borderRadius: 4,
                marginBottom: 12,
              }}
            >
              <Space>
                <Text type="warning">访问码：</Text>
                <Tag color="warning" style={{ fontSize: 14 }}>
                  {shareResult.accessCode}
                </Tag>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    if (shareResult.accessCode) {
                      navigator.clipboard.writeText(shareResult.accessCode);
                      message.success('访问码已复制');
                    }
                  }}
                >
                  复制
                </Button>
              </Space>
            </div>
          )}

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Button onClick={handleClose}>关闭</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ShareDialog;
