import { useState } from 'react';
import { List, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '@/types/chat';

interface OptionListBubbleProps {
  body?: string;
  optionList?: Message['optionList'];
}

export default function OptionListBubble({ body, optionList }: OptionListBubbleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      {body && (
        <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>
      )}

      {optionList ? (
        <>
          <div className="border-t border-whatsapp-border mt-2" />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-whatsapp-green hover:opacity-80 transition-colors"
          >
            <List className="h-4 w-4" />
            <span>{optionList.buttonLabel}</span>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {open && (
            <div className="bg-black/5 dark:bg-black/20 rounded-lg overflow-hidden border border-whatsapp-border mt-1">
              <div className="px-3 py-2 bg-black/5 dark:bg-black/15">
                <p className="font-semibold text-sm">{optionList.title}</p>
              </div>
              <div className="divide-y divide-whatsapp-border">
                {optionList.options.map((opt, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <p className="text-sm font-medium">{opt.title}</p>
                    {opt.description && (
                      <p className="text-xs text-whatsapp-muted mt-0.5">{opt.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        !body && (
          <div className="flex items-center gap-2 text-whatsapp-muted italic text-xs">
            <List className="h-4 w-4" /> Lista de opções
          </div>
        )
      )}
    </div>
  );
}
