import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import { Alert, Button, Card, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { TaskStatus } from '@saas/shared-types';
import { useTasks } from '@/hooks/useTasks';
import { teamSubPath } from '@/router/routes';
import Loading from '@/components/common/Loading';
import EmptyState from '@/components/common/EmptyState';
import './taskViews.css';

const { Title, Text } = Typography;

const statusMeta: Record<
  TaskStatus,
  { label: string; color: string; badgeColor: string }
> = {
  [TaskStatus.TODO]: {
    label: '待办',
    color: '#7c8799',
    badgeColor: 'default',
  },
  [TaskStatus.IN_PROGRESS]: {
    label: '进行中',
    color: '#2b6cf6',
    badgeColor: 'processing',
  },
  [TaskStatus.DONE]: {
    label: '已完成',
    color: '#1f9d55',
    badgeColor: 'success',
  },
  [TaskStatus.CLOSED]: {
    label: '已关闭',
    color: '#c9861a',
    badgeColor: 'warning',
  },
};

const CalendarPage: React.FC = () => {
  const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useTasks({
    teamId,
    limit: 300,
    sortBy: 'dueDate',
    sortOrder: 'asc',
  });

  const events = useMemo<EventInput[]>(() => {
    return (data?.items ?? [])
      .filter((task) => task.dueDate)
      .map((task) => {
        const meta = statusMeta[task.status];

        return {
          id: task.id,
          title: task.title,
          start: task.dueDate!,
          allDay: true,
          backgroundColor: `${meta.color}18`,
          borderColor: meta.color,
          textColor: '#14213d',
          extendedProps: {
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
          },
        } satisfies EventInput;
      });
  }, [data]);

  const handleBack = () => {
    if (orgId && teamId) {
      navigate(teamSubPath(orgId, teamId, 'board'));
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    if (!orgId || !teamId) {
      return;
    }

    navigate(teamSubPath(orgId, teamId, `tasks/${arg.event.id}`));
  };

  if (!orgId || !teamId) return null;
  if (isLoading) return <Loading tip="加载日历..." />;
  if (isError) {
    return (
      <EmptyState
        title="加载失败"
        description={(error as Error)?.message || '获取任务数据失败'}
      />
    );
  }

  return (
    <div className="task-view-page">
      <div className="task-view-header">
        <Space size={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回看板
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              日历视图
            </Title>
            <Text type="secondary">
              展示所有具备截止日期的任务，支持月、周、日和清单视图。
            </Text>
          </div>
        </Space>
        <Space size={8} wrap>
          {Object.entries(statusMeta).map(([status, meta]) => (
            <Tag key={status} color={meta.badgeColor}>
              {meta.label}
            </Tag>
          ))}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        className="task-view-alert"
        message="日历仅展示带有截止日期的任务。点击事件可直接进入任务详情。"
      />

      {events.length === 0 ? (
        <EmptyState title="暂无日历数据" description="请先为任务设置截止日期。" />
      ) : (
        <Card className="task-calendar-shell" bordered={false}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            locale={zhCnLocale}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: '今天',
              month: '月',
              week: '周',
              day: '日',
              list: '清单',
            }}
            height="auto"
            expandRows
            dayMaxEvents={4}
            eventDisplay="block"
            eventClick={handleEventClick}
            events={events}
            firstDay={1}
          />
        </Card>
      )}
    </div>
  );
};

export default CalendarPage;
