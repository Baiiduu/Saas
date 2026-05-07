import React from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

export interface MemberAvatarProps {
  user: { displayName: string; avatarUrl?: string };
  size?: number;
}

const MemberAvatar: React.FC<MemberAvatarProps> = ({ user, size = 32 }) => {
  if (user.avatarUrl) {
    return (
      <Avatar src={user.avatarUrl} size={size} alt={user.displayName} />
    );
  }

  return (
    <Avatar size={size} style={{ backgroundColor: '#1890ff' }}>
      {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserOutlined />}
    </Avatar>
  );
};

export default MemberAvatar;
