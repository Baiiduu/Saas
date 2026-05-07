import React, { useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, message, Result, Progress } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons';
import { useRegister } from '@/hooks/useAuth';
import AuthLayout from '@/layouts/AuthLayout';

const { Text } = Typography;

interface RegisterFormValues {
  email: string;
  phone?: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

function getPasswordStrength(password: string): { percent: number; status: 'exception' | 'active' | 'success'; text: string } {
  let score = 0;
  if (password.length >= 6) score += 20;
  if (password.length >= 10) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  if (score < 40) return { percent: score, status: 'exception', text: '弱' };
  if (score < 70) return { percent: score, status: 'active', text: '中' };
  return { percent: score, status: 'success', text: '强' };
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registerMutation = useRegister();
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  const initialEmail = searchParams.get('email') || '';

  const onFinish = useCallback(
    async (values: RegisterFormValues) => {
      try {
        await registerMutation.mutateAsync({
          email: values.email,
          password: values.password,
          displayName: values.displayName,
          phone: values.phone || undefined,
        });
        setRegisteredEmail(values.email);
        setRegistrationSuccess(true);
        message.success('注册成功！');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err.response?.data?.message || err.message || '注册失败，请重试';
        message.error(errorMessage);
      }
    },
    [registerMutation]
  );

  if (registrationSuccess) {
    return (
      <AuthLayout>
        <Result
          status="success"
          title="注册成功！"
          subTitle="请查看您的邮箱获取激活码。"
          extra={[
            <Button
              type="primary"
              key="activate"
              onClick={() => navigate(`/auth/activate?email=${encodeURIComponent(registeredEmail)}`)}
            >
              前往激活
            </Button>,
          ]}
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/auth/login">已有账号？立即登录</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Form<RegisterFormValues>
        name="register"
        layout="vertical"
        requiredMark="optional"
        onFinish={onFinish}
        autoComplete="off"
        initialValues={{ email: initialEmail }}
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
          name="phone"
          label="手机号（选填）"
          rules={[
            {
              pattern: /^(\+?\d{1,3}[-\s]?)?\d{7,15}$/,
              message: '请输入有效的手机号码',
            },
          ]}
        >
          <Input
            prefix={<PhoneOutlined />}
            placeholder="请输入手机号"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="displayName"
          label="显示名称"
          rules={[
            { required: true, message: '请输入显示名称' },
            { min: 2, message: '显示名称至少为 2 个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入显示名称"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码长度至少为 6 个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
            onChange={(e) => setPasswordValue(e.target.value)}
          />
        </Form.Item>

        {passwordValue && (
          <div style={{ marginBottom: 16, marginTop: -8 }}>
            <Progress
              percent={getPasswordStrength(passwordValue).percent}
              status={getPasswordStrength(passwordValue).status}
              showInfo={false}
              size="small"
            />
            <Text
              type={
                getPasswordStrength(passwordValue).status === 'exception'
                  ? 'danger'
                  : getPasswordStrength(passwordValue).status === 'success'
                    ? 'success'
                    : 'warning'
              }
              style={{ fontSize: 12 }}
            >
              密码强度：{getPasswordStrength(passwordValue).text}
            </Text>
          </div>
        )}

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
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
            placeholder="请再次输入密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={registerMutation.isPending}
          >
            注册
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        <Link to="/auth/login">已有账号？立即登录</Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
