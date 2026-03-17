import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tenant } from '@/types/tenant';
import { createTenant, updateTenant, subscribeToTenants } from '@/services/tenantService';
import { useUsers } from '@/hooks/useUsers';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Pencil, Loader2, Users, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';
import { Department, UserProfile, DEPARTMENTS } from '@/types/user';
import { updateUserDoc } from '@/services/userService';

interface TenantForm {
  name: string;
  logo: string;
  plan: Tenant['plan'];
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  department: Department;
  profile: UserProfile;
}

const emptyTenantForm: TenantForm = { name: '', logo: '', plan: 'basic' };
const emptyUserForm: UserForm = { name: '', email: '', password: '', department: 'Atendente', profile: 'user' };

export default function Tenants() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyTenantForm);
  const [saving, setSaving] = useState(false);

  // User creation dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    const unsub = subscribeToTenants((list) => {
      setTenants(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openNewTenant = () => {
    setEditingTenant(null);
    setForm(emptyTenantForm);
    setDialogOpen(true);
  };

  const openEditTenant = (t: Tenant) => {
    setEditingTenant(t);
    setForm({ name: t.name, logo: t.logo, plan: t.plan });
    setDialogOpen(true);
  };

  const handleSaveTenant = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingTenant) {
        await updateTenant(editingTenant.id, { name: form.name, logo: form.logo, plan: form.plan });
        toast({ title: 'Condomínio atualizado!' });
      } else {
        await createTenant({ name: form.name, logo: form.logo, plan: form.plan });
        toast({ title: 'Condomínio criado!' });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    try {
      await updateTenant(tenant.id, { active: !tenant.active });
      toast({ title: tenant.active ? 'Condomínio desativado' : 'Condomínio ativado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    }
  };

  const openCreateUser = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setUserForm(emptyUserForm);
    setUserDialogOpen(true);
  };

  const handleDepartmentChange = (dept: Department) => {
    setUserForm((prev) => ({
      ...prev,
      department: dept,
      profile: dept !== 'Tecnologia' ? 'user' : prev.profile,
    }));
  };

  const handleCreateUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (userForm.password.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setSavingUser(true);
    try {
      if (!app) throw new Error('Firebase não configurado');
      const functions = getFunctions(app, 'us-central1');
      const createUserFn = httpsCallable<any, { uid: string }>(functions, 'createUser');
      const result = await createUserFn({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        department: userForm.department,
        profile: userForm.profile,
        tenantId: selectedTenantId,
      });
      const newUid = result.data?.uid;
      if (newUid && selectedTenantId) {
        await updateUserDoc(newUid, { tenantId: selectedTenantId });
      }
      toast({ title: 'Usuário criado e vinculado ao condomínio!' });
      setUserDialogOpen(false);
    } catch (err: any) {
      const msg = err?.message?.replace(/^.*?\)\s*/, '') || 'Erro desconhecido';
      toast({ title: 'Erro ao criar usuário', description: msg, variant: 'destructive' });
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Condomínios</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de tenants (clientes)</p>
        </div>
        <Button onClick={openNewTenant} className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90">
          <Plus className="mr-2 h-4 w-4" /> Novo Condomínio
        </Button>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Condomínios Cadastrados
          </CardTitle>
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
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{t.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={t.active} onCheckedChange={() => handleToggleActive(t)} />
                        <span className="text-xs text-muted-foreground">{t.active ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditTenant(t)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openCreateUser(t.id)} title="Criar usuário">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum condomínio cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tenant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Editar Condomínio' : 'Novo Condomínio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Condomínio</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Residencial Parque das Flores" />
            </div>
            <div className="space-y-2">
              <Label>Logo URL (opcional)</Label>
              <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as Tenant['plan'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTenant} disabled={saving} className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTenant ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Creation Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Usuário para Condomínio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={userForm.department} onValueChange={(v) => handleDepartmentChange(v as Department)}>
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
              <Select value={userForm.profile} onValueChange={(v) => setUserForm({ ...userForm, profile: v as UserProfile })} disabled={userForm.department !== 'Tecnologia'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={savingUser} className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90">
              {savingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
