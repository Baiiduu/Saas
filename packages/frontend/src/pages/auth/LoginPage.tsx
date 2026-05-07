import React, { useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Typography, message, Space, Alert, Divider } from 'antd';
import { MailOutlined, LockOutlined, GithubOutlined, GoogleOutlined } from '@ant-design/icons';
import { useLogin } from '@/hooks/useAuth';
import { githubOAuth, googleOAuth } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import AuthLayout from '@/layouts/AuthLayout';
import type { LoginRequest } from '@/types';

const { Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const setCurrentTenant = useWorkspaceStore((state) => state.setCurrentTenant);
  const setAuth = useAuthStore((state) => state.setAuth);

  // Lockout tracking state
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      try {
        const payload: LoginRequest = {
          email: values.email,
          password: values.password,
        };

        const response = await loginMutation.mutateAsync(payload);

        // Reset lockout state on success
        setRemainingAttempts(null);
        setIsLocked(false);
        setLockoutMinutes(null);

        // If tenant info is returned, set it in the workspace store
        if (response.tenant) {
          setCurrentTenant(response.tenant);
        }

        navigate('/');
      } catch (error: unknown) {
        const err = error as {
          response?: {
            data?: {
              message?: string;
              remainingAttempts?: number;
              locked?: boolean;
              lockoutMinutes?: number;
            };
          };
          message?: string;
        };

        const responseData = err.response?.data;
        const errorMessage = responseData?.message || err.message || '登录失败，请重试';

        // Check for lockout/attempts info from API response
        if (responseData?.locked) {
          setIsLocked(true);
          setLockoutMinutes(responseData.lockoutMinutes ?? null);
          message.error(errorMessage);
        } else if (typeof responseData?.remainingAttempts === 'number') {
          setRemainingAttempts(responseData.remainingAttempts);
          message.error(errorMessage);
        } else {
          message.error(errorMessage);
        }
      }
    },
    [loginMutation, navigate, setCurrentTenant]
  );

  const handleForgotPassword = useCallback(() => {
    navigate('/auth/reset-password');
  }, [navigate]);

  return (
    <AuthLayout>
      {/* Lockout alert */}
      {isLocked && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="账号已锁定"
          description={
            lockoutMinutes
              ? `由于多次登录失败，账号已被锁定。请 ${lockoutMinutes} 分钟后再试。`
              : '由于多次登录失败，账号已被锁定。请稍后再试或联系管理员。'
          }
        />
      )}

      {/* Remaining attempts warning */}
      {remainingAttempts !== null && remainingAttempts <= 3 && remainingAttempts > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`登录失败，还剩 ${remainingAttempts} 次尝试机会`}
        />
      )}

      {/* OAuth login buttons */}
      <Divider plain style={{ fontSize: 12, color: '#999' }}>
        第三方登录
      </Divider>
      <Space style={{ width: '100%', marginBottom: 16 }}>
        <Button
          icon={<GithubOutlined />}
          block
          size="large"
          onClick={async () => {
            try {
              const result = await githubOAuth('dev_github');
              if (result.accessToken) {
                localStorage.setItem('auth_token', result.accessToken);
                if (result.refreshToken) {
                  localStorage.setItem('auth_refresh_token', result.refreshToken);
                }
                setAuth(result.user, null, result.accessToken, result.refreshToken);
              }
              message.success('GitHub 登录成功');
              navigate('/');
            } catch (err) {
              message.error('GitHub OAuth 登录失败');
            }
          }}
        >
          GitHub
        </Button>
        <Button
          icon={<GoogleOutlined />}
          block
          size="large"
          onClick={async () => {
            try {
              const result = await googleOAuth('dev_google');
              if (result.accessToken) {
                localStorage.setItem('auth_token', result.accessToken);
                if (result.refreshToken) {
                  localStorage.setItem('auth_refresh_token', result.refreshToken);
                }
                setAuth(result.user, null, result.accessToken, result.refreshToken);
              }
              message.success('Google 登录成功');
              navigate('/');
            } catch (err) {
              message.error('Google OAuth 登录失败');
            }
          }}
        >
          Google
        </Button>
      </Space>

      <Divider plain style={{ fontSize: 12, color: '#999' }}>
        或使用邮箱登录
      </Divider>

      <Form<LoginFormValues>
        name="login"
        layout="vertical"
        requiredMark="optional"
        onFinish={onFinish}
        autoComplete="off"
        disabled={isLocked}
      >
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <Button type="link" onClick={handleForgotPassword} style={{ padding: 0 }}>
              忘记密码？
            </Button>
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loginMutation.isPending}
            disabled={isLocked}
          >
            {isLocked ? '账号已锁定' : '登录'}
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        <Space>
          <Text type="secondary">还没有账号？</Text>
          <Link to="/auth/register">立即注册</Link>
        </Space>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
