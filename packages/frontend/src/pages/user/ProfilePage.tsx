import React, { useState } from 'react';
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Space,
  message,
  Divider,
  Spin,
} from 'antd';
import { UserOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/hooks/useAuth';
import * as authService from '@/services/authService';

const { Title } = Typography;

interface ProfileFormValues {
  displayName: string;
  avatarUrl: string;
}

/**
 * ProfilePage - View and edit personal profile (display name, avatar URL).
 *
 * The page loads the current user from the auth store and allows editing
 * display name and avatar URL through a simple form.
 */
const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [form] = Form.useForm<ProfileFormValues>();
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    user?.avatarUrl
  );

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      authService.updateProfile({
        displayName: values.displayName,
        avatar: values.avatarUrl || undefined,
      }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      message.success('个人资料已更新');
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
    onError: () => {
      message.error('更新失败，请重试');
    },
  });

  const handleFinish = (values: ProfileFormValues) => {
    updateMutation.mutate(values);
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarPreview(e.target.value || user?.avatarUrl);
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载用户信息..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        个人资料
      </Title>

      <Card>
        {/* Avatar preview */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={avatarPreview || user.avatarUrl}
            alt={user.displayName}
          />
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">
              {user.email}
            </Typography.Text>
          </div>
        </div>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            displayName: user.displayName,
            avatarUrl: user.avatarUrl || '',
          }}
          onFinish={handleFinish}
        >
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[
              { required: true, message: '请输入显示名称' },
              { min: 2, message: '名称至少2个字符' },
              { max: 50, message: '名称不能超过50个字符' },
            ]}
          >
            <Input placeholder="输入显示名称" />
          </Form.Item>

          <Form.Item
            name="avatarUrl"
            label="头像 URL"
            rules={[{ type: 'url', message: '请输入有效的 URL' }]}
          >
            <Input
              placeholder="输入头像图片 URL"
              onChange={handleAvatarUrlChange}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={updateMutation.isPending}
              >
                保存修改
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setAvatarPreview(user.avatarUrl);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProfilePage;
