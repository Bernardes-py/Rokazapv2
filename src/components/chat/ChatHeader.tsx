import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Contact } from '@/types/chat';
import { getInitials } from '@/lib/chatUtils';
import { Search, MoreVertical, UserPlus, StickyNote, User, CheckCircle, ArrowLeft, Tags } from 'lucide-react';
import { PresenceStatus } from '@/hooks/usePresence';
import TagsManager from '@/components/chat/TagsManager';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  contact: Contact;
  presenceStatus?: PresenceStatus;
  presenceLastSeen?: Date | null;
  conversationId?: string;
  conversationTags?: string[];
  notesCount?: number;
  onBack?: () => void;
  onTransfer?: () => void;
  onClose?: () => void;
  onToggleNotes?: () => void;
  onToggleContactInfo?: () => void;
}

function getPresenceText(
  contact: Contact,
  presenceStatus?: PresenceStatus,
  presenceLastSeen?: Date | null
): { text: string; isActive: boolean } {
  switch (presenceStatus) {
    case 'COMPOSING':
      return { text: 'digitando...', isActive: true };
    case 'RECORDING':
      return { text: 'gravando áudio...', isActive: true };
    case 'AVAILABLE':
      return { text: 'online', isActive: true };
    case 'PAUSED':
      return { text: 'online', isActive: true };
    case 'UNAVAILABLE':
    default: {
      const lastSeen = presenceLastSeen || contact.lastSeen;
      if (lastSeen) {
        return {
          text: `visto por último às ${lastSeen.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          isActive: false,
        };
      }
      return { text: 'offline', isActive: false };
    }
  }
}

export default function ChatHeader({
  contact, presenceStatus, presenceLastSeen, conversationId, conversationTags = [],
  notesCount = 0, onBack, onTransfer, onClose, onToggleNotes, onToggleContactInfo,
}: ChatHeaderProps) {
  const { text, isActive } = getPresenceText(contact, presenceStatus, presenceLastSeen);
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-whatsapp-header border-b border-whatsapp-border">
      <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={onToggleContactInfo}>
        {onBack && (
          <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-whatsapp-text hover:text-whatsapp-green transition-colors -ml-1 mr-0.5">
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={contact.avatar} />
          <AvatarFallback className="bg-whatsapp-green/20 text-whatsapp-green text-sm font-semibold">
            {getInitials(contact.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="font-medium text-whatsapp-text text-sm truncate">{contact.name}</h2>
          <p className={`text-xs ${isActive ? 'text-whatsapp-green' : 'text-whatsapp-muted'}`}>
            {text}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Tags — desktop only (mobile goes in dropdown) */}
        {!isMobile && conversationId && (
          <TagsManager conversationId={conversationId} conversationTags={conversationTags} />
        )}
        {/* Notas — always visible */}
        <Button variant="ghost" size="icon" className="relative text-whatsapp-icon hover:bg-whatsapp-hover" onClick={onToggleNotes} title="Notas">
          <StickyNote className="h-5 w-5" />
          {notesCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-whatsapp-green text-[10px] font-bold text-white px-1">
              {notesCount}
            </span>
          )}
        </Button>
        {/* Concluir — always visible */}
        <Button variant="ghost" size="icon" className="text-green-500 hover:bg-whatsapp-hover" onClick={onClose} title="Concluir atendimento">
          <CheckCircle className="h-5 w-5" />
        </Button>
        {/* Desktop: botões inline */}
        {!isMobile && (
          <>
            <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover" onClick={onTransfer} title="Transferir">
              <UserPlus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover" onClick={onToggleContactInfo} title="Info do contato">
              <User className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </>
        )}
        {/* Mobile: dropdown menu */}
        {isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {conversationId && (
                <DropdownMenuItem onClick={() => {/* Tags handled via popover — trigger contact info or open tags */}}>
                  <Tags className="h-4 w-4 mr-2" /> Tags
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onTransfer}>
                <UserPlus className="h-4 w-4 mr-2" /> Transferir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleContactInfo}>
                <User className="h-4 w-4 mr-2" /> Info do contato
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Search className="h-4 w-4 mr-2" /> Buscar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
