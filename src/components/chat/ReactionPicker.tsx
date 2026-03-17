import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  isFromMe: boolean;
}

export default function ReactionPicker({ onReact, isFromMe }: ReactionPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className={cn(
        'absolute -top-10 z-20 flex items-center gap-0.5 rounded-full bg-popover shadow-lg border px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        isFromMe ? 'right-0' : 'left-0'
      )}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="text-xl hover:scale-125 transition-transform p-0.5 cursor-pointer"
        >
          {emoji}
        </button>
      ))}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button className="p-1 rounded-full hover:bg-muted transition-colors cursor-pointer">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-0" side="top" align={isFromMe ? 'end' : 'start'}>
          <Picker
            data={data}
            onEmojiSelect={(e: any) => {
              onReact(e.native);
              setPickerOpen(false);
            }}
            theme="dark"
            locale="pt"
            previewPosition="none"
            skinTonePosition="none"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
