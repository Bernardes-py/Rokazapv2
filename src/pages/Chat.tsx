import { useState, useCallback, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import ConversationList from '@/components/chat/ConversationList';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessages from '@/components/chat/ChatMessages';
import ChatInput from '@/components/chat/ChatInput';
import ImagePreviewScreen from '@/components/chat/ImagePreviewScreen';
import type { PreviewFile } from '@/components/chat/ImagePreviewScreen';
import TransferDialog from '@/components/chat/TransferDialog';
import CloseConversationDialog from '@/components/chat/CloseConversationDialog';
import NotesPanel from '@/components/chat/NotesPanel';
import ContactInfoPanel from '@/components/chat/ContactInfoPanel';
import { useConversations } from '@/hooks/useConversations';
import { useMessages } from '@/hooks/useMessages';
import { usePresence } from '@/hooks/usePresence';
import { useNotes } from '@/hooks/useNotes';
import { sendMessage, markAsRead, toggleReaction, deleteConversation } from '@/services/firestoreService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendTextViaZApi, sendImageViaZApi, sendStickerViaZApi, sendGifViaZApi, sendAudioViaZApi, sendVideoViaZApi, sendDocumentViaZApi, sendLinkViaZApi, sendReactionViaZApi, sendOptionListViaZApi, sendLocationViaZApi, sendContactViaZApi, sendContactsViaZApi, deleteChatViaZApi } from '@/services/zapiService';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Conversation, Message } from '@/types/chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Chat() {
  const { appUser } = useAuth();
  const { conversations, setConversations, loading: convsLoading, error: convsError } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFromList = conversations.find((c) => c.id === selectedId) || null;
  const lastValidSelectedRef = useRef<Conversation | null>(null);

  // Keep a fallback: if conversations temporarily empties (HMR), use cached selection
  const selected = selectedFromList || (selectedId ? lastValidSelectedRef.current : null);
  if (selectedFromList) {
    lastValidSelectedRef.current = selectedFromList;
  }
  const { messages, loading: msgsLoading, appendOptimisticMessage } = useMessages(selectedId || undefined);
  const presence = usePresence(selected?.contact?.phone);
  const { notes } = useNotes(selectedId || undefined);
  const isMobile = useIsMobile();
  // showChat kept for potential future use but no longer controls mobile visibility
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [transferOpen, setTransferOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const getSenderPrefix = useCallback(() => {
    if (!appUser?.name) return '';
    return appUser.department ? `*${appUser.name} - ${appUser.department}:*\n` : `*${appUser.name}:*\n`;
  }, [appUser]);

  const handleSelect = useCallback((conv: Conversation) => {
    setSelectedId(conv.id);
    // no longer toggling showChat
    setShowContactInfo(false);

    if (isFirebaseConfigured()) {
      markAsRead(conv.id);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [setConversations]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          console.log('[Chat] Salvando mensagem no Firestore...');
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body,
            timestamp: new Date(),
            status: 'pending',
            type: 'text',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
          });
          console.log('[Chat] Mensagem salva, docId:', messageDocId);

          appendOptimisticMessage({
            id: messageDocId,
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body,
            timestamp: new Date(),
            status: 'pending',
            type: 'text',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
          });

          console.log('[Chat] Chamando sendTextViaZApi...');
          try {
            const result = await sendTextViaZApi(selected.contact.phone, getSenderPrefix() + body, selected.id, messageDocId);
            console.log('[Chat] sendTextViaZApi sucesso:', result);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar via Z-API:', err);
            const errorMsg = err?.message || 'Erro desconhecido';
            toast({
              title: 'Erro ao enviar mensagem',
              description: errorMsg,
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar mensagem como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          console.error('[Chat] Erro externo (Firestore?):', outerErr);
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      } else {
        // Fallback mock mode
        const newMsg: Message = {
          id: `m-${Date.now()}`,
          conversationId: selected.id,
          from: 'me',
          to: selected.contact.phone,
          body,
          timestamp: new Date(),
          status: 'sent',
          type: 'text',
          isFromMe: true,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, lastMessage: newMsg, updatedAt: new Date() } : c
          )
        );
      }
    },
    [selected, setConversations, toast, appUser, getSenderPrefix, appendOptimisticMessage]
  );

  const handleSendImage = useCallback(
    async (imageBase64: string, caption: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: caption || '',
            timestamp: new Date(),
            status: 'pending',
            type: 'image',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: imageBase64,
          });

          appendOptimisticMessage({
            id: messageDocId,
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: caption || '',
            timestamp: new Date(),
            status: 'pending',
            type: 'image',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: imageBase64,
          });

          try {
            await sendImageViaZApi(selected.contact.phone, imageBase64, getSenderPrefix() + (caption || ''), selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar imagem via Z-API:', err);
            toast({
              title: 'Erro ao enviar imagem',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar imagem como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast, appUser, getSenderPrefix, appendOptimisticMessage]
  );

  const handleSendSticker = useCallback(
    async (stickerBase64: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: '',
            timestamp: new Date(),
            status: 'pending',
            type: 'sticker',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: stickerBase64,
          });

          try {
            await sendStickerViaZApi(selected.contact.phone, stickerBase64, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar sticker via Z-API:', err);
            toast({
              title: 'Erro ao enviar sticker',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar sticker como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendGif = useCallback(
    async (gifUrl: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: '',
            timestamp: new Date(),
            status: 'pending',
            type: 'gif',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: gifUrl,
          });

          try {
            await sendGifViaZApi(selected.contact.phone, gifUrl, '', selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar GIF via Z-API:', err);
            toast({
              title: 'Erro ao enviar GIF',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar GIF como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendAudio = useCallback(
    async (audioBase64: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: '',
            timestamp: new Date(),
            status: 'pending',
            type: 'audio',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: audioBase64,
          });

          try {
            await sendAudioViaZApi(selected.contact.phone, audioBase64, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar áudio via Z-API:', err);
            toast({
              title: 'Erro ao enviar áudio',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar áudio como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendVideo = useCallback(
    async (videoBase64: string, caption: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: caption || '',
            timestamp: new Date(),
            status: 'pending',
            type: 'video',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: videoBase64,
          });

          try {
            await sendVideoViaZApi(selected.contact.phone, videoBase64, getSenderPrefix() + (caption || ''), selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar vídeo via Z-API:', err);
            toast({
              title: 'Erro ao enviar vídeo',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar vídeo como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendDocument = useCallback(
    async (docBase64: string, fileName: string, fileSize?: number) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: fileName,
            timestamp: new Date(),
            status: 'pending',
            type: 'document',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            mediaUrl: docBase64,
            mediaFileName: fileName,
            mediaFileSize: fileSize,
          });

          try {
            await sendDocumentViaZApi(selected.contact.phone, docBase64, fileName, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar documento via Z-API:', err);
            toast({
              title: 'Erro ao enviar documento',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar documento como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendLink = useCallback(
    async (message: string, linkUrl: string, title: string, linkDescription: string, image: string) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: message || '',
            timestamp: new Date(),
            status: 'pending',
            type: 'link',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            linkUrl,
            linkTitle: title,
            linkDescription,
            linkImage: image,
          });

          try {
            await sendLinkViaZApi(selected.contact.phone, getSenderPrefix() + message, linkUrl, title, linkDescription, image, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar link via Z-API:', err);
            toast({
              title: 'Erro ao enviar link',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar link como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendOptionList = useCallback(
    async (message: string, optionList: { title: string; buttonLabel: string; options: Array<{ title: string; description: string }> }) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: message,
            timestamp: new Date(),
            status: 'pending',
            type: 'option-list',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            optionList,
          });

          try {
            await sendOptionListViaZApi(selected.contact.phone, getSenderPrefix() + message, optionList, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar lista de opções via Z-API:', err);
            toast({
              title: 'Erro ao enviar lista de opções',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar lista como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendLocation = useCallback(
    async (title: string, address: string, latitude: number, longitude: number) => {
      if (!selected) return;

      if (isFirebaseConfigured()) {
        try {
          const messageDocId = await sendMessage(selected.id, {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body: title,
            timestamp: new Date(),
            status: 'pending',
            type: 'location',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
            latitude,
            longitude,
            locationTitle: title,
            locationAddress: address,
          });

          try {
            await sendLocationViaZApi(selected.contact.phone, title, address, latitude, longitude, selected.id, messageDocId);
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar localização via Z-API:', err);
            toast({
              title: 'Erro ao enviar localização',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar localização como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleSendContact = useCallback(
    async (contacts: Array<{ name: string; phone: string }>) => {
      if (!selected || contacts.length === 0) return;

      if (isFirebaseConfigured()) {
        try {
          const body = contacts.map((c) => c.name).join(', ');
          const contactsPayload = contacts.map((c) => ({ name: c.name, phones: [c.phone] }));

          const messageData: any = {
            conversationId: selected.id,
            from: 'me',
            to: selected.contact.phone,
            body,
            timestamp: new Date(),
            status: 'pending',
            type: 'contact',
            isFromMe: true,
            senderName: appUser?.name,
            senderDepartment: appUser?.department,
          };

          if (contacts.length === 1) {
            messageData.contactName = contacts[0].name;
            messageData.contactPhone = contacts[0].phone;
          } else {
            messageData.contacts = contactsPayload;
          }

          const messageDocId = await sendMessage(selected.id, messageData);

          try {
            if (contacts.length === 1) {
              await sendContactViaZApi(selected.contact.phone, contacts[0].name, contacts[0].phone, selected.id, messageDocId);
            } else {
              await sendContactsViaZApi(selected.contact.phone, contactsPayload, selected.id, messageDocId);
            }
          } catch (err: any) {
            console.error('[Chat] Erro ao enviar contato(s) via Z-API:', err);
            toast({
              title: 'Erro ao enviar contato',
              description: err?.message || 'Erro desconhecido',
              variant: 'destructive',
            });

            if (db && messageDocId) {
              try {
                const msgRef = doc(db, 'conversations', selected.id, 'messages', messageDocId);
                await updateDoc(msgRef, { status: 'failed' });
                const convRef = doc(db, 'conversations', selected.id);
                await updateDoc(convRef, { lastMessageStatus: 'failed' });
              } catch (updateErr) {
                console.error('[Chat] Erro ao marcar contato como failed:', updateErr);
              }
            }
          }
        } catch (outerErr: any) {
          toast({
            title: 'Erro ao salvar mensagem',
            description: outerErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    },
    [selected, toast]
  );

  const handleDeleteChat = useCallback(
    async (conv: Conversation) => {
      if (!confirm(`Apagar conversa com ${conv.contact.name}?`)) return;

      try {
        // Delete on Z-API
        if (isFirebaseConfigured()) {
          try {
            await deleteChatViaZApi(conv.contact.phone);
          } catch (err: any) {
            console.error('[Chat] Erro ao deletar chat na Z-API:', err);
          }
          // Delete from Firestore
          await deleteConversation(conv.id);
        } else {
          setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        }

        if (selectedId === conv.id) {
          setSelectedId(null);
          // no longer toggling showChat
        }

        toast({ title: 'Conversa apagada' });
      } catch (err: any) {
        console.error('[Chat] Erro ao apagar conversa:', err);
        toast({
          title: 'Erro ao apagar conversa',
          description: err?.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    },
    [selected, setConversations, toast]
  );

  // handleBack removed — list always visible on mobile

  const handlePreviewFiles = useCallback((files: PreviewFile[]) => {
    setPreviewFiles(files);
  }, []);

  const handlePreviewSend = useCallback(async (items: { file: PreviewFile; caption: string }[]) => {
    for (const { file, caption } of items) {
      if (file.type === 'video') {
        await handleSendVideo(file.base64, caption);
      } else {
        await handleSendImage(file.base64, caption);
      }
    }
    setPreviewFiles([]);
  }, [handleSendVideo, handleSendImage]);

  const handlePreviewSendAsSticker = useCallback((file: PreviewFile) => {
    // Compress to sticker size - reuse the logic
    const STICKER_SIZE = 512;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = STICKER_SIZE;
      canvas.height = STICKER_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = Math.min(STICKER_SIZE / img.width, STICKER_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (STICKER_SIZE - w) / 2;
      const y = (STICKER_SIZE - h) / 2;
      ctx.clearRect(0, 0, STICKER_SIZE, STICKER_SIZE);
      ctx.drawImage(img, x, y, w, h);
      const stickerData = canvas.toDataURL('image/png');
      handleSendSticker(stickerData);
      setPreviewFiles([]);
    };
    img.src = file.base64;
  }, [handleSendSticker]);

  const handlePreviewCancel = useCallback(() => {
    setPreviewFiles([]);
  }, []);

  const handlePreviewAddMore = useCallback(() => {
    addMoreInputRef.current?.click();
  }, []);

  const handleAddMoreFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('video/')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Falha ao ler vídeo'));
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const previewUrl = URL.createObjectURL(file);
        setPreviewFiles(prev => [...prev, { type: 'video', preview: previewUrl, base64 }]);
      } else if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Falha ao ler imagem'));
          reader.onload = () => {
            const imgEl = new window.Image();
            imgEl.onerror = () => reject(new Error('Falha ao carregar imagem'));
            imgEl.onload = () => {
              let { width, height } = imgEl;
              const MAX_DIM = 1024;
              if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) { height = Math.round(height * (MAX_DIM / width)); width = MAX_DIM; }
                else { width = Math.round(width * (MAX_DIM / height)); height = MAX_DIM; }
              }
              const canvas = document.createElement('canvas');
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas não suportado'));
              ctx.drawImage(imgEl, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            imgEl.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        });
        setPreviewFiles(prev => [...prev, { type: 'image', preview: base64, base64 }]);
      }
    }
    e.target.value = '';
  }, []);

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (!selected) return;
      if (isFirebaseConfigured()) {
        await toggleReaction(selected.id, messageId, emoji, 'me');

        // Send reaction via Z-API if message has a zapiMessageId
        const msg = messages.find((m) => m.id === messageId);
        if (msg?.zapiMessageId) {
          try {
            await sendReactionViaZApi(selected.contact.phone, msg.zapiMessageId, emoji);
          } catch (err) {
            console.error('[Chat] Erro ao enviar reação via Z-API:', err);
          }
        }
      }
    },
    [selected, messages]
  );

  if (convsLoading) {
    return (
      <div className="flex h-screen bg-whatsapp-dark overflow-hidden">
        <div className="w-[420px] p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (convsError) {
    return (
      <div className="flex h-screen bg-whatsapp-dark overflow-hidden items-center justify-center">
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 max-w-lg mx-4">
          <h2 className="text-red-400 font-semibold mb-2">Erro ao carregar conversas</h2>
          <p className="text-red-300 text-sm font-mono break-all">{convsError}</p>
          <p className="text-red-300/70 text-xs mt-3">
            Se o erro mencionar "index", clique no link acima para criar o índice no Firestore Console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] md:h-screen bg-whatsapp-dark overflow-hidden flex-col md:flex-row">
      <div
        className={cn(
          'flex-shrink-0 overflow-hidden',
          isMobile ? 'w-full basis-[38dvh] min-h-[220px] max-h-[45dvh] border-b border-whatsapp-border' : 'h-full w-[420px]'
        )}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selected?.id}
          onSelect={handleSelect}
          onDelete={handleDeleteChat}
        />
      </div>

      <div
        className={cn(
          'flex min-h-0 overflow-hidden',
          isMobile ? 'flex-1 w-full' : 'flex-1 h-full'
        )}
      >
        {selected ? (
          <>
            <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
              <ChatHeader
                contact={selected.contact}
                presenceStatus={presence.status}
                presenceLastSeen={presence.lastSeen}
                conversationId={selected.id}
                conversationTags={selected.tags || []}
                notesCount={notes.length}
                onTransfer={() => setTransferOpen(true)}
                onClose={() => setCloseDialogOpen(true)}
                onToggleNotes={() => { setShowNotes(v => !v); setShowContactInfo(false); }}
                onToggleContactInfo={() => { setShowContactInfo(v => !v); setShowNotes(false); }}
              />
              <ChatMessages messages={messages} loading={msgsLoading} contactAvatar={selected.contact.avatar} contactPhone={selected.contact.phone} conversations={conversations} onReact={handleReact} />
              <ChatInput onSend={handleSend} onSendImage={handleSendImage} onSendSticker={handleSendSticker} onSendGif={handleSendGif} onSendAudio={handleSendAudio} onSendVideo={handleSendVideo} onSendDocument={handleSendDocument} onSendLink={handleSendLink} onSendOptionList={handleSendOptionList} onSendLocation={handleSendLocation} onSendContact={handleSendContact} conversations={conversations} onPreviewFiles={handlePreviewFiles} />
              {previewFiles.length > 0 && (
                <ImagePreviewScreen
                  files={previewFiles}
                  onSend={handlePreviewSend}
                  onSendAsSticker={handlePreviewSendAsSticker}
                  onCancel={handlePreviewCancel}
                  onAddMore={handlePreviewAddMore}
                />
              )}
              <input
                ref={addMoreInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleAddMoreFileSelect}
              />
            </div>
            {showNotes && (
              <NotesPanel conversationId={selected.id} onClose={() => setShowNotes(false)} />
            )}
            {showContactInfo && (
              <ContactInfoPanel
                contact={selected.contact}
                onClose={() => setShowContactInfo(false)}
                transferHistory={selected.transferHistory}
                tenantId={appUser?.tenantId}
              />
            )}
            <TransferDialog
              open={transferOpen}
              onOpenChange={setTransferOpen}
              conversationId={selected.id}
              contactName={selected.contact.name}
            />
            <CloseConversationDialog
              open={closeDialogOpen}
              onOpenChange={setCloseDialogOpen}
              conversationId={selected.id}
              contactName={selected.contact.name}
              onClosed={() => setSelectedId(null)}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-whatsapp-chat">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-whatsapp-green/10 mb-4">
              <MessageSquare className="h-10 w-10 text-whatsapp-green" />
            </div>
            <h2 className="text-xl font-light text-whatsapp-text mb-2">WhatsApp Chat</h2>
            <p className="text-sm text-whatsapp-muted text-center max-w-md">
              Envie e receba mensagens pelo WhatsApp. Selecione uma conversa para começar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
