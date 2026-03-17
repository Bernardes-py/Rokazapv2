import { useState, useCallback } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import PdfThumbnail from './PdfThumbnail';

function formatFileSize(bytes?: number): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function getDocExtensionStyle(fileName?: string): { bgColor: string; label: string } {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf': return { bgColor: 'bg-red-500', label: 'PDF' };
    case 'doc': case 'docx': return { bgColor: 'bg-blue-500', label: 'DOC' };
    case 'xls': case 'xlsx': return { bgColor: 'bg-green-600', label: 'XLS' };
    case 'ppt': case 'pptx': return { bgColor: 'bg-orange-500', label: 'PPT' };
    case 'zip': case 'rar': return { bgColor: 'bg-yellow-500', label: 'ZIP' };
    default: return { bgColor: 'bg-gray-500', label: ext ? ext.toUpperCase() : 'DOC' };
  }
}

interface DocumentBubbleProps {
  message: Message;
}

export default function DocumentBubble({ message }: DocumentBubbleProps) {
  const [pageCount, setPageCount] = useState<number | null>(message.mediaPageCount ?? null);
  const style = getDocExtensionStyle(message.mediaFileName);
  const isPdf = message.mediaFileName?.toLowerCase().endsWith('.pdf');

  const handlePageCount = useCallback((count: number) => {
    setPageCount(count);
    if (!message.mediaPageCount && db && message.conversationId && message.id) {
      const msgRef = doc(db, 'conversations', message.conversationId, 'messages', message.id);
      updateDoc(msgRef, { mediaPageCount: count }).catch(console.error);
    }
  }, [message.mediaPageCount, message.conversationId, message.id]);

  const details = [style.label];
  if (isPdf && pageCount) details.push(`${pageCount} página${pageCount > 1 ? 's' : ''}`);
  const sizeStr = formatFileSize(message.mediaFileSize);
  if (sizeStr) details.push(sizeStr);
  if (details.length === 1) details.push('Documento');

  return (
    <div className="min-w-[250px] rounded-lg bg-black/10 mb-1 overflow-hidden">
      {isPdf && message.mediaUrl && (
        <PdfThumbnail url={message.mediaUrl} onPageCount={handlePageCount} />
      )}
      <a
        href={message.mediaUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-2.5 hover:bg-black/10 transition-colors"
      >
        <div className={cn('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', style.bgColor)}>
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{message.mediaFileName || 'Documento'}</p>
          <p className="text-xs text-whatsapp-muted">{details.join(' · ')}</p>
        </div>
        <FileDown className="h-5 w-5 text-whatsapp-muted flex-shrink-0" />
      </a>
    </div>
  );
}
