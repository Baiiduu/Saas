import React from 'react';
import { Card, Statistic, Typography, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  loading = false,
  trend,
  trendValue,
  color,
  icon,
  onClick,
}) => {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        borderRadius: 8,
        ...(color ? { borderTop: `3px solid ${color}` } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1 }}>
          <Statistic
            title={title}
            value={value}
            prefix={prefix}
            suffix={suffix}
            loading={loading}
            valueStyle={{ fontSize: 28, fontWeight: 600, color: color || undefined }}
          />
          {trend && trendValue && (
            <div style={{ marginTop: 8 }}>
              <Space>
                {trend === 'up' && (
                  <Text type="success" style={{ fontSize: 12 }}>
                    <ArrowUpOutlined /> {trendValue}
                  </Text>
                )}
                {trend === 'down' && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    <ArrowDownOutlined /> {trendValue}
                  </Text>
                )}
                {trend === 'neutral' && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {trendValue}
                  </Text>
                )}
              </Space>
            </div>
          )}
        </div>
        {icon && (
          <div style={{ fontSize: 32, opacity: 0.15, color: color || '#1890ff' }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
