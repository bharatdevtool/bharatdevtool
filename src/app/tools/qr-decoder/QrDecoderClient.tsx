'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';
import ToolLayout from '@/components/layout/ToolLayout';
import CopyButton from '@/components/ui/CopyButton';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import jsQR from 'jsqr';

function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

export default function QrDecoderClient() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const decodeFile = useCallback((file: File) => {
    setError(null);
    setResult(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setResult(code.data);
          analytics.track(ANALYTICS_EVENTS.DECODE_QR);
        } else {
          setError('No QR code found in this image. Try a clearer or higher-resolution image.');
        }
      };
      img.onerror = () => setError('Failed to load image.');
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) decodeFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) decodeFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <ToolLayout toolId="qr-decoder">
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Upload area */}
        <div className="flex flex-col gap-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border bg-muted hover:border-primary/60 hover:bg-muted/70'
            }`}
          >
            <div className="text-3xl">📷</div>
            <p className="text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Click to upload</span> or drag &amp; drop
              <br />
              PNG, JPG, WEBP, GIF supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {previewUrl && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <img
                src={previewUrl}
                alt="Uploaded QR"
                className="max-h-48 w-full rounded-md border border-border object-contain"
              />
            </div>
          )}
        </div>

        {/* Result */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Decoded Result</p>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {result !== null ? (
            <div className="flex flex-col gap-3">
              <div className="min-h-24 rounded-md border border-border bg-muted p-4 font-mono text-sm text-foreground break-all">
                {result}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={result} label="Copy result" />
                {isUrl(result) && (
                  <a
                    href={result}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    🔗 Open Link
                  </a>
                )}
              </div>
            </div>
          ) : (
            !error && (
              <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                Upload a QR code image to decode it
              </div>
            )
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
