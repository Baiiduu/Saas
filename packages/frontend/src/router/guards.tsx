import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePermission } from '@/hooks/usePermission';
import { ROUTES } from './routes';

/**
 * AuthGuard - Redirects unauthenticated users to the login page.
 * Place this as a wrapper around all routes that require authentication.
 */
export const AuthGuard: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  return <Outlet />;
};

/**
 * TenantGuard - Redirects users who haven't selected/created a tenant.
 * Place this around routes that require an active tenant context.
 */
export const TenantGuard: React.FC = () => {
  const currentTenant = useWorkspaceStore((state) => state.currentTenant);

  if (!currentTenant) {
    return <Navigate to={ROUTES.TENANT.SELECT} replace />;
  }

  return <Outlet />;
};

/**
 * PermissionGuard - Route-level permission guard.
 *
 * Can be used in two ways:
 * 1. As a layout route wrapping children (with <Outlet />):
 *    <Route element={<PermissionGuard operations={['task.view']} />}>
 *      <Route path="tasks" element={<TaskListPage />} />
 *    </Route>
 *
 * 2. As a component wrapping children directly:
 *    <PermissionGuard operations={['tenant.update']}>
 *      <TenantSettingsPage />
 *    </PermissionGuard>
 *
 * When `redirectTo` is '__FORBIDDEN__', renders a 403 page instead of redirecting.
 */
export const PermissionGuard: React.FC<{
  operations?: string[];
  redirectTo?: string;
  children?: React.ReactNode;
}> = ({
  operations = [],
  redirectTo = ROUTES.TENANT.SELECT,
  children,
}) => {
  const { canAll, isAuthenticated } = usePermission();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  if (operations.length > 0 && !canAll(operations)) {
    // Render a 403 page or redirect
    if (redirectTo === '__FORBIDDEN__') {
      return (
        <Result
          status="403"
          title="403"
          subTitle="抱歉，您没有权限访问此页面。"
          extra={
            <Button type="primary" onClick={() => window.history.back()}>
              返回上一页
            </Button>
          }
        />
      );
    }
    return <Navigate to={redirectTo} replace />;
  }

  // If children are provided, render them. Otherwise use Outlet (layout route pattern).
  return children ? <>{children}</> : <Outlet />;
};
