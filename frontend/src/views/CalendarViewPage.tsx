import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarView } from '../components/calendar/CalendarView';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer';
import type { Task } from '../types';
import * as taskService from '../services/tasks';
import { useAuth } from '../context/AuthContext';
import type { LayoutContextType } from '../components/layout/AppLayout';

export const CalendarViewPage: React.FC = () => {
  const { user } = useAuth();
  const { openNewTaskModal } = useOutletContext<LayoutContextType>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', user?.id, 'calendar'],
    queryFn: () =>
      taskService.getTasks({
        user_id: user?.id,
        limit: 200,
      }),
  });

  const tasks = tasksData?.items || [];

  return (
    <div>
      <CalendarView
        tasks={tasks}
        onSelectTask={(task) => setSelectedTask(task)}
        onOpenNewTaskModal={openNewTaskModal}
      />

      <TaskDetailDrawer
        taskId={selectedTask ? selectedTask.id : null}
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
};
