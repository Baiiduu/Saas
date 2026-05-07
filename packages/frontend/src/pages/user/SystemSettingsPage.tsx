import React from 'react';
import { Card, Space, Switch, Typography, Radio, Divider } from 'antd';
import { SettingOutlined, BulbOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { useUIStore } from '@/stores/uiStore';

const { Title, Text } = Typography;

const SystemSettingsPage: React.FC = () => {
  const themeMode = useUIStore((state) => state.themeMode);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        系统设置
      </Title>

      <Card>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div>
            <Space style={{ marginBottom: 12 }}>
              <BulbOutlined />
              <Text strong>外观模式</Text>
            </Space>
            <div>
              <Radio.Group
                value={themeMode}
                onChange={(event) => setThemeMode(event.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="light">亮色</Radio.Button>
                <Radio.Button value="dark">暗色</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <Divider style={{ margin: 0 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <MenuFoldOutlined />
              <div>
                <Text strong>默认收起侧边栏</Text>
                <br />
                <Text type="secondary">控制当前工作台左侧导航栏的展开状态。</Text>
              </div>
            </Space>
            <Switch checked={sidebarCollapsed} onChange={setSidebarCollapsed} />
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
