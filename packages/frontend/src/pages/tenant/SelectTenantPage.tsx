import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Row, Col, Tag, Typography, Spin, Empty, Space } from 'antd';
import { PlusOutlined, TeamOutlined, BankOutlined, TagOutlined } from '@ant-design/icons';
import { useTenants } from '@/hooks/useTenant';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { orgPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import type { ITenant } from '@saas/shared-types';

const { Title, Text } = Typography;

const SelectTenantPage: React.FC = () => {
  const navigate = useNavigate();
  const setCurrentTenant = useWorkspaceStore((s) => s.setCurrentTenant);
  const { data: tenants, isLoading, isError, error } = useTenants();

  const handleSelectTenant = (tenant: ITenant) => {
    setCurrentTenant(tenant);
    navigate(orgPath(tenant.id));
  };

  const handleCreateTenant = () => {
    navigate('/create-tenant');
  };

  if (isLoading) {
    return <Loading tip="加载企业中..." />;
  }

  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取企业列表失败，请稍后重试'}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          <BankOutlined style={{ marginRight: 8 }} />
          选择企业
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTenant}>
          创建新企业
        </Button>
      </div>

      {(!tenants || tenants.length === 0) ? (
        <EmptyState
          title="暂无企业"
          description="您还没有加入任何企业，请创建一个新企业"
          actionText="创建新企业"
          onAction={handleCreateTenant}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {tenants.map((tenant) => (
            <Col xs={24} sm={12} md={8} lg={6} key={tenant.id}>
              <Card
                hoverable
                onClick={() => handleSelectTenant(tenant)}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <TeamOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </div>
                <Title level={5} style={{ textAlign: 'center', marginBottom: 8 }}>
                  {tenant.name}
                </Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {tenant.industry && (
                    <div>
                      <TagOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
                      <Text type="secondary">{tenant.industry}</Text>
                    </div>
                  )}
                  {tenant.scale && (
                    <div>
                      <Tag color="blue">{tenant.scale}</Tag>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default SelectTenantPage;
