import React from 'react';
import { Outlet } from 'react-router-dom';
import { Card, Typography } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface AuthLayoutProps {
  children?: React.ReactNode;
}

/**
 * AuthLayout - Layout wrapper for authentication pages.
 * Renders a centered card with the app logo and header.
 * Supports both direct children (for legacy usage) and
 * Outlet-based rendering when used as a React Router layout route.
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 400 }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <TeamOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 16, marginBottom: 0 }}>
            企业协作平台
          </Title>
        </div>
        {children ?? <Outlet />}
      </Card>
    </div>
  );
};

export default AuthLayout;
