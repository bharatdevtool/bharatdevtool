'use client';

import React, { useEffect, useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import { getToolById } from '@/config/tools';
import { getToolTitle } from '@/config/seo';
import { SITE } from '@/config/site';
import PdfWorkspace from './PdfWorkspace';
import { ToolMenu, ToolSidebar } from './ToolNav';
import { taskInfo, taskRoute, type PdfTask } from './tasks';

/**
 * One PDF workspace behind many URLs (/compress-pdf, /merge-pdf, …).
 * Switching task keeps the open files and swaps the heading/FAQ to that task's tool page.
 * `initialToolId` lets alias pages (e.g. /image-to-pdf) keep their own heading until the user switches.
 */
export default function PdfToolClient({ initialTask, initialToolId }: { initialTask: PdfTask; initialToolId?: string }) {
  const [state, setState] = useState<{ task: PdfTask; toolId: string }>({
    task: initialTask,
    toolId: initialToolId ?? taskInfo(initialTask).toolId,
  });

  const switchTask = (task: PdfTask) => {
    if (task === state.task) return;
    setState({ task, toolId: taskInfo(task).toolId });
    // Address bar follows the task, so a refresh or shared link opens the same tool.
    const route = taskRoute(task);
    if (window.location.pathname !== route) window.history.replaceState(null, '', route);
  };

  // Keep the tab title in step with the task.
  useEffect(() => {
    const tool = getToolById(state.toolId);
    if (tool) document.title = `${getToolTitle(tool)} | ${SITE.name}`;
  }, [state.toolId]);

  return (
    <ToolLayout
      toolId={state.toolId}
      sidebar={<ToolSidebar task={state.task} onPick={switchTask} />}
      headerActions={
        <div className="min-[1180px]:hidden">
          <ToolMenu task={state.task} onPick={switchTask} />
        </div>
      }
    >
      <PdfWorkspace task={state.task} onTaskChange={switchTask} />
    </ToolLayout>
  );
}
