import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Conversation, Message, Contact } from '@/types/chat';

function timestampToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function docToConversation(docSnap: any): Conversation {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    contactId: d.contactId || '',
    contact: {
      id: d.contactId || '',
      name: d.contactName || '',
      phone: d.contactPhone || '',
      avatar: d.contactAvatar || '',
      isOnline: d.contactIsOnline || false,
      status: d.contactStatus || '',
    },
    lastMessage: d.lastMessageBody
      ? {
          id: 'last',
          conversationId: docSnap.id,
          from: d.lastMessageIsFromMe ? 'me' : d.contactPhone,
          to: d.lastMessageIsFromMe ? d.contactPhone : 'me',
          body: d.lastMessageBody,
          timestamp: timestampToDate(d.lastMessageTimestamp),
          status: d.lastMessageStatus || 'sent',
          type: 'text',
          isFromMe: d.lastMessageIsFromMe || false,
        }
      : undefined,
    unreadCount: d.unreadCount || 0,
    isPinned: d.isPinned || false,
    isFavorite: d.isFavorite || false,
    isMuted: d.isMuted || false,
    assignedTo: d.assignedTo,
    tags: d.tags || [],
    transferHistory: (d.transferHistory || []).map((t: any) => ({
      fromUserId: t.fromUserId || '',
      fromName: t.fromName || '',
      toUserId: t.toUserId || '',
      toName: t.toName || '',
      note: t.note,
      at: t.at ? new Date(t.at) : new Date(),
    })),
    status: d.status || 'open',
    closedAt: d.closedAt ? timestampToDate(d.closedAt) : undefined,
    closedBy: d.closedBy,
    closedByName: d.closedByName,
    closureNote: d.closureNote,
    updatedAt: timestampToDate(d.updatedAt),
    createdAt: timestampToDate(d.createdAt),
  };
}

function docToMessage(docSnap: any): Message {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    conversationId: d.conversationId || '',
    from: d.from || '',
    to: d.to || '',
    body: d.body || '',
    timestamp: timestampToDate(d.timestamp),
    status: d.status || 'sent',
    type: d.type || 'text',
    isFromMe: d.isFromMe || false,
    mediaUrl: d.mediaUrl,
    mediaMimeType: d.mediaMimeType,
    mediaFileName: d.mediaFileName,
    mediaFileSize: d.mediaFileSize,
    mediaPageCount: d.mediaPageCount,
    mediaDuration: d.mediaDuration,
    thumbnailUrl: d.thumbnailUrl,
    latitude: d.latitude,
    longitude: d.longitude,
    locationTitle: d.locationTitle,
    locationAddress: d.locationAddress,
    linkUrl: d.linkUrl,
    linkTitle: d.linkTitle,
    linkDescription: d.linkDescription,
    linkImage: d.linkImage,
    quotedMessage: d.quotedMessage,
    zapiMessageId: d.zapiMessageId,
    reactions: d.reactions || {},
    optionList: d.optionList,
    contactName: d.contactName,
    contactPhone: d.contactPhone,
    contacts: d.contacts,
    senderName: d.senderName,
    senderDepartment: d.senderDepartment,
  };
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: string) => void,
  tenantId?: string
): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }

  const constraints: any[] = [
    where('tenantId', '==', tenantId),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  ];

  const q = query(collection(db, 'conversations'), ...constraints);

  return onSnapshot(q, (snapshot) => {
    const convs = snapshot.docs.map(docToConversation);
    callback(convs);
  }, (error) => {
    console.error('Erro ao escutar conversas:', error);
    onError?.(error.message);
  });
}

export function subscribeToAllConversations(
  callback: (conversations: Conversation[]) => void,
  onError?: (error: string) => void,
  tenantId?: string
): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }

  const constraints: any[] = [
    where('tenantId', '==', tenantId),
    orderBy('updatedAt', 'desc'),
  ];

  const q = query(collection(db, 'conversations'), ...constraints);

  return onSnapshot(q, (snapshot) => {
    const convs = snapshot.docs.map(docToConversation);
    callback(convs);
  }, (error) => {
    console.error('Erro ao escutar todas as conversas:', error);
    onError?.(error.message);
  });
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
): () => void {
  if (!db) return () => {};

  const q = query(
    collection(db, 'conversations', conversationId, 'messages')
  );

  let stopped = false;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const emit = (snapshot: any) => {
    const msgs = snapshot.docs.map(docToMessage);
    msgs.sort((a, b) => {
      const ta = a.timestamp?.getTime?.() || Date.now();
      const tb = b.timestamp?.getTime?.() || Date.now();
      return ta - tb;
    });
    callback(msgs);
  };

  const start = () => {
    if (stopped) return;
    unsubscribe?.();

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        retries = 0;
        emit(snapshot);
      },
      (error) => {
        console.error('Erro ao escutar mensagens:', error);
        if (stopped) return;

        const delayMs = Math.min(15000, 1000 * 2 ** retries);
        retries += 1;

        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          console.warn(`[messages] reconectando listener da conversa ${conversationId}...`);
          start();
        }, delayMs);
      }
    );
  };

  start();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    unsubscribe?.();
  };
}

export async function sendMessage(
  conversationId: string,
  message: Omit<Message, 'id'>
): Promise<string> {
  if (!db) return '';

  const msgRef = await addDoc(
    collection(db, 'conversations', conversationId, 'messages'),
    {
      ...message,
      timestamp: serverTimestamp(),
    }
  );

  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    lastMessageBody: message.body,
    lastMessageTimestamp: serverTimestamp(),
    lastMessageStatus: message.status,
    lastMessageIsFromMe: message.isFromMe,
    updatedAt: serverTimestamp(),
  });

  return msgRef.id;
}

export async function markAsRead(conversationId: string): Promise<void> {
  if (!db) return;
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, { unreadCount: 0 });
}

export async function createConversation(
  userId: string,
  contact: Contact,
  tenantId?: string
): Promise<string> {
  if (!db) return '';

  const data: any = {
    participants: [userId, contact.phone],
    contactId: contact.id,
    contactName: contact.name,
    contactPhone: contact.phone,
    contactAvatar: contact.avatar || '',
    contactIsOnline: false,
    contactStatus: '',
    unreadCount: 0,
    isPinned: false,
    isFavorite: false,
    isMuted: false,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  if (tenantId) data.tenantId = tenantId;

  const convRef = await addDoc(collection(db, 'conversations'), data);
  return convRef.id;
}

export async function toggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  if (!db) return;

  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;

  const data = msgSnap.data();
  const reactions: Record<string, string[]> = data.reactions || {};
  const users = reactions[emoji] || [];

  if (users.includes(userId)) {
    reactions[emoji] = users.filter((u) => u !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji] = [...users, userId];
  }

  await updateDoc(msgRef, { reactions });
}

export async function fetchMessagesOnce(
  conversationId: string
): Promise<Message[]> {
  if (!db) return [];
  const q = query(
    collection(db, 'conversations', conversationId, 'messages')
  );
  const snapshot = await getDocs(q);
  const msgs = snapshot.docs.map(docToMessage);
  msgs.sort((a, b) => {
    const ta = a.timestamp?.getTime?.() || Date.now();
    const tb = b.timestamp?.getTime?.() || Date.now();
    return ta - tb;
  });
  return msgs;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  if (!db) return;

  // Delete all messages in the subcollection first
  const msgsRef = collection(db, 'conversations', conversationId, 'messages');
  const msgsSnap = await getDocs(msgsRef);
  const batch = writeBatch(db);
  msgsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Delete the conversation document
  await deleteDoc(doc(db, 'conversations', conversationId));
}
