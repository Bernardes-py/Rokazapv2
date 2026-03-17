import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Send, List } from 'lucide-react';

interface OptionItem {
  title: string;
  description: string;
}

interface OptionListComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (message: string, optionList: { title: string; buttonLabel: string; options: OptionItem[] }) => void;
}

export default function OptionListComposer({ open, onOpenChange, onSend }: OptionListComposerProps) {
  const [message, setMessage] = useState('');
  const [listTitle, setListTitle] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [options, setOptions] = useState<OptionItem[]>([{ title: '', description: '' }]);

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, { title: '', description: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof OptionItem, value: string) => {
    setOptions(options.map((opt, i) => i === index ? { ...opt, [field]: value } : opt));
  };

  const isValid = message.trim() && listTitle.trim() && buttonLabel.trim() && options.every(o => o.title.trim());

  const handleSend = () => {
    if (!isValid) return;
    onSend(message.trim(), {
      title: listTitle.trim(),
      buttonLabel: buttonLabel.trim(),
      options: options.map(o => ({ title: o.title.trim(), description: o.description.trim() })),
    });
    // Reset
    setMessage('');
    setListTitle('');
    setButtonLabel('');
    setOptions([{ title: '', description: '' }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-whatsapp-header border-whatsapp-border text-whatsapp-text max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-whatsapp-text">
            <List className="h-5 w-5 text-whatsapp-green" />
            Lista de Opções
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-whatsapp-muted mb-1 block">Mensagem principal *</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem que acompanha a lista..."
              className="bg-whatsapp-search border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-whatsapp-muted mb-1 block">Título da lista *</label>
            <Input
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              placeholder="Ex: Escolha uma opção"
              className="bg-whatsapp-search border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
            />
          </div>

          <div>
            <label className="text-xs text-whatsapp-muted mb-1 block">Texto do botão *</label>
            <Input
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Ex: Ver opções"
              className="bg-whatsapp-search border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-whatsapp-muted">Opções ({options.length}/10)</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addOption}
                disabled={options.length >= 10}
                className="text-whatsapp-green hover:bg-whatsapp-hover h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-start bg-whatsapp-search rounded-lg p-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={opt.title}
                      onChange={(e) => updateOption(i, 'title', e.target.value)}
                      placeholder={`Título da opção ${i + 1} *`}
                      className="bg-whatsapp-header border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted h-8 text-sm"
                    />
                    <Input
                      value={opt.description}
                      onChange={(e) => updateOption(i, 'description', e.target.value)}
                      placeholder="Descrição (opcional)"
                      className="bg-whatsapp-header border-whatsapp-border text-whatsapp-muted placeholder:text-whatsapp-muted/50 h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 1}
                    className="text-red-400 hover:bg-red-500/10 h-8 w-8 shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={!isValid}
            className="bg-whatsapp-green hover:bg-whatsapp-green/90 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar Lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
