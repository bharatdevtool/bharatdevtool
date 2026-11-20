'use client';

import React, { useEffect, useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import { getToolById } from '@/config/tools';
import { getToolTitle, getVariantTitle } from '@/config/seo';
import { getVariant } from '@/config/variants';
import { SITE } from '@/config/site';
import PdfWorkspace, { type PdfPreset } from './PdfWorkspace';
import { ToolMenu, ToolSidebar } from './ToolNav';
import { taskInfo, taskRoute, type PdfTask } from './tasks';

/**
 * One PDF workspace behind many URLs (/compress-pdf, /merge-pdf, …).
 * Switching task keeps the open files and swaps the heading/FAQ to that task's tool page.
 * `initialToolId` lets alias pages (e.g. /image-to-pdf) keep their own heading until the user switches.
 * `variantId` + `preset` power landing pages (src/config/variants.ts) such as /compress-pdf-to-100kb;
 * the variant heading and FAQs stay until the user switches to another task.
 */
export default function PdfToolClient({
  initialTask,
  initialToolId,
  variantId,
  preset,
}: {
  initialTask: PdfTask;
  initialToolId?: string;
  variantId?: string;
  preset?: PdfPreset;
}) {
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

  const activeVariant = variantId && state.task === initialTask ? variantId : undefined;

  // Keep the tab title in step with the task.
  useEffect(() => {
    const variant = activeVariant ? getVariant(activeVariant) : undefined;
    const tool = getToolById(state.toolId);
    if (variant) document.title = `${getVariantTitle(variant)} | ${SITE.name}`;
    else if (tool) document.title = `${getToolTitle(tool)} | ${SITE.name}`;
  }, [state.toolId, activeVariant]);

  return (
    <ToolLayout
      toolId={state.toolId}
      variantId={activeVariant}
      sidebar={<ToolSidebar task={state.task} onPick={switchTask} />}
      headerActions={
        <div className="min-[1180px]:hidden">
          <ToolMenu task={state.task} onPick={switchTask} />
        </div>
      }
    >
      <PdfWorkspace task={state.task} onTaskChange={switchTask} preset={preset} variantId={activeVariant} />
    </ToolLayout>
  );
}
