// Password-protect a PDF (AES-256 or AES-128). Pure: runs in Node and the browser.

import { PDFDocument } from '@cantoo/pdf-lib';
import { ALL_PERMISSIONS, type PdfEncryption, type PdfPermissions } from './options';

export { passwordProblem, passwordStrength, ownerPasswordProblem, ALL_PERMISSIONS, PERMISSION_LABELS } from './options';
export type { PdfEncryption, PdfPermissions } from './options';

export interface ProtectOptions {
  /** Password needed to open the file. */
  openPassword: string;
  /**
   * Admin (owner) password that lifts the restrictions in readers that support it.
   * Empty = a random one nobody knows, so the restrictions can't be lifted by guessing.
   */
  ownerPassword?: string;
  /** Default AES-256. AES-128 only for very old readers (Acrobat 7, 2005). */
  algorithm?: PdfEncryption;
  /** What someone who opens it with the open password may do. Default: everything. */
  permissions?: Partial<PdfPermissions>;
}

function randomOwnerPassword(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encrypt an (unencrypted) PDF. */
export async function protectPdf(pdfBytes: Uint8Array, options: ProtectOptions): Promise<Uint8Array> {
  if (!options.openPassword) throw new Error('A password is required.');
  const p: PdfPermissions = { ...ALL_PERMISSIONS, ...options.permissions };
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  doc.encrypt({
    userPassword: options.openPassword,
    ownerPassword: options.ownerPassword || randomOwnerPassword(),
    algorithm: options.algorithm ?? 'AES-256',
    permissions: {
      printing: p.print ? (p.printHighRes ? 'highResolution' : 'lowResolution') : false,
      copying: p.copy,
      contentAccessibility: true, // screen readers keep working
      modifying: p.modify,
      annotating: p.comment,
      fillingForms: p.fillForms,
      documentAssembly: p.assemble,
    },
  });
  return doc.save();
}
