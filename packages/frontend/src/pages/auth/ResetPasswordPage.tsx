import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, message, Steps, Result, Alert } from 'antd';
import { MailOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { post } from '@/services/api';
import AuthLayout from '@/layouts/AuthLayout';

const { Text } = Typography;

type ResetStep = 'email' | 'code' | 'password' | 'done';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // Step 1: Request password reset code via email
  const handleRequestCode = useCallback(
    async (values: { email: string }) => {
      setSending(true);
      try {
        const result = await post<{ resetToken?: string }>('/auth/forgot-password', { email: values.email });
        setEmail(values.email);
        setResetToken(result.resetToken ?? '');
        setCodeSent(true);
        setCurrentStep(result.resetToken ? 'password' : 'code');
        message.success('验证码已发送到您的邮箱');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '发送验证码失败，请重试');
      } finally {
        setSending(false);
      }
    },
    []
  );

  // Step 2: Verify the code
  const handleVerifyCode = useCallback(
    async (values: { code: string }) => {
      setVerifying(true);
      try {
        setResetToken(values.code.trim());
        setCodeVerified(true);
        setCurrentStep('password');
        message.success('验证码验证成功');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '验证失败，请重试');
      } finally {
        setVerifying(false);
      }
    },
    [email]
  );

  // Step 3: Set new password
  const handleResetPassword = useCallback(
    async (values: { password: string }) => {
      setResetting(true);
      try {
        await post('/auth/reset-password', {
          token: resetToken,
          newPassword: values.password,
        });
        setCurrentStep('done');
        message.success('密码重置成功');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        message.error(err.response?.data?.message || err.message || '重置密码失败，请重试');
      } finally {
        setResetting(false);
      }
    },
    [resetToken]
  );

  // Step indicator
  const stepCurrentIndex =
    currentStep === 'email' ? 0 : currentStep === 'code' ? 1 : currentStep === 'password' ? 2 : 3;

  return (
    <AuthLayout>
      <Steps
        current={stepCurrentIndex}
        size="small"
        style={{ marginBottom: 32 }}
        items={[
          { title: '验证邮箱' },
          { title: '验证码' },
          { title: '新密码' },
        ]}
      />

      {/* Step 1: Email input */}
      {currentStep === 'email' && (
        <Form
          name="reset-email"
          layout="vertical"
          requiredMark="optional"
          onFinish={handleRequestCode}
          autoComplete="off"
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              请输入您注册时使用的邮箱地址，我们将向该邮箱发送验证码。
            </Text>
          </div>

          <Form.Item
            name="email"
            label="邮箱地址"
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={sending}
            >
              发送验证码
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* Step 2: Code verification */}
      {currentStep === 'code' && (
        <Form
          name="reset-code"
          layout="vertical"
          requiredMark="optional"
          onFinish={handleVerifyCode}
          autoComplete="off"
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`验证码已发送至 ${email}`}
            description="请输入邮件中的 6 位验证码。"
          />

          <Form.Item
            name="code"
            label="重置令牌"
            rules={[
              { required: true, message: '请输入重置令牌' },
              { min: 16, message: '重置令牌格式不正确' },
            ]}
          >
            <Input
              prefix={<KeyOutlined />}
              placeholder="请输入重置令牌"
              size="large"
              style={{ textAlign: 'center' }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={verifying}
            >
              验证
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="link"
              disabled={sending}
              onClick={() => {
                setCurrentStep('email');
                setCodeSent(false);
              }}
            >
              重新输入邮箱
            </Button>
          </div>
        </Form>
      )}

      {/* Step 3: New password */}
      {currentStep === 'password' && (
        <Form
          name="reset-password"
          layout="vertical"
          requiredMark="optional"
          onFinish={handleResetPassword}
          autoComplete="off"
        >
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message="验证通过"
            description="请设置您的新密码。"
          />

          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少为 6 个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={resetting}
            >
              重置密码
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* Step 4: Done */}
      {currentStep === 'done' && (
        <Result
          status="success"
          title="密码重置成功"
          subTitle="您的密码已成功重置，请使用新密码登录。"
          extra={[
            <Button
              type="primary"
              key="login"
              size="large"
              onClick={() => navigate('/auth/login')}
            >
              前往登录
            </Button>,
          ]}
        />
      )}

      {currentStep !== 'done' && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/auth/login">返回登录</Link>
        </div>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
