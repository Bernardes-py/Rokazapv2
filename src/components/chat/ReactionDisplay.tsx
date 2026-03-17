import { cn } from '@/lib/utils';

interface ReactionDisplayProps {
  reactions: Record<string, string[]>;
  isFromMe: boolean;
  onReact: (emoji: string) => void;
}

export default function ReactionDisplay({ reactions, isFromMe, onReact }: ReactionDisplayProps) {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1 -mb-2 mt-0.5', isFromMe ? 'justify-end' : 'justify-start')}>
      {entries.map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={cn(
            'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border shadow-sm cursor-pointer hover:scale-105 transition-transform',
            'bg-popover border-border'
          )}
        >
          <span className="text-sm">{emoji}</span>
          {users.length > 1 && <span className="text-muted-foreground text-[10px]">{users.length}</span>}
        </button>
      ))}
    </div>
  );
}
