import { useState } from 'react';
import { X, Save, Loader2, Ban, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useContact } from '@/hooks/useContact';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/chatUtils';
import { Contact } from '@/types/chat';
import { TransferRecord } from '@/types/crm';
import { blockContactViaZApi } from '@/services/zapiService';

interface ContactInfoPanelProps {
  contact: Contact;
  onClose: () => void;
  transferHistory?: TransferRecord[];
  tenantId?: string;
}

export default function ContactInfoPanel({ contact, onClose, transferHistory = [], tenantId }: ContactInfoPanelProps) {
  const { contact: info, loading, updateContact } = useContact(contact.phone);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [condominium, setCondominium] = useState('');
  const [block, setBlock] = useState('');
  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  if (info && !initialized) {
    setEmail(info.email || '');
    setCpf(info.cpf || '');
    setCondominium(info.condominium || '');
    setBlock(info.block || '');
    setAddress(info.address || '');
    setUnit(info.unit || '');
    setNotes(info.customNotes || '');
    setInitialized(true);
  }

  const isBlocked = info?.blocked ?? false;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContact({ email, cpf, condominium, block, address, unit, customNotes: notes });
      toast({ title: 'Contato atualizado!' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    const action = isBlocked ? 'unblock' : 'block';
    setBlocking(true);
    try {
      await blockContactViaZApi(contact.phone, action, tenantId);
      await updateContact({ blocked: !isBlocked });
      toast({
        title: isBlocked ? 'Contato desbloqueado' : 'Contato bloqueado',
      });
    } catch {
      toast({ title: 'Erro ao bloquear/desbloquear', variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Info do Contato</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Avatar & Name */}
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-16 w-16">
              <AvatarImage src={contact.avatar} />
              <AvatarFallback className="text-lg bg-primary/20 text-primary">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <h4 className="font-semibold text-foreground">{contact.name}</h4>
            <p className="text-xs text-muted-foreground">{contact.phone}</p>
            {isBlocked && (
              <Badge variant="destructive" className="text-[10px]">
                <Ban className="h-3 w-3 mr-1" /> Bloqueado
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={cpf} onChange={e => setCpf(e.target.value)} className="h-8 text-sm" placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condomínio</Label>
                <Input value={condominium} onChange={e => setCondominium(e.target.value)} className="h-8 text-sm" placeholder="Nome do condomínio" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quadra / Bloco</Label>
                <Input value={block} onChange={e => setBlock(e.target.value)} className="h-8 text-sm" placeholder="Bloco A" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidade / Apto</Label>
                <Input value={unit} onChange={e => setUnit(e.target.value)} className="h-8 text-sm" placeholder="101" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} className="h-8 text-sm" placeholder="Rua, número..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="resize-none text-sm min-h-[60px]" placeholder="Notas sobre o contato..." />
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving} className="w-full h-8 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar
              </Button>

              {/* Block / Unblock */}
              <Button
                size="sm"
                variant={isBlocked ? 'outline' : 'destructive'}
                onClick={handleToggleBlock}
                disabled={blocking}
                className="w-full h-8 text-xs"
              >
                {blocking ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : isBlocked ? (
                  <ShieldCheck className="h-3 w-3 mr-1" />
                ) : (
                  <Ban className="h-3 w-3 mr-1" />
                )}
                {isBlocked ? 'Desbloquear contato' : 'Bloquear contato'}
              </Button>
            </div>
          )}

          {/* Transfer History */}
          {transferHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">Histórico de Transferências</h5>
              {transferHistory.map((t, i) => (
                <div key={i} className="text-xs bg-muted rounded p-2 space-y-0.5">
                  <p><span className="font-medium">{t.fromName}</span> → <span className="font-medium">{t.toName}</span></p>
                  {t.note && <p className="text-muted-foreground italic">"{t.note}"</p>}
                  <p className="text-muted-foreground">{t.at.toLocaleDateString('pt-BR')} {t.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
