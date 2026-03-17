import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Smile, Paperclip, Mic, Send, X, Sticker as StickerIcon, Plus, Square, Camera, Image as ImageIcon, FileText, Link2, Loader2, List, MapPin, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchOgMetadata } from '@/services/zapiService';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import OptionListComposer from './OptionListComposer';
import LocationComposer from './LocationComposer';
import ContactComposer from './ContactComposer';
import BoletoComposer from './BoletoComposer';
import { Conversation } from '@/types/chat';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;
const STICKER_SIZE = 512;
const MAX_RECORDING_SECONDS = 300; // 5 min

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round(height * (MAX_DIMENSION / width));
            width = MAX_DIMENSION;
          } else {
            width = Math.round(width * (MAX_DIMENSION / height));
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function compressToSticker(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = STICKER_SIZE;
      canvas.height = STICKER_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas não suportado'));
      const scale = Math.min(STICKER_SIZE / img.width, STICKER_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (STICKER_SIZE - w) / 2;
      const y = (STICKER_SIZE - h) / 2;
      ctx.clearRect(0, 0, STICKER_SIZE, STICKER_SIZE);
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao converter áudio'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/i;

import type { PreviewFile } from './ImagePreviewScreen';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendImage: (imageBase64: string, caption: string) => void;
  onSendSticker: (stickerBase64: string) => void;
  onSendGif?: (gifUrl: string) => void;
  onSendAudio?: (audioBase64: string) => void;
  onSendVideo?: (videoBase64: string, caption: string) => void;
  onSendDocument?: (docBase64: string, fileName: string, fileSize: number) => void;
  onSendLink?: (message: string, linkUrl: string, title: string, linkDescription: string, image: string) => void;
  onSendOptionList?: (message: string, optionList: { title: string; buttonLabel: string; options: Array<{ title: string; description: string }> }) => void;
  onSendLocation?: (title: string, address: string, latitude: number, longitude: number) => void;
  onSendContact?: (contacts: Array<{ name: string; phone: string }>) => void;
  conversations?: Conversation[];
  onPreviewFiles?: (files: PreviewFile[]) => void;
}

export default function ChatInput({ onSend, onSendImage, onSendSticker, onSendGif, onSendAudio, onSendVideo, onSendDocument, onSendLink, onSendOptionList, onSendLocation, onSendContact, conversations = [], onPreviewFiles }: ChatInputProps) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [sendingSticker, setSendingSticker] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const inputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [optionListOpen, setOptionListOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [boletoOpen, setBoletoOpen] = useState(false);

  // Link preview state
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkImage, setLinkImage] = useState('');
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [isFetchingOg, setIsFetchingOg] = useState(false);
  const ogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualEditRef = useRef<{ title: boolean; description: boolean; image: boolean }>({ title: false, description: false, image: false });
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    };
  }, []);

  // Debounced OG metadata fetch
  useEffect(() => {
    if (!detectedUrl || !showLinkPreview) return;

    if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);

    ogDebounceRef.current = setTimeout(async () => {
      setIsFetchingOg(true);
      try {
        const meta = await fetchOgMetadata(detectedUrl);
        // Only fill fields that weren't manually edited
        if (!manualEditRef.current.title && meta.title) setLinkTitle(meta.title);
        if (!manualEditRef.current.description && meta.description) setLinkDescription(meta.description);
        if (!manualEditRef.current.image && meta.image) setLinkImage(meta.image);
      } catch (err) {
        console.log('[ChatInput] OG fetch failed:', err);
      } finally {
        setIsFetchingOg(false);
      }
    }, 800);

    return () => {
      if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    };
  }, [detectedUrl, showLinkPreview]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopAndSendRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[ChatInput] Erro ao acessar microfone:', err);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const cancelRecording = () => {
    stopRecording();
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      audioChunksRef.current = [];
      try {
        const base64 = await blobToBase64(blob);
        onSendAudio?.(base64);
      } catch (err) {
        console.error('[ChatInput] Erro ao converter áudio:', err);
      }
    };

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorder.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleEmojiSelect = (emoji: any) => {
    const native = emoji.native;
    if (!native) return;
    setText((prev) => prev + native);
    if (inputRef.current) {
      inputRef.current.textContent = (inputRef.current.textContent || '') + native;
    }
  };

  const handleSend = () => {
    const msg = text.trim();
    if (!msg) return;

    if (showLinkPreview && detectedUrl && onSendLink) {
      onSendLink(msg, detectedUrl, linkTitle, linkDescription, linkImage);
      clearLinkPreview();
    } else {
      onSend(msg);
    }

    setText('');
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
  };

  const handleTextInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || '';
    setText(newText);

    const match = newText.match(URL_REGEX);
    if (match && match[1]) {
      if (match[1] !== detectedUrl) {
        setDetectedUrl(match[1]);
        setShowLinkPreview(true);
        setLinkTitle('');
        setLinkDescription('');
        setLinkImage('');
        manualEditRef.current = { title: false, description: false, image: false };
      }
    } else {
      clearLinkPreview();
    }
  };

  const clearLinkPreview = () => {
    setDetectedUrl(null);
    setShowLinkPreview(false);
    setLinkTitle('');
    setLinkDescription('');
    setLinkImage('');
    setIsFetchingOg(false);
    manualEditRef.current = { title: false, description: false, image: false };
    if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Unified: convert File[] to PreviewFile[] and send to fullscreen overlay
  const processFilesToPreview = async (fileList: File[]) => {
    const previews: PreviewFile[] = [];
    for (const file of fileList) {
      if (file.type.startsWith('video/')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Falha ao ler vídeo'));
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const previewUrl = URL.createObjectURL(file);
        previews.push({ type: 'video', preview: previewUrl, base64 });
      } else if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file);
          previews.push({ type: 'image', preview: compressed, base64: compressed });
        } catch (err) {
          console.error('[ChatInput] Erro ao comprimir imagem:', err);
        }
      }
    }
    if (previews.length > 0) {
      onPreviewFiles?.(previews);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFilesToPreview(Array.from(files));
    e.target.value = '';
  };

  const handlePasteMedia = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const mediaFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
        const file = item.getAsFile();
        if (file) mediaFiles.push(file);
      }
    }
    if (mediaFiles.length > 0) {
      e.preventDefault();
      await processFilesToPreview(mediaFiles);
    }
  };

  const handleDropMedia = async (e: React.DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const mediaFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (mediaFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await processFilesToPreview(mediaFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCancelImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setCaption('');
  };

  const handleCancelVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setVideoBase64(null);
    setCaption('');
  };

  const handleSendImage = () => {
    if (!imageBase64) return;
    onSendImage(imageBase64, caption);
    handleCancelImage();
  };

  const handleSendVideo = () => {
    if (!videoBase64) return;
    onSendVideo?.(videoBase64, caption);
    handleCancelVideo();
  };

  const handleSendAsSticker = async () => {
    if (!imageBase64 || sendingSticker) return;
    setSendingSticker(true);
    try {
      const stickerData = await compressToSticker(imageBase64);
      onSendSticker(stickerData);
      handleCancelImage();
    } catch (err) {
      console.error('[ChatInput] Erro ao converter sticker:', err);
    } finally {
      setSendingSticker(false);
    }
  };

  const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (videoPreview) {
        handleSendVideo();
      } else {
        handleSendImage();
      }
    }
  };

  // Legacy inline preview modes removed — all media goes through fullscreen ImagePreviewScreen

  // Recording mode
  if (isRecording) {
    return (
      <div className="bg-whatsapp-header border-t border-whatsapp-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400 hover:bg-whatsapp-hover shrink-0 h-10 w-10"
            onClick={cancelRecording}
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="flex-1 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-mono text-sm">{formatTime(recordingSeconds)}</span>
            <div className="flex-1 flex items-center gap-0.5">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400/60 rounded-full"
                  style={{
                    height: `${Math.random() * 16 + 4}px`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <Button
            size="icon"
            className="bg-whatsapp-green hover:bg-whatsapp-green/90 rounded-full shrink-0 h-10 w-10"
            onClick={stopAndSendRecording}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-whatsapp-header border-t border-whatsapp-border">
      {/* Emoji/GIF/Sticker Panel */}
      {showPanel && (
        <div className="border-b border-whatsapp-border">
          <div className="h-[340px] overflow-hidden">
            {activeTab === 'emoji' && (
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
            )}
            {activeTab === 'gif' && (
              <GifPicker
                onSelectGif={(gifUrl) => {
                  onSendGif?.(gifUrl);
                  setShowPanel(false);
                }}
              />
            )}
            {activeTab === 'sticker' && (
              <StickerPicker
                onSelectSticker={(base64) => {
                  onSendSticker(base64);
                  setShowPanel(false);
                }}
              />
            )}
          </div>
          {/* Bottom tabs */}
          <div className="flex items-center justify-center gap-0 border-t border-whatsapp-border bg-whatsapp-header">
            <button
              onClick={() => setActiveTab('emoji')}
              className={`flex-1 py-2.5 flex items-center justify-center transition-colors ${
                activeTab === 'emoji'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-whatsapp-muted hover:text-whatsapp-icon'
              }`}
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab('gif')}
              className={`flex-1 py-2.5 flex items-center justify-center transition-colors font-semibold text-sm ${
                activeTab === 'gif'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-whatsapp-muted hover:text-whatsapp-icon'
              }`}
            >
              GIF
            </button>
            <button
              onClick={() => setActiveTab('sticker')}
              className={`flex-1 py-2.5 flex items-center justify-center transition-colors ${
                activeTab === 'sticker'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-whatsapp-muted hover:text-whatsapp-icon'
              }`}
            >
              <StickerIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      {/* Link preview */}
      {showLinkPreview && detectedUrl && (
        <div className="mx-4 mt-3 mb-0 rounded-lg bg-whatsapp-search border border-whatsapp-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-whatsapp-border">
            <div className="flex items-center gap-2 text-whatsapp-icon text-xs">
              <Link2 className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{detectedUrl}</span>
              {isFetchingOg && <Loader2 className="h-3 w-3 animate-spin text-whatsapp-green" />}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-whatsapp-muted hover:text-whatsapp-text"
              onClick={clearLinkPreview}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {isFetchingOg && !linkTitle && !linkDescription && !linkImage ? (
              <>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => { setLinkTitle(e.target.value); manualEditRef.current.title = true; }}
                  placeholder="Título (opcional)"
                  className="w-full bg-transparent text-sm text-whatsapp-text outline-none placeholder:text-whatsapp-muted"
                />
                <input
                  type="text"
                  value={linkDescription}
                  onChange={(e) => { setLinkDescription(e.target.value); manualEditRef.current.description = true; }}
                  placeholder="Descrição (opcional)"
                  className="w-full bg-transparent text-xs text-whatsapp-muted outline-none placeholder:text-whatsapp-muted/50"
                />
                <input
                  type="text"
                  value={linkImage}
                  onChange={(e) => { setLinkImage(e.target.value); manualEditRef.current.image = true; }}
                  placeholder="URL da imagem (opcional)"
                  className="w-full bg-transparent text-xs text-whatsapp-muted outline-none placeholder:text-whatsapp-muted/50"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fileSize = file.size;
            const reader = new FileReader();
            reader.onload = () => {
              onSendDocument?.(reader.result as string, file.name, fileSize);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
          }}
        />
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-whatsapp-icon hover:bg-whatsapp-hover shrink-0"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-56 p-2 bg-whatsapp-header border-whatsapp-border z-50"
          >
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
            >
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Fotos e vídeos</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); cameraInputRef.current?.click(); }}
            >
              <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                <Camera className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Câmera</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); docInputRef.current?.click(); }}
            >
              <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Documento</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); setOptionListOpen(true); }}
            >
              <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center">
                <List className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Lista de Opções</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); setLocationOpen(true); }}
            >
              <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Localização</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); setContactOpen(true); }}
            >
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">Contato</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
              onClick={() => { setAttachOpen(false); setBoletoOpen(true); }}
            >
              <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-whatsapp-text">2ª Via Boleto</span>
            </button>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className={`shrink-0 ${showPanel ? 'text-whatsapp-green' : 'text-whatsapp-icon'} hover:bg-whatsapp-hover`}
          onClick={() => setShowPanel(!showPanel)}
        >
          <Smile className="h-6 w-6" />
        </Button>
        <div className="flex-1 relative">
          <div
            ref={inputRef}
            contentEditable
            role="textbox"
            className="min-h-[40px] max-h-[120px] overflow-y-auto rounded-lg bg-whatsapp-search px-4 py-2.5 text-sm text-whatsapp-text outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-whatsapp-muted"
            data-placeholder="Digite uma mensagem"
            onInput={handleTextInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePasteMedia}
            onDrop={handleDropMedia}
            onDragOver={handleDragOver}
          />
        </div>
        {text.trim() ? (
          <Button
            size="icon"
            className="bg-whatsapp-green hover:bg-whatsapp-green/90 rounded-full shrink-0 h-10 w-10"
            onClick={handleSend}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-whatsapp-icon hover:bg-whatsapp-hover shrink-0 h-10 w-10"
            onClick={startRecording}
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}
      </div>
      <OptionListComposer
        open={optionListOpen}
        onOpenChange={setOptionListOpen}
        onSend={(msg, list) => onSendOptionList?.(msg, list)}
      />
      <LocationComposer
        open={locationOpen}
        onOpenChange={setLocationOpen}
        onSend={(title, address, lat, lng) => onSendLocation?.(title, address, lat, lng)}
      />
      <ContactComposer
        open={contactOpen}
        onOpenChange={setContactOpen}
        onSend={(contacts) => onSendContact?.(contacts)}
        conversations={conversations}
      />
      <BoletoComposer
        open={boletoOpen}
        onOpenChange={setBoletoOpen}
        onSendLink={(message, linkUrl, title, description, image) => onSendLink?.(message, linkUrl, title, description, image)}
      />
    </div>
  );
}
