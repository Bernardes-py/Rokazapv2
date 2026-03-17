import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { transferConversation } from '@/services/crmService';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/chatUtils';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
}

export default function TransferDialog({ open, onOpenChange, conversationId, contactName }: TransferDialogProps) {
  const { users } = useUsers();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const availableUsers = users.filter(u => u.uid !== appUser?.uid);

  const handleTransfer = async () => {
    if (!selectedUserId || !appUser) return;
    const toUser = users.find(u => u.uid === selectedUserId);
    if (!toUser) return;

    setSaving(true);
    try {
      await transferConversation(conversationId, {
        fromUserId: appUser.uid,
        fromName: appUser.name,
        toUserId: toUser.uid,
        toName: toUser.name,
        note: note.trim() || undefined,
      });
      toast({ title: `Conversa transferida para ${toUser.name}` });
      onOpenChange(false);
      setSelectedUserId(null);
      setNote('');
    } catch (err: any) {
      toast({ title: 'Erro ao transferir', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <p className="text-sm text-muted-foreground">Transferindo: {contactName}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Selecione o atendente</Label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => setSelectedUserId(u.uid)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                    selectedUserId === u.uid
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.department}</p>
                  </div>
                </button>
              ))}
              {availableUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum outro atendente disponível</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Nota (opcional)</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Motivo da transferência..."
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={!selectedUserId || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
