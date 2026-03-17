import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Forward } from 'lucide-react';
import { Conversation } from '@/types/chat';
import { forwardMessageViaZApi } from '@/services/zapiService';
import { toast } from 'sonner';

interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zapiMessageId: string;
  messagePhone: string;
  conversations: Conversation[];
}

export default function ForwardDialog({ open, onOpenChange, zapiMessageId, messagePhone, conversations }: ForwardDialogProps) {
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => c.contact.name.toLowerCase().includes(q) || c.contact.phone.includes(q)
    );
  }, [conversations, search]);

  const handleForward = async (conv: Conversation) => {
    setSending(conv.id);
    try {
      await forwardMessageViaZApi(conv.contact.phone, zapiMessageId, messagePhone);
      toast.success(`Mensagem encaminhada para ${conv.contact.name}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('[ForwardDialog] Erro:', err);
      toast.error(err?.message || 'Erro ao encaminhar mensagem');
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-whatsapp-dark border-whatsapp-border">
        <DialogHeader>
          <DialogTitle className="text-whatsapp-text flex items-center gap-2">
            <Forward className="h-5 w-5" />
            Encaminhar mensagem
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-whatsapp-muted" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-whatsapp-input border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
          />
        </div>

        <div className="max-h-[350px] overflow-y-auto space-y-1 -mx-1">
          {filtered.length === 0 ? (
            <p className="text-whatsapp-muted text-sm text-center py-8">Nenhum contato encontrado</p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleForward(conv)}
                disabled={sending !== null}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={conv.contact.avatar} />
                  <AvatarFallback className="bg-whatsapp-green/20 text-whatsapp-green text-sm">
                    {conv.contact.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-whatsapp-text">{conv.contact.name}</p>
                  <p className="text-xs text-whatsapp-muted">{conv.contact.phone}</p>
                </div>
                {sending === conv.id && (
                  <span className="text-xs text-whatsapp-muted animate-pulse">Enviando...</span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
