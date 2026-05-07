import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthGuard, TenantGuard, PermissionGuard } from './guards';
import { orgPath } from '@/router/routes';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// T-14 parallel task: auth pages and layout
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ActivatePage from '@/pages/auth/ActivatePage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';

// T-16: Tenant & Team pages
import SelectTenantPage from '@/pages/tenant/SelectTenantPage';
import CreateTenantPage from '@/pages/tenant/CreateTenantPage';
import TenantSettingsPage from '@/pages/tenant/TenantSettingsPage';
import TeamDashboard from '@/pages/team/TeamDashboard';
import TeamSettings from '@/pages/team/TeamSettings';
import TeamMembers from '@/pages/team/TeamMembers';
import TeamDiscovery from '@/pages/team/TeamDiscovery';
import AcceptInvitationPage from '@/pages/invitation/AcceptInvitationPage';

import RootLayout from '@/layouts/RootLayout';
import TeamLayout from '@/layouts/TeamLayout';

// T-17: Task pages
import TaskListPage from '@/pages/task/TaskListPage';
import TaskDetailPage from '@/pages/task/TaskDetailPage';
import BoardPage from '@/pages/task/BoardPage';
// T-41: Gantt + Calendar views
import GanttPage from '@/pages/task/GanttPage';
import CalendarPage from '@/pages/task/CalendarPage';

// T-18: Document pages
import DocumentCenterPage from '@/pages/document/DocumentCenterPage';
import DocumentPreviewPage from '@/pages/document/DocumentPreviewPage';
// T-42: Document editor
import DocumentEditorPage from '@/pages/document/DocumentEditorPage';

// T-19: Approval pages
import ApprovalListPage from '@/pages/approval/ApprovalListPage';
import ApprovalDetailPage from '@/pages/approval/ApprovalDetailPage';
// T-43: Approval template
import ApprovalTemplatePage from '@/pages/approval/ApprovalTemplatePage';

// T-20: Notification page
import NotificationCenterPage from '@/pages/notification/NotificationCenterPage';

// T-21: User pages
import ProfilePage from '@/pages/user/ProfilePage';
import UserStatsPage from '@/pages/user/UserStatsPage';
import SystemSettingsPage from '@/pages/user/SystemSettingsPage';

// T-44: Resource graph page
import ResourceGraphPage from '@/pages/graph/ResourceGraphPage';

// T-45: Milestone page
import MilestonePage from '@/pages/milestone/MilestonePage';

// T-46: Team chat page
import TeamChatPage from '@/pages/message/TeamChatPage';

// T-47: Dashboard page
import DashboardPage from '@/pages/dashboard/DashboardPage';

// T-48: Audit log page
import AuditLogPage from '@/pages/audit/AuditLogPage';

// T-51: LLM chat page
import ChatPage from '@/pages/llm/ChatPage';

// 404 page
import NotFoundPage from '@/pages/error/NotFoundPage';

/**
 * OrgRedirect - Redirects based on currentTenant state.
 * If user has a currentTenant, redirect to /org/:orgId.
 * If no currentTenant, redirect to / (tenant selection).
 */
const OrgRedirect: React.FC = () => {
  const currentTenant = useWorkspaceStore((s) => s.currentTenant);
  if (currentTenant) {
    return <Navigate to={orgPath(currentTenant.id)} replace />;
  }
  return <Navigate to="/" replace />;
};

/**
 * AppRouter - The complete application route tree.
 * Auth routes are unprotected; all other routes require authentication.
 * Routes under /org/:orgId additionally require an active tenant context.
 */
export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* ===================== Public routes (no auth required) ===================== */}
      <Route path="/invitations/:token/accept" element={<AcceptInvitationPage />} />

      {/* ===================== Auth routes (no guard) ===================== */}
      <Route>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/activate" element={<ActivatePage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ===================== Protected routes ===================== */}
      <Route element={<AuthGuard />}>
        <Route element={<RootLayout />}>
          {/* --- No tenant required --- */}
          <Route path="/" element={<SelectTenantPage />} />
          <Route path="/create-tenant" element={<CreateTenantPage />} />
          {/* /org - redirects based on tenant state (must be before TenantGuard) */}
          <Route path="/org" element={<OrgRedirect />} />
          <Route path="/user/profile" element={<ProfilePage />} />
          <Route path="/user/settings" element={<SystemSettingsPage />} />
          <Route path="/notifications" element={<NotificationCenterPage />} />
          <Route path="/user/stats" element={<UserStatsPage />} />

          {/* --- Tenant required --- */}
          <Route element={<TenantGuard />}>
            <Route path="/org/:orgId" element={<TeamDashboard />} />
            <Route path="/org/:orgId/teams" element={<TeamDiscovery />} />
            <Route
              path="/org/:orgId/settings"
              element={
                <PermissionGuard
                  operations={['tenant.update']}
                  redirectTo="__FORBIDDEN__"
                >
                  <TenantSettingsPage />
                </PermissionGuard>
              }
            />

            {/* T-48: Audit log route */}
            <Route path="/org/:orgId/audit" element={<AuditLogPage />} />

            <Route path="/org/:orgId/team/:teamId" element={<TeamLayout />}>
              <Route index element={<DashboardPage />} />
              {/* T-17: Task routes */}
              <Route path="tasks" element={<TaskListPage />} />
              <Route path="tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="board" element={<BoardPage />} />
              {/* T-41: Gantt + Calendar */}
              <Route path="gantt" element={<GanttPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              {/* T-18: Document routes */}
              <Route path="documents" element={<DocumentCenterPage />} />
              <Route path="documents/:docId" element={<DocumentPreviewPage />} />
              {/* T-42: Document edit route */}
              <Route path="documents/:docId/edit" element={<DocumentEditorPage />} />
              {/* T-19: Approval routes */}
              <Route path="approvals" element={<ApprovalListPage />} />
              <Route path="approvals/new" element={<ApprovalListPage />} />
              <Route path="approvals/:approvalId" element={<ApprovalDetailPage />} />
              {/* T-43: Approval template route */}
              <Route path="approvals/templates" element={<ApprovalTemplatePage />} />
              {/* T-46: Team chat route */}
              <Route path="messages" element={<TeamChatPage />} />
              {/* T-45: Milestone route */}
              <Route path="milestones" element={<MilestonePage />} />
              {/* T-44: Resource graph route */}
              <Route path="graph" element={<ResourceGraphPage />} />
              <Route path="members" element={<TeamMembers />} />
              <Route
                path="settings"
                element={
                  <PermissionGuard operations={['team.update']}>
                    <TeamSettings />
                  </PermissionGuard>
                }
              />
            </Route>

            {/* T-51: LLM chat route */}
            <Route path="/org/:orgId/llm/chat" element={<ChatPage />} />

            {/* T-20: Notification routes */}
            <Route path="/org/:orgId/notifications" element={<NotificationCenterPage />} />

            {/* T-21: User routes */}
            <Route path="/org/:orgId/user/profile" element={<ProfilePage />} />
            <Route path="/org/:orgId/user/settings" element={<SystemSettingsPage />} />
            <Route path="/org/:orgId/user/stats" element={<UserStatsPage />} />
          </Route>
        </Route>
      </Route>

      {/* ===================== Catch-all 404 ===================== */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
