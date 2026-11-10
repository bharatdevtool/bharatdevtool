'use client';

import React, { useEffect, useState } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import { getToolById } from '@/config/tools';
import { getToolTitle } from '@/config/seo';
import { SITE } from '@/config/site';
import PdfWorkspace, { TASKS, type PdfTask } from './PdfWorkspace';

/**
 * One PDF workspace behind several URLs (/tools/compress-pdf, /tools/merge-pdf, …).
 * Switching task keeps the open files and swaps the heading/FAQ to that task's tool page.
 */
export default function PdfToolClient({ initialTask }: { initialTask: PdfTask }) {
  const [task, setTask] = useState<PdfTask>(initialTask);
  const toolId = TASKS.find((t) => t.id === task)!.toolId;
  // Keep the tab title in step with the task (the URL already changes via replaceState).
  useEffect(() => {
    const tool = getToolById(toolId);
    if (tool) document.title = `${getToolTitle(tool)} | ${SITE.name}`;
  }, [toolId]);
  return (
    <ToolLayout toolId={toolId}>
      <PdfWorkspace task={task} onTaskChange={setTask} />
    </ToolLayout>
  );
}
