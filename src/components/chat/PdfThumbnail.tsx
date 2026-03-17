import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

interface PdfThumbnailProps {
  url: string;
  className?: string;
  onPageCount?: (count: number) => void;
}

export default function PdfThumbnail({ url, className = '', onPageCount }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        if (!cancelled) onPageCount?.(pdf.numPages);
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render at a reasonable thumbnail size
        const targetWidth = 280;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url]);

  if (status === 'error') {
    return (
      <div className={`flex items-center justify-center bg-black/5 rounded-t-lg h-32 ${className}`}>
        <FileText className="h-10 w-10 text-whatsapp-muted/40" />
      </div>
    );
  }

  return (
    <div className={`relative rounded-t-lg overflow-hidden bg-white ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-48 object-contain"
        style={{ display: status === 'done' ? 'block' : 'none' }}
      />
      {status === 'loading' && (
        <div className="flex items-center justify-center h-32">
          <div className="h-5 w-5 border-2 border-whatsapp-muted/30 border-t-whatsapp-muted rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
