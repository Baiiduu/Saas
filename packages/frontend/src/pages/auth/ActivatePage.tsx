import React, { useCallback, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Form, Input, Button, message, Result } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useActivate } from '@/hooks/useAuth';
import AuthLayout from '@/layouts/AuthLayout';


interface ActivateFormValues {
  code: string;
}

const ActivatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activateMutation = useActivate();
  const [activationSuccess, setActivationSuccess] = useState(false);

  const email = searchParams.get('email') || '';

  const onFinish = useCallback(
    async (values: ActivateFormValues) => {
      try {
        await activateMutation.mutateAsync({ email, code: values.code });
        setActivationSuccess(true);
        message.success('账号激活成功！');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err.response?.data?.message || err.message || '激活失败，请重试';
        message.error(errorMessage);
      }
    },
    [activateMutation, email]
  );

  if (!email) {
    return (
      <AuthLayout>
        <Result
          status="info"
          title="缺少邮箱信息"
          subTitle="请先注册账号，然后使用注册邮箱进行激活。"
          extra={[
            <Button type="primary" key="register" onClick={() => navigate('/auth/register')}>
              前往注册
            </Button>,
          ]}
        />
      </AuthLayout>
    );
  }

  if (activationSuccess) {
    return (
      <AuthLayout>
        <Result
          status="success"
          title="账号已激活！"
          subTitle={`邮箱 ${email} 已成功激活，现在可以登录了。`}
          extra={[
            <Button type="primary" key="login" onClick={() => navigate('/auth/login')}>
              前往登录
            </Button>,
          ]}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ marginBottom: 16 }}>
        <p style={{ textAlign: 'center', color: '#8c8c8c', margin: 0 }}>
          激活邮件已发送至：
        </p>
        <p style={{ textAlign: 'center', fontWeight: 500, margin: '4px 0 0' }}>
          {email}
        </p>
      </div>

      <Form<ActivateFormValues>
        name="activate"
        layout="vertical"
        requiredMark="optional"
        onFinish={onFinish}
        autoComplete="off"
      >
        <Form.Item
          name="code"
          label="激活码"
          rules={[
            { required: true, message: '请输入激活码' },
            { len: 6, message: '激活码为 6 位数字' },
            { pattern: /^\d{6}$/, message: '激活码必须为 6 位数字' },
          ]}
        >
          <Input
            prefix={<KeyOutlined />}
            placeholder="请输入 6 位激活码"
            size="large"
            maxLength={6}
            style={{ textAlign: 'center', letterSpacing: 8 }}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={activateMutation.isPending}
          >
            激活账号
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        <Link to="/auth/login">已有账号？立即登录</Link>
      </div>
    </AuthLayout>
  );
};

export default ActivatePage;
