import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDocs,
  where,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import app from '@/lib/firebase';
import { Tag, Note, KanbanCard, ContactRecord } from '@/types/crm';

function timestampToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

// ─── Tags ───────────────────────────────────────────────

export function subscribeToTags(callback: (tags: Tag[]) => void, tenantId?: string): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }
  const constraints: any[] = [
    where('tenantId', '==', tenantId),
    orderBy('name', 'asc'),
  ];
  const q = query(collection(db, 'tags'), ...constraints);
  return onSnapshot(q, (snap) => {
    const tags = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        color: data.color || '#6b7280',
        createdBy: data.createdBy || '',
        createdAt: timestampToDate(data.createdAt),
      } as Tag;
    });
    callback(tags);
  });
}

export async function createTag(name: string, color: string, createdBy: string, tenantId?: string): Promise<string> {
  if (!db) return '';
  const data: any = { name, color, createdBy, createdAt: serverTimestamp() };
  if (tenantId) data.tenantId = tenantId;
  const ref = await addDoc(collection(db, 'tags'), data);
  return ref.id;
}

export async function updateTag(tagId: string, data: { name?: string; color?: string }): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'tags', tagId), data);
}

export async function deleteTag(tagId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'tags', tagId));
}

// ─── Conversation Tags ─────────────────────────────────

export async function addTagToConversation(conversationId: string, tagId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId), { tags: arrayUnion(tagId) });
}

export async function removeTagFromConversation(conversationId: string, tagId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId), { tags: arrayRemove(tagId) });
}

// ─── Transfer ───────────────────────────────────────────

export async function transferConversation(
  conversationId: string,
  transfer: { fromUserId: string; fromName: string; toUserId: string; toName: string; note?: string }
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId), {
    assignedTo: transfer.toUserId,
    participants: arrayUnion(transfer.toUserId),
    transferHistory: arrayUnion({
      fromUserId: transfer.fromUserId,
      fromName: transfer.fromName,
      toUserId: transfer.toUserId,
      toName: transfer.toName,
      note: transfer.note || '',
      at: new Date().toISOString(),
    }),
    // Reopen if closed
    status: 'open',
    closedAt: null,
    closedBy: null,
    closedByName: null,
    closureNote: null,
    updatedAt: serverTimestamp(),
  });

  // Insert system message in the timeline
  let systemBody = `Conversa transferida de ${transfer.fromName} para ${transfer.toName}`;
  if (transfer.note) {
    systemBody += `\nNota: ${transfer.note}`;
  }
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    from: 'system',
    to: '',
    body: systemBody,
    timestamp: serverTimestamp(),
    status: 'read',
    type: 'system',
    isFromMe: false,
  });
}

// ─── Close Conversation ─────────────────────────────────

export async function closeConversation(
  conversationId: string,
  data: { userId: string; userName: string; note: string }
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId), {
    status: 'closed',
    closedAt: serverTimestamp(),
    closedBy: data.userId,
    closedByName: data.userName,
    closureNote: data.note,
    updatedAt: serverTimestamp(),
  });

  const systemBody = `Conversa concluída por ${data.userName}\nNota: ${data.note}`;
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    from: 'system',
    to: '',
    body: systemBody,
    timestamp: serverTimestamp(),
    status: 'read',
    type: 'system',
    isFromMe: false,
  });
}

// ─── Notes ──────────────────────────────────────────────

export function subscribeToNotes(conversationId: string, callback: (notes: Note[]) => void): () => void {
  if (!db) return () => {};
  const q = query(
    collection(db, 'conversations', conversationId, 'notes'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const notes = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: data.text || '',
        authorId: data.authorId || '',
        authorName: data.authorName || '',
        color: data.color || '#fef3c7',
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      } as Note;
    });
    callback(notes);
  });
}

export async function addNote(
  conversationId: string,
  note: { text: string; authorId: string; authorName: string; color: string }
): Promise<string> {
  if (!db) return '';
  const ref = await addDoc(collection(db, 'conversations', conversationId, 'notes'), {
    ...note,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNote(conversationId: string, noteId: string, text: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', conversationId, 'notes', noteId), {
    text,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(conversationId: string, noteId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'conversations', conversationId, 'notes', noteId));
}

// ─── Kanban ─────────────────────────────────────────────

export function subscribeToKanbanCards(callback: (cards: KanbanCard[]) => void, tenantId?: string): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }
  const constraints: any[] = [
    where('tenantId', '==', tenantId),
    orderBy('order', 'asc'),
  ];
  const q = query(collection(db, 'kanban_cards'), ...constraints);
  return onSnapshot(q, (snap) => {
    const cards = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || '',
        description: data.description || '',
        column: data.column || 'todo',
        assignedTo: data.assignedTo,
        assignedName: data.assignedName,
        conversationId: data.conversationId,
        contactPhone: data.contactPhone,
        priority: data.priority || 'medium',
        createdBy: data.createdBy || '',
        createdByName: data.createdByName || '',
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
        order: data.order || 0,
      } as KanbanCard;
    });
    callback(cards);
  });
}

export async function addKanbanCard(card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>, tenantId?: string): Promise<string> {
  if (!db) return '';
  const data: any = { ...card, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (tenantId) data.tenantId = tenantId;
  const ref = await addDoc(collection(db, 'kanban_cards'), data);
  return ref.id;
}

export async function updateKanbanCard(cardId: string, data: Partial<KanbanCard>): Promise<void> {
  if (!db) return;
  const { id, createdAt, ...rest } = data as any;
  await updateDoc(doc(db, 'kanban_cards', cardId), { ...rest, updatedAt: serverTimestamp() });
}

export async function deleteKanbanCard(cardId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'kanban_cards', cardId));
}

export async function moveKanbanCard(cardId: string, column: KanbanCard['column'], order: number): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'kanban_cards', cardId), { column, order, updatedAt: serverTimestamp() });
}

// ─── Contacts ───────────────────────────────────────────

function docToContact(d: any): ContactRecord {
  const data = d.data();
  return {
    id: d.id,
    phone: data.phone || '',
    name: data.name || '',
    avatar: data.avatar || '',
    email: data.email || '',
    cpf: data.cpf || '',
    condominium: data.condominium || '',
    block: data.block || '',
    unit: data.unit || '',
    address: data.address || '',
    customNotes: data.customNotes || '',
    tags: data.tags || [],
    blocked: data.blocked ?? false,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export function subscribeToContacts(callback: (contacts: ContactRecord[]) => void, tenantId?: string): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }
  const constraints: any[] = [
    where('tenantId', '==', tenantId),
    orderBy('name', 'asc'),
  ];
  const q = query(collection(db, 'contacts'), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(docToContact));
  });
}

export async function getOrCreateContact(phone: string): Promise<ContactRecord> {
  if (!db) return null as any;
  const q = query(collection(db, 'contacts'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.size > 0) {
    return docToContact(snap.docs[0]);
  }
  const ref = await addDoc(collection(db, 'contacts'), {
    phone, name: '', avatar: '', email: '', cpf: '',
    condominium: '', block: '', unit: '', address: '',
    customNotes: '', tags: [],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return {
    id: ref.id, phone, name: '', avatar: '', email: '', cpf: '',
    condominium: '', block: '', unit: '', address: '',
    customNotes: '', tags: [], blocked: false,
    createdAt: new Date(), updatedAt: new Date(),
  };
}

export async function createContact(data: Omit<ContactRecord, 'id' | 'createdAt' | 'updatedAt'>, tenantId?: string): Promise<string> {
  if (!db) return '';
  const payload: any = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (tenantId) payload.tenantId = tenantId;
  const ref = await addDoc(collection(db, 'contacts'), payload);
  return ref.id;
}

export async function updateContact(contactId: string, data: Partial<ContactRecord>): Promise<void> {
  if (!db) return;
  const { id, createdAt, ...rest } = data as any;
  await updateDoc(doc(db, 'contacts', contactId), { ...rest, updatedAt: serverTimestamp() });
}

export async function deleteContact(contactId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'contacts', contactId));
}

export async function deleteAllContacts(tenantId?: string): Promise<number> {
  if (!db) return 0;
  let q: any = collection(db, 'contacts');
  if (tenantId) {
    q = query(q, where('tenantId', '==', tenantId));
  }
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function syncContactsFromConversations(): Promise<{ created: number; skipped: number; total: number }> {
  if (!app) return { created: 0, skipped: 0, total: 0 };
  const functions = getFunctions(app);
  const callable = httpsCallable<void, { created: number; skipped: number; total: number }>(functions, 'seedContacts');
  const result = await callable();
  return result.data;
}
