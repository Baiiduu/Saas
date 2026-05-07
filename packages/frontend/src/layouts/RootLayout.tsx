import React from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import Sidebar from '@/components/layout/Sidebar';
import HeaderBar from '@/components/layout/Header';
import BreadcrumbNav from '@/components/layout/Breadcrumb';

const { Content, Sider } = Layout;

/**
 * RootLayout - The main authenticated application layout.
 * Includes collapsible sidebar, top header bar, breadcrumb navigation,
 * and an <Outlet /> for page content.
 */
const RootLayout: React.FC = () => {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        breakpoint="lg"
        collapsedWidth={80}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Sidebar />
      </Sider>

      {/* Main area */}
      <Layout
        style={{
          marginLeft: sidebarCollapsed ? 80 : 240,
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
        }}
      >
        {/* Top header */}
        <HeaderBar />

        {/* Breadcrumb */}
        <div style={{ padding: '12px 24px 0' }}>
          <BreadcrumbNav />
        </div>

        {/* Page content */}
        <Content
          style={{
            padding: 24,
            margin: 0,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default RootLayout;
