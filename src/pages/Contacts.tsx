import { useState, useMemo } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { ContactRecord } from '@/types/crm';
import { syncContactsFromConversations, deleteAllContacts } from '@/services/crmService';
import { enrichContactsFromSuperlogica, syncSuperlogicaContacts, migratePhoneFormat, UnidadeSuperlogica } from '@/services/superlogicaService';
import DownloadContactsDialog from '@/components/contacts/DownloadContactsDialog';
import { useTenant } from '@/contexts/TenantContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Pencil, Trash2, Loader2, RefreshCw, Database, XCircle, Phone, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/chatUtils';

const emptyForm = {
  phone: '', name: '', avatar: '', email: '', cpf: '',
  condominium: '', block: '', unit: '', address: '',
  customNotes: '', tags: [] as string[], blocked: false,
};

export default function Contacts() {
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const { tenant, tenantId, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(5);
      return `55${ddd}${number}`;
    }
    return digits;
  };

  const [importProgress, setImportProgress] = useState(0);

  const handleImportUnidades = async (units: UnidadeSuperlogica[], onProgress?: (pct: number) => void) => {
    setLoadingUnidades(true);
    setImportProgress(0);
    try {
      const existingPhones = new Set(contacts.map(c => c.phone));
      let created = 0;
      let skipped = 0;
      const total = units.length;

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const pct = Math.round(((i + 1) / total) * 100);
        setImportProgress(pct);
        onProgress?.(pct);
        const phones = new Set<string>();
        const phoneToName: Record<string, string> = {};
        const phoneToEmail: Record<string, string> = {};
        const phoneToCpf: Record<string, string> = {};

        for (const c of (u.contatos || [])) {
          const cel = c.st_celular_con?.trim();
          if (cel) {
            const norm = normalizePhone(cel);
            if (norm) {
              phones.add(norm);
              phoneToName[norm] = c.st_nome_con || '';
              if (c.st_email_con) phoneToEmail[norm] = c.st_email_con;
              if (c.st_cpf_con) phoneToCpf[norm] = c.st_cpf_con;
            }
          }
          const tel = c.st_telefone_con?.trim();
          if (tel) {
            const norm = normalizePhone(tel);
            if (norm && !phones.has(norm)) {
              phones.add(norm);
              phoneToName[norm] = c.st_nome_con || '';
              if (c.st_email_con) phoneToEmail[norm] = c.st_email_con;
              if (c.st_cpf_con) phoneToCpf[norm] = c.st_cpf_con;
            }
          }
        }

        if (u.celular_proprietario) {
          const norm = normalizePhone(u.celular_proprietario);
          if (norm && !phones.has(norm)) {
            phones.add(norm);
            phoneToName[norm] = u.nome_proprietario || '';
          }
        }
        if (u.telefone_proprietario) {
          const norm = normalizePhone(u.telefone_proprietario);
          if (norm && !phones.has(norm)) {
            phones.add(norm);
            phoneToName[norm] = u.nome_proprietario || '';
          }
        }

        for (const phone of phones) {
          if (existingPhones.has(phone)) {
            skipped++;
            continue;
          }
          existingPhones.add(phone);
          await createContact({
            phone,
            name: phoneToName[phone] || '',
            avatar: '',
            email: phoneToEmail[phone] || '',
            cpf: phoneToCpf[phone] || '',
            condominium: u.st_nome_cond || '',
            block: u.st_bloco_uni || '',
            unit: u.st_unidade_uni || '',
            address: '',
            customNotes: '',
            tags: [],
            blocked: false,
          });
          created++;
        }
      }

      toast({ title: 'Importação concluída', description: `${created} contatos criados, ${skipped} já existiam` });
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido';
      toast({ title: 'Erro ao importar', description: msg, variant: 'destructive' });
    } finally {
      setLoadingUnidades(false);
    }
  };


  const handleMigratePhones = async () => {
    setMigrating(true);
    try {
      const result = await migratePhoneFormat();
      toast({ title: 'Migração concluída', description: `${result.migrated} migrados, ${result.duplicates} duplicatas ignoradas (total: ${result.total})` });
    } catch {
      toast({ title: 'Erro ao migrar telefones', variant: 'destructive' });
    } finally {
      setMigrating(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const result = await enrichContactsFromSuperlogica();
      toast({ title: 'Enriquecimento concluído', description: `${result.enriched} enriquecidos, ${result.notFound} não encontrados (total: ${result.total})` });
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Erro desconhecido';
      toast({ title: 'Erro ao enriquecer contatos', description: msg, variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncSuperlogicaContacts();
      toast({ title: 'Sincronização concluída', description: `${result.created} criados, ${result.updated} atualizados (total: ${result.synced})` });
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Erro desconhecido';
      toast({ title: 'Erro ao sincronizar', description: msg, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const count = await deleteAllContacts(tenantId || undefined);
      toast({ title: 'Cadastros limpos', description: `${count} contatos removidos.` });
    } catch {
      toast({ title: 'Erro ao limpar cadastros', variant: 'destructive' });
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.condominium.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: ContactRecord) => {
    setEditingId(c.id);
    setForm({
      phone: c.phone, name: c.name, avatar: c.avatar, email: c.email, cpf: c.cpf,
      condominium: c.condominium, block: c.block, unit: c.unit, address: c.address,
      customNotes: c.customNotes, tags: c.tags, blocked: c.blocked,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.phone.trim()) {
      toast({ title: 'Telefone é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateContact(editingId, form);
        toast({ title: 'Contato atualizado!' });
      } else {
        await createContact(form);
        toast({ title: 'Contato criado!' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteContact(deleteId);
      toast({ title: 'Contato excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Contatos</h1>
          {tenantLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : tenant ? (
            <Badge variant="outline" className="gap-1.5 text-sm font-normal border-green-500/50 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {tenant.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-sm font-normal border-destructive/50 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Nenhum condomínio vinculado
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setClearDialogOpen(true)} variant="outline" size="sm" className="text-destructive border-destructive/50" disabled={clearing}>
            <XCircle className={`h-4 w-4 mr-1 ${clearing ? 'animate-spin' : ''}`} /> Limpar Cadastros
          </Button>
          <Button onClick={handleMigratePhones} variant="outline" size="sm" disabled={migrating}>
            <Phone className={`h-4 w-4 mr-1 ${migrating ? 'animate-pulse' : ''}`} /> Migrar Telefones
          </Button>
          <Button onClick={handleEnrich} variant="outline" size="sm" disabled={enriching}>
            <Database className={`h-4 w-4 mr-1 ${enriching ? 'animate-pulse' : ''}`} /> Enriquecer Superlógica
          </Button>
          <Button onClick={handleSync} variant="outline" size="sm" disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar Superlógica
          </Button>
          <Button onClick={() => setDownloadDialogOpen(true)} variant="outline" size="sm" disabled={loadingUnidades}>
            <Download className={`h-4 w-4 mr-1 ${loadingUnidades ? 'animate-pulse' : ''}`} /> Download Contatos
          </Button>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Contato
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou condomínio..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Condomínio</TableHead>
                <TableHead>Bloco</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(c)}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.avatar} />
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {getInitials(c.name || c.phone)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{c.name || '—'}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.condominium || '—'}</TableCell>
                  <TableCell>{c.block || '—'}</TableCell>
                  <TableCell>{c.unit || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone *</Label>
              <Input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="5511999999999" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} onChange={e => setField('cpf', e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Condomínio</Label>
              <Input value={form.condominium} onChange={e => setField('condominium', e.target.value)} placeholder="Nome do condomínio" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quadra / Bloco</Label>
              <Input value={form.block} onChange={e => setField('block', e.target.value)} placeholder="Bloco A" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade / Apto</Label>
              <Input value={form.unit} onChange={e => setField('unit', e.target.value)} placeholder="101" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Rua, número..." />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.customNotes} onChange={e => setField('customNotes', e.target.value)} placeholder="Notas..." className="resize-none min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Clear All Confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os cadastros?</AlertDialogTitle>
            <AlertDialogDescription>Todos os contatos serão excluídos permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} disabled={clearing}>
              {clearing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Limpar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DownloadContactsDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        onImport={handleImportUnidades}
      />
    </div>
  );
}
