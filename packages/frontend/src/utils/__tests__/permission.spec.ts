import { canPerformOperation, getAllowedOperations, getMinimumRoleForOperation } from '../permission';
import { Role } from '@saas/shared-types';

describe('canPerformOperation', () => {
  it('should return true for OWNER performing any operation', () => {
    expect(canPerformOperation(Role.OWNER, 'task.create')).toBe(true);
    expect(canPerformOperation(Role.OWNER, 'tenant.delete')).toBe(true);
    expect(canPerformOperation(Role.OWNER, 'task.view')).toBe(true);
    expect(canPerformOperation(Role.OWNER, 'audit.view')).toBe(true);
  });

  it('should return true for ADMIN performing admin-level operations', () => {
    expect(canPerformOperation(Role.ADMIN, 'tenant.invite')).toBe(true);
    expect(canPerformOperation(Role.ADMIN, 'team.update')).toBe(true);
    expect(canPerformOperation(Role.ADMIN, 'audit.view')).toBe(true);
  });

  it('should return false for ADMIN performing owner-only operations', () => {
    expect(canPerformOperation(Role.ADMIN, 'tenant.delete')).toBe(false);
    expect(canPerformOperation(Role.ADMIN, 'team.delete')).toBe(false);
  });

  it('should return true for LEADER performing leader-level operations', () => {
    expect(canPerformOperation(Role.LEADER, 'task.assign')).toBe(true);
    expect(canPerformOperation(Role.LEADER, 'team.update')).toBe(true);
    expect(canPerformOperation(Role.LEADER, 'member.update')).toBe(true);
    expect(canPerformOperation(Role.LEADER, 'resource.create')).toBe(true);
  });

  it('should return false for LEADER performing admin-level operations', () => {
    expect(canPerformOperation(Role.LEADER, 'team.create')).toBe(false);
    expect(canPerformOperation(Role.LEADER, 'audit.view')).toBe(false);
  });

  it('should return true for MEMBER performing member-level operations', () => {
    expect(canPerformOperation(Role.MEMBER, 'task.create')).toBe(true);
    expect(canPerformOperation(Role.MEMBER, 'task.update')).toBe(true);
    expect(canPerformOperation(Role.MEMBER, 'comment.create')).toBe(true);
    expect(canPerformOperation(Role.MEMBER, 'message.send')).toBe(true);
    expect(canPerformOperation(Role.MEMBER, 'dashboard.view')).toBe(true);
  });

  it('should return false for MEMBER performing leader-level operations', () => {
    expect(canPerformOperation(Role.MEMBER, 'task.delete')).toBe(false);
    expect(canPerformOperation(Role.MEMBER, 'task.assign')).toBe(false);
    expect(canPerformOperation(Role.MEMBER, 'approval.approve')).toBe(false);
    expect(canPerformOperation(Role.MEMBER, 'team.create')).toBe(false);
  });

  it('should return true for READER performing read-only operations', () => {
    expect(canPerformOperation(Role.READER, 'task.view')).toBe(true);
    expect(canPerformOperation(Role.READER, 'document.view')).toBe(true);
  });

  it('should return false for READER performing create/update operations', () => {
    expect(canPerformOperation(Role.READER, 'task.create')).toBe(false);
    expect(canPerformOperation(Role.READER, 'document.create')).toBe(false);
    expect(canPerformOperation(Role.READER, 'comment.create')).toBe(false);
  });

  it('should return false for GUEST performing any operation', () => {
    expect(canPerformOperation(Role.GUEST, 'task.view')).toBe(false);
    expect(canPerformOperation(Role.GUEST, 'task.create')).toBe(false);
    expect(canPerformOperation(Role.GUEST, 'document.view')).toBe(false);
  });

  it('should return false for undefined operations', () => {
    expect(canPerformOperation(Role.OWNER, 'nonexistent.operation')).toBe(false);
  });
});

describe('getAllowedOperations', () => {
  it('should return all operations for OWNER', () => {
    const ops = getAllowedOperations(Role.OWNER);
    // Should include all defined operations
    expect(ops).toContain('tenant.update');
    expect(ops).toContain('tenant.delete');
    expect(ops).toContain('task.create');
    expect(ops).toContain('task.view');
    expect(ops).toContain('audit.view');
    expect(ops.length).toBeGreaterThan(30);
  });

  it('should return a subset of operations for READER', () => {
    const ops = getAllowedOperations(Role.READER);
    expect(ops).toContain('task.view');
    expect(ops).toContain('document.view');
    expect(ops).not.toContain('task.create');
    expect(ops).not.toContain('tenant.update');
  });

  it('should return no operations for GUEST', () => {
    const ops = getAllowedOperations(Role.GUEST);
    expect(ops).toHaveLength(0);
  });

  it('should return appropriate operations for MEMBER', () => {
    const ops = getAllowedOperations(Role.MEMBER);
    expect(ops).toContain('task.create');
    expect(ops).toContain('task.update');
    expect(ops).toContain('comment.create');
    expect(ops).toContain('dashboard.view');
    expect(ops).not.toContain('task.delete');
    expect(ops).not.toContain('task.assign');
  });
});

describe('getMinimumRoleForOperation', () => {
  it('should return the aligned tenant-level minimum roles', () => {
    expect(getMinimumRoleForOperation('tenant.delete')).toBe(Role.OWNER);
    expect(getMinimumRoleForOperation('tenant.update')).toBe(Role.ADMIN);
  });

  it('should return Role.ADMIN for admin-level operations', () => {
    expect(getMinimumRoleForOperation('tenant.invite')).toBe(Role.ADMIN);
    expect(getMinimumRoleForOperation('audit.view')).toBe(Role.ADMIN);
  });

  it('should return Role.LEADER for leader-level operations', () => {
    expect(getMinimumRoleForOperation('task.delete')).toBe(Role.LEADER);
    expect(getMinimumRoleForOperation('task.assign')).toBe(Role.LEADER);
    expect(getMinimumRoleForOperation('approval.approve')).toBe(Role.LEADER);
  });

  it('should return Role.MEMBER for member-level operations', () => {
    expect(getMinimumRoleForOperation('task.create')).toBe(Role.MEMBER);
    expect(getMinimumRoleForOperation('task.update')).toBe(Role.MEMBER);
    expect(getMinimumRoleForOperation('comment.create')).toBe(Role.MEMBER);
  });

  it('should return Role.READER for view operations', () => {
    expect(getMinimumRoleForOperation('task.view')).toBe(Role.READER);
    expect(getMinimumRoleForOperation('document.view')).toBe(Role.READER);
  });

  it('should return undefined for unknown operations', () => {
    expect(getMinimumRoleForOperation('unknown.op')).toBeUndefined();
  });
});
