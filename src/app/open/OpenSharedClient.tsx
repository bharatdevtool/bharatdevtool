'use client';

import React, { useRef, useState } from 'react';
import { FileLock2, ShieldCheck, Upload } from 'lucide-react';
import SecureViewer from '@/components/pdf/SecureViewer';
import { engine } from '@/components/pdf/engine-loader';
import ErrorMessage from '@/components/ui/ErrorMessage';

/** /open: the recipient picks the protected PDF (or an older .bdtpdf) and it opens in the secure viewer. */
export default function OpenSharedClient() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Uint8Array | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const E = await engine();
      // Check here so an ordinary PDF gets a clear message instead of an empty viewer.
      await E.extractShare(bytes);
      setFile(bytes);
    } catch {
      setError('This file is not a protected PDF from Bharat Dev Tools. If it is a normal PDF, open it in any PDF app.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {file && <SecureViewer file={file} engine={engine} onClose={() => setFile(null)} />}
      <div className="text-center">
        <FileLock2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Open a protected PDF</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose the PDF someone shared with you. It opens here until the expiry date they picked.</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
      >
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf,.bdtpdf"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? 'Opening…' : 'Choose the PDF'}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">or drop it here</p>
      </div>

      <div className="mt-4">
        <ErrorMessage message={error} onDismiss={() => setError('')} />
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Decrypted on your device. Nothing is uploaded.
      </p>
      <p className="mt-8 text-center text-sm">
        <a href="/share-pdf-with-expiry" className="font-medium text-primary hover:underline">Send your own PDF that stops opening after a date →</a>
      </p>
    </div>
  );
}
