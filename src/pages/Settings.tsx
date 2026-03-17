import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useTags } from '@/hooks/useTags';
import { createTag, updateTag, deleteTag } from '@/services/crmService';
import { createUserDoc, updateUserDoc } from '@/services/userService';
import { AppUser, Department, UserProfile, DEPARTMENTS } from '@/types/user';
import { Tag } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Pencil, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';
import ChatbotConfigCard from '@/components/settings/ChatbotConfigCard';

interface UserForm {
  name: string;
  email: string;
  password: string;
  department: Department;
  profile: UserProfile;
}

const emptyForm: UserForm = { name: '', email: '', password: '', department: 'Atendente', profile: 'user' };

export default function Settings() {
  const { appUser, refreshAppUser } = useAuth();
  const { users, loading } = useUsers();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { tags, loading: tagsLoading } = useTags();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#22c55e');
  const [cleaning, setCleaning] = useState(false);

  const handleCleanInternalIds = async () => {
    setCleaning(true);
    try {
      if (!app) throw new Error('Firebase não configurado');
      const fns = getFunctions(app, 'us-central1');
      const cleanFn = httpsCallable<any, { deletedConversations: number; deletedContacts: number; deletedMessages: number }>(fns, 'cleanInternalIds');
      const result = await cleanFn({});
      const d = result.data;
      toast({ title: 'Limpeza concluída!', description: `Removidos: ${d.deletedConversations} conversas, ${d.deletedContacts} contatos, ${d.deletedMessages} mensagens` });
    } catch (err: any) {
      toast({ title: 'Erro na limpeza', description: err?.message || 'Falha', variant: 'destructive' });
    } finally {
      setCleaning(false);
    }
  };

  const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

  const openNew = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', department: u.department, profile: u.profile });
    setDialogOpen(true);
  };

  const handleDepartmentChange = (dept: Department) => {
    setForm((prev) => ({
      ...prev,
      department: dept,
      profile: dept !== 'Tecnologia' ? 'user' : prev.profile,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Preencha nome e email', variant: 'destructive' });
      return;
    }
    if (form.department !== 'Tecnologia' && form.profile === 'admin') {
      toast({ title: 'Apenas departamento Tecnologia pode ter perfil admin', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await updateUserDoc(editingUser.uid, {
          name: form.name,
          department: form.department,
          profile: form.profile,
        });
        if (editingUser.uid === appUser?.uid) await refreshAppUser();
        toast({ title: 'Usuário atualizado!' });
      } else {
        if (!form.password || form.password.length < 6) {
          toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (!app) throw new Error('Firebase não configurado');
        const functions = getFunctions(app, 'us-central1');
        const createUserFn = httpsCallable<any, { uid: string }>(functions, 'createUser');
        const result = await createUserFn({ name: form.name, email: form.email, password: form.password, department: form.department, profile: form.profile });
        const newUid = result.data?.uid;
        if (newUid && appUser?.tenantId) {
          await updateUserDoc(newUid, { tenantId: appUser.tenantId });
        }
        toast({ title: 'Usuário criado!' });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de usuários e acessos</p>
        </div>
        <Button onClick={openNew} className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90">
          <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.department}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.profile === 'admin' ? 'default' : 'outline'}>
                        {u.profile === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuário cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tags Management */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome da tag</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: Urgente"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className={`h-9 w-9 rounded-md border-2 transition-all ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              className="h-9 bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90"
              onClick={async () => {
                if (!newTagName.trim()) return;
                await createTag(newTagName.trim(), newTagColor, appUser?.uid || '');
                setNewTagName('');
                toast({ title: 'Tag criada!' });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  onClick={async () => {
                    await deleteTag(tag.id);
                    toast({ title: 'Tag removida' });
                  }}
                  className="ml-1 hover:opacity-70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {tags.length === 0 && !tagsLoading && (
              <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chatbot & Horário */}
      <ChatbotConfigCard />

      {/* Limpeza de IDs internos */}
      {appUser?.profile === 'admin' && (
        <Card className="border-border/40 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Manutenção</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Remove conversas e contatos com IDs internos do WhatsApp (@lid, @newsletter, @g.us) como "Central Lopes".
            </p>
            <Button
              variant="destructive"
              onClick={handleCleanInternalIds}
              disabled={cleaning}
            >
              {cleaning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cleaning ? 'Limpando...' : 'Limpar IDs internos'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" disabled={!!editingUser} />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={(v) => handleDepartmentChange(v as Department)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={form.profile} onValueChange={(v) => setForm({ ...form, profile: v as UserProfile })} disabled={form.department !== 'Tecnologia'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {form.department !== 'Tecnologia' && (
                <p className="text-xs text-muted-foreground">Apenas o departamento Tecnologia pode ter perfil Admin</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUser ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
