import { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotes } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import { addNote, updateNote, deleteNote } from '@/services/crmService';
import { useToast } from '@/hooks/use-toast';

interface NotesPanelProps {
  conversationId: string;
  onClose: () => void;
}

const NOTE_COLORS = [
  { bg: '#fef3c7', border: '#f59e0b' },
  { bg: '#fce7f3', border: '#ec4899' },
  { bg: '#dbeafe', border: '#3b82f6' },
  { bg: '#dcfce7', border: '#22c55e' },
];

export default function NotesPanel({ conversationId, onClose }: NotesPanelProps) {
  const { notes, loading } = useNotes(conversationId);
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [newText, setNewText] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleAdd = async () => {
    if (!newText.trim() || !appUser) return;
    await addNote(conversationId, {
      text: newText.trim(),
      authorId: appUser.uid,
      authorName: appUser.name,
      color: NOTE_COLORS[selectedColor].bg,
    });
    setNewText('');
    toast({ title: 'Nota adicionada' });
  };

  const handleUpdate = async (noteId: string) => {
    if (!editText.trim()) return;
    await updateNote(conversationId, noteId, editText.trim());
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote(conversationId, noteId);
    toast({ title: 'Nota removida' });
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Notas Internas</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <Textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Escreva uma nota..."
          className="resize-none text-sm min-h-[60px]"
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {NOTE_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedColor(i)}
                className={`h-6 w-6 rounded-full border-2 transition-all ${selectedColor === i ? 'scale-110 border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: c.bg }}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newText.trim()} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {notes.map(note => (
            <div
              key={note.id}
              className="rounded-lg p-3 text-sm relative group"
              style={{ backgroundColor: note.color, borderLeft: `3px solid ${NOTE_COLORS.find(c => c.bg === note.color)?.border || '#6b7280'}` }}
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="resize-none text-sm min-h-[40px] bg-white/50 text-gray-800 placeholder:text-gray-400"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={() => handleUpdate(note.id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-600 hover:text-gray-800" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p
                    className="whitespace-pre-wrap cursor-pointer text-gray-800"
                    onClick={() => { setEditingId(note.id); setEditText(note.text); }}
                  >
                    {note.text}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-500">
                      {note.authorName} · {note.createdAt.toLocaleDateString('pt-BR')}
                    </span>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {!loading && notes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma nota ainda</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
