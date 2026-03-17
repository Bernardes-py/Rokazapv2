import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, User, Send } from 'lucide-react';
import { Conversation } from '@/types/chat';

interface ContactComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (contacts: Array<{ name: string; phone: string }>) => void;
  conversations: Conversation[];
}

export default function ContactComposer({ open, onOpenChange, onSend, conversations }: ContactComposerProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => c.contact.name.toLowerCase().includes(q) || c.contact.phone.includes(q)
    );
  }, [conversations, search]);

  const toggleSelect = (convId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const handleSend = () => {
    const contacts = conversations
      .filter((c) => selected.has(c.id))
      .map((c) => ({ name: c.contact.name, phone: c.contact.phone }));
    if (contacts.length === 0) return;
    onSend(contacts);
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelected(new Set());
      setSearch('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-whatsapp-dark border-whatsapp-border">
        <DialogHeader>
          <DialogTitle className="text-whatsapp-text flex items-center gap-2">
            <User className="h-5 w-5 text-green-500" />
            Enviar Contato
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-whatsapp-muted" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-whatsapp-input border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
            autoFocus
          />
        </div>

        <div className="max-h-[350px] overflow-y-auto space-y-1 -mx-1">
          {filtered.length === 0 ? (
            <p className="text-whatsapp-muted text-sm text-center py-8">Nenhum contato encontrado</p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => toggleSelect(conv.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(conv.id)}
                  onCheckedChange={() => toggleSelect(conv.id)}
                  className="border-whatsapp-muted data-[state=checked]:bg-whatsapp-green data-[state=checked]:border-whatsapp-green"
                  onClick={(e) => e.stopPropagation()}
                />
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
              </button>
            ))
          )}
        </div>

        {selected.size > 0 && (
          <Button
            onClick={handleSend}
            className="w-full bg-whatsapp-green hover:bg-whatsapp-green/90 text-white gap-2"
          >
            <Send className="h-4 w-4" />
            Enviar ({selected.size})
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
