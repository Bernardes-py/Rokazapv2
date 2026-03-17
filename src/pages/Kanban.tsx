import { useState, useMemo } from 'react';
import { Plus, Loader2, GripVertical, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKanban } from '@/hooks/useKanban';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard } from '@/services/crmService';
import { KanbanCard } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

type Column = 'todo' | 'doing' | 'done';

const COLUMNS: { key: Column; title: string; color: string }[] = [
  { key: 'todo', title: 'A Fazer', color: 'hsl(var(--muted-foreground))' },
  { key: 'doing', title: 'Em Andamento', color: 'hsl(45 90% 50%)' },
  { key: 'done', title: 'Concluído', color: 'hsl(142 76% 36%)' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

interface CardForm {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  column: Column;
}

const emptyForm: CardForm = { title: '', description: '', priority: 'medium', assignedTo: '', column: 'todo' };

export default function Kanban() {
  const { cards, loading } = useKanban();
  const { users } = useUsers();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const cardsByColumn = useMemo(() => {
    const map: Record<Column, KanbanCard[]> = { todo: [], doing: [], done: [] };
    cards.forEach(c => {
      if (map[c.column]) map[c.column].push(c);
      else map.todo.push(c);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [cards]);

  const openNew = (col: Column) => {
    setEditingCard(null);
    setForm({ ...emptyForm, column: col });
    setDialogOpen(true);
  };

  const openEdit = (card: KanbanCard) => {
    setEditingCard(card);
    setForm({
      title: card.title,
      description: card.description,
      priority: card.priority,
      assignedTo: card.assignedTo || '',
      column: card.column,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const assignedUser = users.find(u => u.uid === form.assignedTo);
      if (editingCard) {
        await updateKanbanCard(editingCard.id, {
          title: form.title,
          description: form.description,
          priority: form.priority,
          assignedTo: form.assignedTo || undefined,
          assignedName: assignedUser?.name || undefined,
          column: form.column,
        });
        toast({ title: 'Card atualizado' });
      } else {
        const colCards = cardsByColumn[form.column];
        await addKanbanCard({
          title: form.title,
          description: form.description,
          priority: form.priority,
          assignedTo: form.assignedTo || undefined,
          assignedName: assignedUser?.name || undefined,
          column: form.column,
          createdBy: appUser?.uid || '',
          createdByName: appUser?.name || '',
          order: colCards.length,
        });
        toast({ title: 'Card criado' });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm('Excluir este card?')) return;
    await deleteKanbanCard(cardId);
    toast({ title: 'Card removido' });
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedId(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, column: Column) => {
    e.preventDefault();
    if (!draggedId) return;
    const colCards = cardsByColumn[column];
    await moveKanbanCard(draggedId, column, colCards.length);
    setDraggedId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-card p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kanban</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas tarefas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            className="space-y-3"
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
              <h2 className="font-semibold text-foreground">{col.title}</h2>
              <span className="text-xs text-muted-foreground ml-auto">{cardsByColumn[col.key].length}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNew(col.key)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {cardsByColumn[col.key].map(card => (
                <Card
                  key={card.id}
                  draggable
                  onDragStart={e => handleDragStart(e, card.id)}
                  className={`bg-card/90 border-border backdrop-blur-sm cursor-grab hover:border-primary/30 transition-colors ${draggedId === card.id ? 'opacity-50' : ''}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-foreground flex-1">{card.title}</p>
                      <div className="flex gap-0.5 ml-2">
                        <button onClick={() => openEdit(card)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(card.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {card.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${PRIORITY_COLORS[card.priority]}`}>
                        {PRIORITY_LABELS[card.priority]}
                      </Badge>
                      {card.assignedName && (
                        <span className="text-[10px] text-muted-foreground">{card.assignedName}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Card' : 'Novo Card'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título da tarefa" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição..." className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atribuir a</Label>
                <Select value={form.assignedTo} onValueChange={v => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={form.column} onValueChange={v => setForm({ ...form, column: v as Column })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCard ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
