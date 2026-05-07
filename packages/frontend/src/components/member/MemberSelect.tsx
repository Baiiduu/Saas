import React from 'react';
import { Select, Space } from 'antd';
import { useTeamMembers } from '@/hooks/useTenant';
import MemberAvatar from './MemberAvatar';
import type { ITeamMember } from '@saas/shared-types';

interface TeamMemberRecord extends ITeamMember {
  displayName?: string;
  avatarUrl?: string;
}

export interface MemberSelectProps {
  teamId: string;
  value?: string;
  onChange?: (userId: string) => void;
  placeholder?: string;
  excludeIds?: string[];
}

const MemberSelect: React.FC<MemberSelectProps> = ({
  teamId,
  value,
  onChange,
  placeholder = '选择成员',
  excludeIds = [],
}) => {
  const { data: members = [], isLoading } = useTeamMembers(teamId);

  const filteredMembers = members.filter(
    (m) => !excludeIds.includes(m.userId)
  );

  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      loading={isLoading}
      optionFilterProp="label"
      style={{ width: '100%' }}
    >
      {(filteredMembers as TeamMemberRecord[]).map((member) => (
        <Select.Option
          key={member.userId}
          value={member.userId}
          label={member.displayName ?? member.userId}
        >
          <Space>
            <MemberAvatar
              user={{
                displayName: member.displayName ?? '?',
                avatarUrl: member.avatarUrl,
              }}
              size={24}
            />
            <span>
              {member.displayName ?? member.userId}
            </span>
          </Space>
        </Select.Option>
      ))}
    </Select>
  );
};

export default MemberSelect;
