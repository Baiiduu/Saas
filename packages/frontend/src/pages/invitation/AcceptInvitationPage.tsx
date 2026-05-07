import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Result, Button, Spin, Typography, Space } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoginOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAcceptInvitation } from '@/hooks/useTeams';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/router/routes';

const { Text } = Typography;

type PageState = 'checking' | 'accepting' | 'success' | 'error' | 'not_authenticated';

const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const acceptInvitation = useAcceptInvitation();

  const [pageState, setPageState] = useState<PageState>('checking');
  const [result, setResult] = useState<{ teamId?: string; teamName?: string }>({});
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('error');
      setErrorMessage('邀请链接无效：缺少邀请令牌');
      return;
    }

    if (!isAuthenticated) {
      setPageState('not_authenticated');
      return;
    }

    // User is authenticated — auto-accept
    setPageState('accepting');
    acceptInvitation.mutateAsync(token).then(
      (data) => {
        setResult({ teamId: data.teamId, teamName: data.teamName });
        setPageState('success');
      },
      (err: unknown) => {
        const errorObj = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        setErrorMessage(
          errorObj.response?.data?.message ||
            errorObj.message ||
            '邀请无效或已过期，请确认链接是否正确'
        );
        setPageState('error');
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated]);

  // Not authenticated — show login prompt
  if (pageState === 'not_authenticated') {
    const loginUrl = `${ROUTES.AUTH.LOGIN}?redirect=${encodeURIComponent(window.location.pathname)}`;
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f5f5f5',
        }}
      >
        <Result
          icon={<TeamOutlined style={{ color: '#1890ff' }} />}
          title="接受团队邀请"
          subTitle={
            <Space direction="vertical" size={8}>
              <Text>您需要先登录才能接受此邀请</Text>
              <Text type="secondary" style={{ fontSize: 14 }}>
                登录后将自动完成邀请确认
              </Text>
            </Space>
          }
          extra={
            <Link to={loginUrl}>
              <Button type="primary" size="large" icon={<LoginOutlined />}>
                请先登录
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Loading state
  if (pageState === 'checking' || pageState === 'accepting') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f5f5f5',
        }}
      >
        <Spin
          size="large"
          tip={pageState === 'accepting' ? '正在接受邀请...' : '正在验证...'}
        >
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  // Success
  if (pageState === 'success') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f5f5f5',
        }}
      >
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="加入团队成功！"
          subTitle={`您已成功加入团队「${result.teamName || '未知'}」`}
          extra={
            <Button
              type="primary"
              size="large"
              icon={<TeamOutlined />}
              onClick={() => {
                // Navigate to the team page if org context is available,
                // otherwise navigate to home
                if (result.teamId) {
                  navigate('/');
                } else {
                  navigate('/');
                }
              }}
            >
              进入团队
            </Button>
          }
        />
      </div>
    );
  }

  // Error state
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <Result
        status="error"
        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        title="邀请无效或已过期"
        subTitle={errorMessage}
        extra={
          <Space>
            <Button onClick={() => navigate('/')}>返回首页</Button>
            <Button type="primary" onClick={() => navigate('/auth/login')}>
              前往登录
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default AcceptInvitationPage;
