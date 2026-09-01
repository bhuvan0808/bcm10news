'use client';

import { useCallback, useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES, type MediaKind } from '@bcm10/validation';
import { Button, cn } from '@bcm10/ui';
import { confirmUpload, requestUpload } from '@/lib/actions/media';
import { ADMIN } from '@/lib/site';

/**
 * Direct-to-storage upload.
 *
 * The browser never posts the file to this app. It asks the server for a
 * signed URL, PUTs the bytes to R2 itself, then tells the server it is done.
 * On a district 3G connection that halves the reporter's upload time, and it
 * keeps a 20 MB camera file out of a serverless function's memory.
 *
 * Two things are measured client-side before the upload starts, because the
 * browser already has the decoded image and the server would have to download
 * it back to find out:
 *
 *  • intrinsic width and height, so the article page can reserve space and
 *    avoid layout shift
 *  • a tiny blurred placeholder, so a card shows something immediately
 */
export interface UploadedImage {
  mediaId: string;
  storageKey: string;
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  alt: string;
}

type Phase = 'idle' | 'preparing' | 'uploading' | 'finishing' | 'error';

export function ImageUploader({
  kind = 'image',
  onUploaded,
  label = 'Upload image',
  className,
}: {
  kind?: MediaKind;
  onUploaded: (image: UploadedImage) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPhase('preparing');
      setProgress(0);

      // Fail fast on size, before a ticket is issued or a byte is sent.
      const max = MAX_UPLOAD_BYTES[kind];
      if (file.size > max) {
        setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(max)}.`);
        setPhase('error');
        return;
      }

      try {
        const measured = await measureImage(file);

        const ticket = await requestUpload({
          kind,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });

        if (!ticket.ok || !ticket.data) {
          setError(ticket.message ?? 'Could not start the upload.');
          setPhase('error');
          return;
        }

        setPhase('uploading');
        await putWithProgress(ticket.data.uploadUrl, file, ticket.data.headers, setProgress);

        setPhase('finishing');
        const confirmed = await confirmUpload({
          ticketId: ticket.data.ticketId,
          width: measured?.width,
          height: measured?.height,
          blurDataUrl: measured?.blurDataUrl ?? undefined,
        });

        if (!confirmed.ok || !confirmed.data) {
          setError(confirmed.message ?? 'The upload did not complete.');
          setPhase('error');
          return;
        }

        onUploaded({
          mediaId: confirmed.data.mediaId,
          storageKey: ticket.data.storageKey,
          url: `${ADMIN.mediaBaseUrl}/${ticket.data.storageKey}`,
          width: measured?.width ?? 0,
          height: measured?.height ?? 0,
          blurDataUrl: measured?.blurDataUrl ?? null,
          alt: '',
        });

        setPhase('idle');
        setProgress(0);
        if (inputRef.current) inputRef.current.value = '';
      } catch (cause) {
        console.error('Upload failed', cause);
        setError('The upload failed. Check your connection and try again.');
        setPhase('error');
      }
    },
    [kind, onUploaded]
  );

  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'finishing';

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'document' ? 'application/pdf' : 'image/*'}
        // `capture` is intentionally absent: a reporter usually wants to pick
        // a photo they already took, and forcing the camera hides the gallery.
        className="sr-only"
        id={`upload-${kind}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        loading={busy}
        className="w-full"
      >
        {busy ? PHASE_LABEL[phase] : label}
      </Button>

      {phase === 'uploading' ? (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
          className="h-1 w-full overflow-hidden rounded-full bg-paper-sunk"
        >
          <div
            className="h-full bg-brand transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  finishing: 'Finishing…',
  error: '',
};

/**
 * PUT with progress.
 *
 * XMLHttpRequest rather than fetch: fetch still has no upload progress event
 * in browsers, and on a slow connection a reporter staring at a frozen button
 * will assume it broke and retry, doubling the traffic.
 */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url, true);

    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Storage responded ${request.status}`));
    });

    request.addEventListener('error', () => reject(new Error('Network error during upload')));
    request.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    request.send(file);
  });
}

interface Measured {
  width: number;
  height: number;
  blurDataUrl: string | null;
}

/**
 * Reads the intrinsic size and renders a 16px-wide blurred thumbnail.
 *
 * Done here because the browser has already decoded the image; asking the
 * server for this would mean downloading the file back out of storage.
 */
async function measureImage(file: File): Promise<Measured | null> {
  if (!file.type.startsWith('image/')) return null;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    let blurDataUrl: string | null = null;

    try {
      const canvas = document.createElement('canvas');
      const targetWidth = 16;
      canvas.width = targetWidth;
      canvas.height = Math.max(1, Math.round((height / width) * targetWidth));

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        blurDataUrl = canvas.toDataURL('image/webp', 0.5);
      }
    } catch {
      // A tainted or oversized canvas just means no placeholder; not fatal.
    }

    return { width, height, blurDataUrl };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that image'));
    image.src = src;
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
