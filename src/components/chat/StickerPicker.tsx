import { useState } from 'react';
import { stickerPacks } from '@/data/stickerPacks';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string) => void;
}

export default function StickerPicker({ onSelectSticker }: StickerPickerProps) {
  const [activePack, setActivePack] = useState(stickerPacks[0].id);

  const currentPack = stickerPacks.find((p) => p.id === activePack) || stickerPacks[0];

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-5 gap-2 p-3">
          {currentPack.stickers.map((sticker, i) => (
            <button
              key={`${currentPack.id}-${i}`}
              onClick={() => onSelectSticker(sticker.url)}
              className="flex items-center justify-center h-16 w-full rounded-lg hover:bg-whatsapp-hover transition-colors"
            >
              <img
                src={sticker.thumbnail}
                alt="sticker"
                className="h-14 w-14 object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Pack tabs */}
      <div className="flex items-center border-t border-whatsapp-border bg-whatsapp-header">
        {stickerPacks.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setActivePack(pack.id)}
            className={`flex-1 py-2 flex items-center justify-center transition-colors ${
              activePack === pack.id
                ? 'border-b-2 border-whatsapp-green bg-whatsapp-hover'
                : 'text-whatsapp-muted hover:bg-whatsapp-hover'
            }`}
            title={pack.name}
          >
            <img src={pack.icon} alt={pack.name} className="h-6 w-6 object-contain" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
