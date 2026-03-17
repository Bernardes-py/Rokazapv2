import { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Message, Conversation } from '@/types/chat';
import { formatMessageTime } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import MediaContent from './MediaContent';
import MessageContextMenu from './MessageContextMenu';
import ReactionDisplay from './ReactionDisplay';
import ForwardDialog from './ForwardDialog';

interface MessageBubbleProps {
  message: Message;
  contactAvatar?: string;
  contactPhone?: string;
  conversations?: Conversation[];
  onImageClick?: (mediaUrl: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

export default function MessageBubble({ message, contactAvatar, contactPhone, conversations, onImageClick, onReact }: MessageBubbleProps) {
  const isMe = message.isFromMe;
  const [forwardOpen, setForwardOpen] = useState(false);

  function renderStatusIcon() {
    if (!isMe) return null;
    switch (message.status) {
      case 'read':
        return <CheckCheck className="h-3.5 w-3.5 text-whatsapp-read" />;
      case 'delivered':
        return <CheckCheck className="h-3.5 w-3.5 text-whatsapp-muted" />;
      case 'sent':
        return <Check className="h-3.5 w-3.5 text-whatsapp-muted" />;
      case 'pending':
        return <span className="h-3 w-3 rounded-full border border-whatsapp-muted animate-pulse" />;
      case 'failed':
        return <span className="text-destructive text-xs font-bold">!</span>;
      default:
        return null;
    }
  }

  const handleReact = (emoji: string) => {
    onReact?.(message.id, emoji);
  };

  const handleForward = () => {
    if (!message.zapiMessageId) {
      import('sonner').then(({ toast }) => toast.error('Esta mensagem não pode ser encaminhada (sem ID Z-API)'));
      return;
    }
    setForwardOpen(true);
  };

  // System message (transfer notifications, etc.)
  if (message.type === 'system') {
    return (
      <div className="flex justify-center mb-2 px-4">
        <div className="bg-whatsapp-header/80 rounded-lg px-4 py-2 max-w-[85%] shadow-sm border border-whatsapp-border">
          <p className="text-xs text-whatsapp-muted text-center whitespace-pre-wrap leading-relaxed">
            {message.body}
          </p>
          <p className="text-[10px] text-whatsapp-muted/60 text-center mt-1">
            {formatMessageTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1', isMe ? 'justify-end' : 'justify-start')}>
      <div className="relative max-w-[65%]">
        <div
          className={cn(
            'relative group min-w-[80px] rounded-lg px-3 py-1.5 text-sm shadow-sm',
            isMe
              ? 'bg-whatsapp-outgoing text-whatsapp-text rounded-tr-none'
              : 'bg-whatsapp-incoming text-whatsapp-text rounded-tl-none'
          )}
        >
          <MessageContextMenu onReact={handleReact} onForward={handleForward} isFromMe={isMe} messageText={message.body} />
          {isMe && message.senderName && (
            <p className="text-xs font-semibold text-[hsl(var(--wa-green))] mb-0.5">
              {message.senderName}{message.senderDepartment ? ` - ${message.senderDepartment}` : ''}
            </p>
          )}
          <MediaContent message={message} contactAvatar={contactAvatar} onImageClick={onImageClick} />
          <div className={cn('flex items-center justify-end gap-1 mt-0.5', isMe ? '-mr-0.5' : '')}>
            <span className="text-[11px] text-whatsapp-muted leading-none">
              {formatMessageTime(message.timestamp)}
            </span>
            {renderStatusIcon()}
          </div>
        </div>
        {message.reactions && (
          <ReactionDisplay reactions={message.reactions} isFromMe={isMe} onReact={handleReact} />
        )}
      </div>
      {forwardOpen && message.zapiMessageId && contactPhone && conversations && (
        <ForwardDialog
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          zapiMessageId={message.zapiMessageId}
          messagePhone={contactPhone}
          conversations={conversations}
        />
      )}
    </div>
  );
}
