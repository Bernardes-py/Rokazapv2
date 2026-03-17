import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Message, Conversation } from '@/types/chat';
import MessageBubble from './MessageBubble';
import ImageLightbox from './ImageLightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

function safeDate(ts: any): Date {
  if (ts instanceof Date && !isNaN(ts.getTime())) return ts;
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

interface ChatMessagesProps {
  messages: Message[];
  loading?: boolean;
  contactAvatar?: string;
  contactPhone?: string;
  conversations?: Conversation[];
  onReact?: (messageId: string, emoji: string) => void;
}

function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = 'Hoje';
  else if (isYesterday(date)) label = 'Ontem';
  else label = format(date, 'dd/MM/yyyy');

  return (
    <div className="flex items-center justify-center my-3">
      <span className="rounded-lg bg-whatsapp-system px-3 py-1 text-xs text-whatsapp-muted shadow-sm">
        {label}
      </span>
    </div>
  );
}

export default function ChatMessages({ messages, loading, contactAvatar, contactPhone, conversations, onReact }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imageUrls = useMemo(
    () => messages.filter((m) => m.type === 'image' && m.mediaUrl).map((m) => m.mediaUrl!),
    [messages]
  );

  const handleImageClick = useCallback((mediaUrl: string) => {
    const idx = imageUrls.indexOf(mediaUrl);
    if (idx !== -1) setLightboxIndex(idx);
  }, [imageUrls]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 px-12 py-4 bg-whatsapp-chat space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <Skeleton className={`h-10 rounded-lg ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-whatsapp-chat">
        <p className="text-sm text-whatsapp-muted">Nenhuma mensagem nesta conversa.</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1 px-12 py-2 bg-whatsapp-chat">
        {messages.map((msg, i) => {
          const msgDate = safeDate(msg.timestamp);
          const prevDate = i > 0 ? safeDate(messages[i - 1].timestamp) : null;
          const showDate = i === 0 || (prevDate && !isSameDay(msgDate, prevDate));
          return (
            <div key={msg.id}>
              {showDate && <DateSeparator date={msgDate} />}
              <MessageBubble message={msg} contactAvatar={contactAvatar} contactPhone={contactPhone} conversations={conversations} onImageClick={handleImageClick} onReact={onReact} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </ScrollArea>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={imageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
