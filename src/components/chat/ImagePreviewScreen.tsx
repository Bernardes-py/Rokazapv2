import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { X, Send, Smile, Plus, Sticker as StickerIcon, Crop, Scissors, Pencil, Type, Square, Sparkles, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export interface PreviewFile {
  type: 'image' | 'video';
  preview: string;
  base64: string;
}

interface ImagePreviewScreenProps {
  files: PreviewFile[];
  onSend: (files: { file: PreviewFile; caption: string }[]) => void | Promise<void>;
  onSendAsSticker?: (file: PreviewFile) => void;
  onCancel: () => void;
  onAddMore: () => void;
}

const toolbarIcons = [
  { icon: Crop, label: 'Cortar' },
  { icon: Scissors, label: 'Recortar' },
  { icon: Pencil, label: 'Desenhar' },
  { icon: Type, label: 'Texto' },
  { icon: Square, label: 'Formas' },
  { icon: Smile, label: 'Emoji' },
  { icon: StickerIcon, label: 'Figurinha' },
  { icon: Sparkles, label: 'HD' },
  { icon: Download, label: 'Baixar' },
];

export default function ImagePreviewScreen({ files, onSend, onSendAsSticker, onCancel, onAddMore }: ImagePreviewScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [sendingSticker, setSendingSticker] = useState(false);
  const [sending, setSending] = useState(false);
  const captionRef = useRef<HTMLInputElement>(null);

  const currentFile = files[activeIndex] || files[0];

  const caption = captions[activeIndex] || '';
  const setCaption = useCallback((val: string) => {
    setCaptions(prev => ({ ...prev, [activeIndex]: val }));
  }, [activeIndex]);

  const handleEmojiSelect = useCallback((emoji: any) => {
    if (!emoji.native) return;
    setCaptions(prev => ({ ...prev, [activeIndex]: (prev[activeIndex] || '') + emoji.native }));
    captionRef.current?.focus();
  }, [activeIndex]);

  const handleSend = useCallback(async () => {
    if (!files.length || sending) return;
    setSending(true);
    const allFiles = files.map((f, i) => ({ file: f, caption: captions[i] || '' }));
    await onSend(allFiles);
  }, [files, captions, onSend, sending]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending) handleSend();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleSend, onCancel, sending]);

  const handleSendAsSticker = useCallback(async () => {
    if (!currentFile || sendingSticker || currentFile.type !== 'image') return;
    setSendingSticker(true);
    try {
      onSendAsSticker?.(currentFile);
    } finally {
      setSendingSticker(false);
    }
  }, [currentFile, sendingSticker, onSendAsSticker]);

  if (!currentFile) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: '#1b2428' }}>
      {/* Header with toolbar */}
      <div className="flex items-center px-4 py-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-[#8696a0] hover:text-white hover:bg-white/10 h-10 w-10"
          onClick={onCancel}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {toolbarIcons.map(({ icon: Icon, label }) => (
            <Button
              key={label}
              variant="ghost"
              size="icon"
              className="text-[#8696a0] hover:text-white hover:bg-white/10 h-9 w-9"
              title={label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          ))}
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex-1 flex items-center justify-center px-8 py-4 min-h-0 overflow-hidden">
        {currentFile.type === 'video' ? (
          <video
            src={currentFile.preview}
            className="max-w-full max-h-full object-contain rounded-lg"
            controls
            autoPlay
            muted
          />
        ) : (
          <img
            src={currentFile.preview}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            draggable={false}
          />
        )}
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="px-4 pb-2">
          <div className="rounded-lg overflow-hidden" style={{ height: 300 }}>
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              locale="pt"
              previewPosition="none"
              skinTonePosition="search"
              set="native"
              perLine={9}
              navPosition="top"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Caption bar (no send button) */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0">
        <input
          ref={captionRef}
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma legenda..."
          disabled={sending}
          className="flex-1 min-h-[40px] rounded-lg px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#8696a0] disabled:opacity-50"
          style={{ backgroundColor: '#2a3942' }}
          autoFocus
        />
        <Button
          variant="ghost"
          size="icon"
          className={`shrink-0 h-9 w-9 ${showEmoji ? 'text-whatsapp-green' : 'text-[#8696a0]'} hover:text-white hover:bg-white/10`}
          onClick={() => setShowEmoji(!showEmoji)}
        >
          <Smile className="h-5 w-5" />
        </Button>
        {currentFile.type === 'image' && onSendAsSticker && (
          <Button
            variant="ghost"
            size="icon"
            className="text-[#8696a0] hover:text-white hover:bg-white/10 shrink-0 h-9 w-9"
            onClick={handleSendAsSticker}
            disabled={sendingSticker}
            title="Enviar como sticker"
          >
            <StickerIcon className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Thumbnails bar + floating send button */}
      <div className="flex items-center px-4 py-3 shrink-0 border-t" style={{ borderColor: '#2a3942' }}>
        <div className="flex-1 flex items-center justify-center gap-2">
          {files.map((file, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-14 w-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                i === activeIndex ? 'border-whatsapp-green' : 'border-transparent hover:border-[#8696a0]/50'
              }`}
            >
              {file.type === 'video' ? (
                <video src={file.preview} className="h-full w-full object-cover" muted />
              ) : (
                <img src={file.preview} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
          <button
            onClick={onAddMore}
            className="h-14 w-14 rounded-lg border-2 border-dashed border-[#8696a0]/50 flex items-center justify-center text-[#8696a0] hover:border-[#8696a0] hover:text-white transition-colors shrink-0"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <Button
          size="icon"
          className="bg-whatsapp-green hover:bg-whatsapp-green/90 rounded-full shrink-0 h-12 w-12 ml-4 disabled:opacity-50"
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
