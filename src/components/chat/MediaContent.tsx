import { User, Image as ImageIcon, Mic, Video, FileText } from 'lucide-react';
import { Message } from '@/types/chat';
import AudioPlayer from './AudioPlayer';
import AudioAvatar from './AudioAvatar';
import DocumentBubble from './DocumentBubble';
import LocationBubble from './LocationBubble';
import OptionListBubble from './OptionListBubble';

interface MediaContentProps {
  message: Message;
  contactAvatar?: string;
  onImageClick?: (mediaUrl: string) => void;
}

export default function MediaContent({ message, contactAvatar, onImageClick }: MediaContentProps) {
  switch (message.type) {
    case 'image':
      return message.mediaUrl ? (
        <img
          src={message.mediaUrl}
          alt="Imagem"
          className="rounded max-w-full max-h-64 object-cover mb-1 cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          onClick={() => onImageClick?.(message.mediaUrl!)}
        />
      ) : (
        <div className="flex items-center gap-2 text-whatsapp-muted italic text-xs">
          <ImageIcon className="h-4 w-4" /> Imagem
        </div>
      );

    case 'video':
      return message.mediaUrl ? (
        <video
          src={message.mediaUrl}
          controls
          className="rounded max-w-full max-h-64 mb-1"
          preload="metadata"
        />
      ) : (
        <div className="flex items-center gap-2 text-whatsapp-muted italic text-xs">
          <Video className="h-4 w-4" /> Vídeo
        </div>
      );

    case 'audio':
      if (!message.mediaUrl) {
        return (
          <div className="flex items-center gap-2 text-whatsapp-muted italic text-xs">
            <Mic className="h-4 w-4" /> Áudio
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          {message.isFromMe && <AudioAvatar />}
          <AudioPlayer src={message.mediaUrl} messageId={message.id} isFromMe={message.isFromMe} />
          {!message.isFromMe && <AudioAvatar avatarUrl={contactAvatar} />}
        </div>
      );

    case 'document':
      return <DocumentBubble message={message} />;

    case 'sticker':
      return message.mediaUrl ? (
        <img
          src={message.mediaUrl}
          alt="Sticker"
          className="max-w-[150px] max-h-[150px] object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center gap-2 text-whatsapp-muted italic text-xs">
          <FileText className="h-4 w-4" /> Sticker
        </div>
      );

    case 'location':
      return message.latitude != null && message.longitude != null ? (
        <LocationBubble
          latitude={message.latitude}
          longitude={message.longitude}
          locationTitle={message.locationTitle}
          locationAddress={message.locationAddress}
          body={message.body}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
      );

    case 'contact':
      if (message.contacts && message.contacts.length > 0) {
        return (
          <div className="space-y-1.5 mb-1">
            {message.contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-black/10 rounded-lg px-3 py-2.5">
                <div className="h-10 w-10 rounded-full bg-whatsapp-green/20 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-whatsapp-green" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-whatsapp-muted truncate">{c.phones.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 bg-black/10 rounded-lg px-3 py-2.5 mb-1">
          <div className="h-10 w-10 rounded-full bg-whatsapp-green/20 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-whatsapp-green" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{message.contactName || message.body || 'Contato'}</p>
            {message.contactPhone && (
              <p className="text-xs text-whatsapp-muted truncate">{message.contactPhone}</p>
            )}
          </div>
        </div>
      );

    case 'link':
      return (
        <div className="mb-1">
          {message.linkImage && (
            <img
              src={message.linkImage}
              alt={message.linkTitle || 'Link preview'}
              className="rounded-t w-full max-h-40 object-cover"
              loading="lazy"
            />
          )}
          <div className="bg-black/10 rounded-b px-3 py-2 space-y-0.5">
            {message.linkTitle && (
              <p className="font-semibold text-sm leading-tight">{message.linkTitle}</p>
            )}
            {message.linkDescription && (
              <p className="text-xs text-whatsapp-muted leading-snug line-clamp-2">{message.linkDescription}</p>
            )}
            {message.linkUrl && (
              <a
                href={message.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 truncate block hover:underline"
              >
                {message.linkUrl}
              </a>
            )}
          </div>
          {message.body && (
            <p className="whitespace-pre-wrap break-words leading-relaxed mt-1">{message.body}</p>
          )}
        </div>
      );

    case 'option-list':
      return <OptionListBubble body={message.body} optionList={message.optionList} />;

    case 'text':
    default:
      return <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>;
  }
}
