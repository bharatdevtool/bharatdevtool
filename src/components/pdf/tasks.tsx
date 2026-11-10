import React from 'react';
import { getToolById } from '@/config/tools';
import {
  FileArchive, Combine, Scissors, LayoutGrid, FileImage, ImagePlus, Lock, LockOpen,
  FilePen, FileSignature, SquareDashed, Stamp, ListOrdered, Contrast, Info, Hourglass,
} from 'lucide-react';

export type PdfTask =
  | 'compress' | 'merge' | 'split' | 'organize' | 'pdf-to-jpg' | 'jpg-to-pdf' | 'protect' | 'unlock'
  | 'edit' | 'sign' | 'redact' | 'watermark' | 'page-numbers' | 'grayscale' | 'metadata' | 'secure-share';

export type TaskGroup = 'Organize' | 'Optimize' | 'Convert' | 'Edit' | 'Security';

export interface TaskInfo {
  id: PdfTask;
  toolId: string;
  group: TaskGroup;
  /** Name in the sidebar and the options panel. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Main button text. */
  action: string;
  /** One line under the options panel title. */
  hint: string;
  /** Highlighted in the sidebar (animated icon + "New" badge). */
  isNew?: boolean;
}

export const TASKS: TaskInfo[] = [
  { id: 'merge', toolId: 'merge-pdf', group: 'Organize', label: 'Merge PDF', icon: Combine, action: 'Merge into one PDF', hint: 'Put the pages in order, then save them as one PDF.' },
  { id: 'split', toolId: 'split-pdf', group: 'Organize', label: 'Split PDF', icon: Scissors, action: 'Split PDF', hint: 'Extract some pages, or split into several files.' },
  { id: 'organize', toolId: 'organize-pdf', group: 'Organize', label: 'Organize PDF', icon: LayoutGrid, action: 'Save PDF', hint: 'Drag to reorder, rotate or delete pages.' },
  { id: 'compress', toolId: 'compress-pdf', group: 'Optimize', label: 'Compress PDF', icon: FileArchive, action: 'Compress PDF', hint: 'Make the file smaller, or fit an exact size.' },
  { id: 'grayscale', toolId: 'grayscale-pdf', group: 'Optimize', label: 'Grayscale PDF', icon: Contrast, action: 'Convert to grayscale', hint: 'Turn a colour PDF into black and white.' },
  { id: 'jpg-to-pdf', toolId: 'jpg-to-pdf', group: 'Convert', label: 'JPG to PDF', icon: ImagePlus, action: 'Create PDF', hint: 'Turn photos and scans into one PDF.' },
  { id: 'pdf-to-jpg', toolId: 'pdf-to-jpg', group: 'Convert', label: 'PDF to JPG', icon: FileImage, action: 'Convert to images', hint: 'Save pages as JPG, PNG or WebP images.' },
  { id: 'edit', toolId: 'edit-pdf', group: 'Edit', label: 'Edit PDF', icon: FilePen, action: 'Save PDF', hint: 'Add text, images, white-out and shapes, or fill in forms.' },
  { id: 'sign', toolId: 'sign-pdf', group: 'Edit', label: 'Sign PDF', icon: FileSignature, action: 'Save signed PDF', hint: 'Draw, type or upload your signature and place it.' },
  { id: 'redact', toolId: 'redact-pdf', group: 'Edit', label: 'Redact PDF', icon: SquareDashed, action: 'Save redacted PDF', hint: 'Black out Aadhaar, PAN, phone numbers or anything else.' },
  { id: 'watermark', toolId: 'watermark-pdf', group: 'Edit', label: 'Watermark PDF', icon: Stamp, action: 'Add watermark', hint: 'Stamp text or a logo on every page.' },
  { id: 'page-numbers', toolId: 'add-page-numbers', group: 'Edit', label: 'Add page numbers', icon: ListOrdered, action: 'Add page numbers', hint: 'Choose where the numbers go and how they look.' },
  { id: 'metadata', toolId: 'pdf-metadata', group: 'Edit', label: 'PDF metadata', icon: Info, action: 'Save PDF', hint: 'Change the title and author, or remove hidden details.' },
  { id: 'protect', toolId: 'protect-pdf', group: 'Security', label: 'Protect PDF', icon: Lock, action: 'Protect PDF', hint: 'Add a password (AES-256).' },
  { id: 'unlock', toolId: 'unlock-pdf', group: 'Security', label: 'Unlock PDF', icon: LockOpen, action: 'Unlock PDF', hint: 'Save a copy that opens without the password.' },
  { id: 'secure-share', toolId: 'secure-share-pdf', group: 'Security', label: 'Share with expiry', icon: Hourglass, isNew: true, action: 'Create secure file', hint: 'Share a PDF that stops opening after a date you choose.' },
];

export const TASK_GROUPS: TaskGroup[] = ['Organize', 'Optimize', 'Convert', 'Edit', 'Security'];
export const EDITOR_TASKS: PdfTask[] = ['edit', 'sign', 'redact'];

export const taskInfo = (task: PdfTask): TaskInfo => TASKS.find((t) => t.id === task)!;
/** The tool's own page (from the registry, e.g. /compress-pdf or /pdf-editor). */
export const taskRoute = (task: PdfTask) => getToolById(taskInfo(task).toolId)?.route ?? `/${taskInfo(task).toolId}`;
