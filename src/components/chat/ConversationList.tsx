import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Star, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation, ConversationFilter } from '@/types/chat';
import { formatConversationDate, getInitials } from '@/lib/chatUtils';
import { useTags } from '@/hooks/useTags';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Pin } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  onDelete?: (conversation: Conversation) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect, onDelete }: ConversationListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const { tags: allTags } = useTags();
  const tagsMap = useMemo(() => new Map(allTags.map(t => [t.id, t])), [allTags]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (filter === 'favorites') list = list.filter((c) => c.isFavorite);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.contact.name.toLowerCase().includes(q) ||
          c.contact.phone.includes(q) ||
          c.lastMessage?.body.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [conversations, search, filter]);

  const filters: { key: ConversationFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Tudo', icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { key: 'unread', label: 'Não lidas', icon: <Filter className="h-3.5 w-3.5" /> },
    { key: 'favorites', label: 'Favoritos', icon: <Star className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-whatsapp-border bg-whatsapp-sidebar">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-4 py-2 text-sm text-whatsapp-muted hover:text-whatsapp-text hover:bg-whatsapp-hover transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao menu
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-header">
        <h1 className="text-lg font-semibold text-whatsapp-text">Conversas</h1>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-whatsapp-sidebar">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-whatsapp-muted" />
          <Input
            placeholder="Pesquisar ou começar nova conversa"
            className="pl-10 bg-whatsapp-search border-0 text-whatsapp-text placeholder:text-whatsapp-muted rounded-lg h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-3 py-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-whatsapp-green text-white'
                : 'bg-whatsapp-search text-whatsapp-muted hover:bg-whatsapp-hover'
            )}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {filtered.map((conv) => (
          <ContextMenu key={conv.id}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => onSelect(conv)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-whatsapp-hover',
                  selectedId === conv.id && 'bg-whatsapp-active'
                )}
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={conv.contact.avatar} />
                  <AvatarFallback className="bg-whatsapp-green/20 text-whatsapp-green text-sm font-semibold">
                    {getInitials(conv.contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-whatsapp-text text-sm truncate">
                      {conv.contact.name}
                    </span>
                    <span className={cn(
                      'text-xs shrink-0 ml-2',
                      conv.unreadCount > 0 ? 'text-whatsapp-green font-medium' : 'text-whatsapp-muted'
                    )}>
                      {conv.lastMessage && formatConversationDate(conv.lastMessage.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm text-whatsapp-muted truncate pr-2">
                      {conv.lastMessage?.isFromMe && (
                        <span className={cn(
                          'mr-1',
                          conv.lastMessage.status === 'read' ? 'text-whatsapp-read' :
                          conv.lastMessage.status === 'failed' ? 'text-red-500' :
                          'text-whatsapp-check'
                        )}>
                          {conv.lastMessage.status === 'failed' ? '!' :
                           conv.lastMessage.status === 'read' ? '✓✓' :
                           conv.lastMessage.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                      {conv.lastMessage?.body || 'Nenhuma mensagem'}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {conv.isPinned && <Pin className="h-3 w-3 text-whatsapp-muted" />}
                      {conv.unreadCount > 0 && (
                        <Badge className="h-5 min-w-[20px] rounded-full bg-whatsapp-green text-white text-xs px-1.5 flex items-center justify-center border-0">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {conv.tags && conv.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap ml-[60px]">
                      {conv.tags.slice(0, 3).map((tagId) => {
                        const tag = tagsMap.get(tagId);
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        );
                      })}
                      {conv.tags.length > 3 && (
                        <span className="text-[10px] text-whatsapp-muted">+{conv.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-popover border shadow-xl">
              <ContextMenuItem
                onClick={() => onDelete?.(conv)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar conversa
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-whatsapp-muted text-sm">
            Nenhuma conversa encontrada
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
