import { useState } from 'react';
import { Tag } from '@/types/crm';
import { useTags } from '@/hooks/useTags';
import { addTagToConversation, removeTagFromConversation } from '@/services/crmService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tags, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagsManagerProps {
  conversationId: string;
  conversationTags: string[];
}

export default function TagsManager({ conversationId, conversationTags }: TagsManagerProps) {
  const { tags } = useTags();
  const [open, setOpen] = useState(false);

  const toggle = async (tagId: string) => {
    if (conversationTags.includes(tagId)) {
      await removeTagFromConversation(conversationId, tagId);
    } else {
      await addTagToConversation(conversationId, tagId);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-whatsapp-icon hover:bg-whatsapp-hover">
          <Tags className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">Tags</p>
        {tags.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma tag criada. Vá em Configurações para criar.</p>
        )}
        {tags.map((tag) => {
          const active = conversationTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={cn(
                'flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                active && 'bg-accent'
              )}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="flex-1 text-left truncate">{tag.name}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
