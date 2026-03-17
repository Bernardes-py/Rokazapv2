import { useState } from 'react';
import { ChevronDown, Reply, Copy, Forward, Pin, Bookmark, CheckSquare, Download, Share2, Flag, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageContextMenuProps {
  onReact: (emoji: string) => void;
  onForward?: () => void;
  isFromMe: boolean;
  messageText?: string;
}

const MENU_ITEMS: Array<{ separator: true } | { icon: any; label: string; action: string; destructive?: boolean }> = [
  { icon: Reply, label: 'Responder', action: 'reply' },
  { icon: Copy, label: 'Copiar', action: 'copy' },
  { icon: Forward, label: 'Encaminhar', action: 'forward' },
  { icon: Pin, label: 'Fixar', action: 'pin' },
  { icon: Bookmark, label: 'Salvar na conversa', action: 'bookmark' },
  { separator: true },
  { icon: CheckSquare, label: 'Selecionar', action: 'select' },
  { icon: Download, label: 'Salvar como', action: 'save' },
  { icon: Share2, label: 'Compartilhar', action: 'share' },
  { separator: true },
  { icon: Flag, label: 'Denunciar', action: 'report' },
  { icon: Trash2, label: 'Apagar', action: 'delete', destructive: true },
];

export default function MessageContextMenu({ onReact, onForward, isFromMe, messageText }: MessageContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleAction = (action: string) => {
    if (action === 'copy' && messageText) {
      navigator.clipboard.writeText(messageText);
      toast.success('Texto copiado');
    } else if (action === 'forward' && onForward) {
      onForward();
    } else if (action !== 'copy') {
      toast.info('Em breve');
    }
    setOpen(false);
  };

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setOpen(false);
    setEmojiPickerOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEmojiPickerOpen(false); }}>
      <PopoverTrigger asChild>
        <button
          className="absolute top-1 right-1 z-20 flex items-center justify-center h-5 w-5 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer hover:bg-black/30"
        >
          <ChevronDown className="h-3.5 w-3.5 text-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0 bg-popover border shadow-xl z-50"
        side="bottom"
        align={isFromMe ? 'end' : 'start'}
        sideOffset={4}
      >
        {/* Quick reactions row */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="text-xl hover:scale-125 transition-transform p-0.5 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverTrigger asChild>
              <button className="p-1 rounded-full hover:bg-muted transition-colors cursor-pointer">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0 z-[60]" side="top" align={isFromMe ? 'end' : 'start'}>
              <Picker
                data={data}
                onEmojiSelect={(e: any) => handleReact(e.native)}
                theme="dark"
                locale="pt"
                previewPosition="none"
                skinTonePosition="none"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {MENU_ITEMS.map((item, i) => {
            if ('separator' in item) {
              return <div key={`sep-${i}`} className="h-px bg-border my-1" />;
            }
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                onClick={() => handleAction(item.action)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors cursor-pointer hover:bg-accent',
                  item.destructive ? 'text-destructive hover:text-destructive' : 'text-popover-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
