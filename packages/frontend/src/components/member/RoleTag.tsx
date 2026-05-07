import React from 'react';
import { Tag } from 'antd';
import type { Role } from '@saas/shared-types';

export interface RoleTagProps {
  role: Role;
}

const ROLE_MAP: Record<string, { color: string; label: string }> = {
  owner: { color: 'red', label: '拥有者' },
  admin: { color: 'orange', label: '管理员' },
  leader: { color: 'blue', label: '负责人' },
  member: { color: 'green', label: '成员' },
  reader: { color: 'default', label: '读者' },
  guest: { color: 'default', label: '访客' },
};

const RoleTag: React.FC<RoleTagProps> = ({ role }) => {
  const config = ROLE_MAP[role] ?? { color: 'default', label: role };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default RoleTag;
