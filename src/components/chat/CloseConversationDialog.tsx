import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { closeConversation } from '@/services/crmService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2 } from 'lucide-react';

interface CloseConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  onClosed: () => void;
}

export default function CloseConversationDialog({
  open, onOpenChange, conversationId, contactName, onClosed,
}: CloseConversationDialogProps) {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    if (!note.trim() || !appUser) return;
    setLoading(true);
    try {
      await closeConversation(conversationId, {
        userId: appUser.uid,
        userName: appUser.name,
        note: note.trim(),
      });
      toast({ title: 'Conversa concluída', description: `Atendimento de ${contactName} finalizado.` });
      setNote('');
      onOpenChange(false);
      onClosed();
    } catch (err: any) {
      toast({ title: 'Erro ao concluir', description: err?.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Concluir Atendimento
          </DialogTitle>
          <DialogDescription>
            Descreva o que foi realizado neste atendimento de <strong>{contactName}</strong>. A conversa será removida da sua lista.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Ex: Cliente solicitou 2ª via de boleto, enviado por e-mail..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={!note.trim() || loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
