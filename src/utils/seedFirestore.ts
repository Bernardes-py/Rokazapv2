import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const minutes = (m: number) => Timestamp.fromDate(new Date(Date.now() - m * 60000));
const hours = (h: number) => Timestamp.fromDate(new Date(Date.now() - h * 3600000));

export async function seedFirestoreTestData(userId: string): Promise<void> {
  if (!db) throw new Error('Firebase não configurado');

  const batch = writeBatch(db);

  // Contacts as conversation data
  const contacts = [
    { id: 'c1', name: 'Maria Silva', phone: '5511999990001' },
    { id: 'c2', name: 'João Santos', phone: '5511999990002' },
    { id: 'c3', name: 'Ana Oliveira', phone: '5511999990003' },
  ];

  // Conversation 1
  const conv1Ref = doc(collection(db, 'conversations'));
  batch.set(conv1Ref, {
    participants: [userId, contacts[0].phone],
    contactId: contacts[0].id,
    contactName: contacts[0].name,
    contactPhone: contacts[0].phone,
    contactAvatar: '',
    contactIsOnline: false,
    contactStatus: 'Disponível',
    lastMessageBody: 'Que ótimo! Muito obrigada 😊',
    lastMessageTimestamp: minutes(18),
    lastMessageStatus: 'read',
    lastMessageIsFromMe: false,
    unreadCount: 1,
    isPinned: true,
    isFavorite: true,
    isMuted: false,
    updatedAt: minutes(15),
    createdAt: hours(48),
  });

  // Messages for conv1
  const conv1Messages = [
    { from: contacts[0].phone, to: 'me', body: 'Oi! Tudo bem?', timestamp: minutes(30), isFromMe: false, status: 'read' },
    { from: 'me', to: contacts[0].phone, body: 'Tudo ótimo! E você?', timestamp: minutes(28), isFromMe: true, status: 'read' },
    { from: contacts[0].phone, to: 'me', body: 'Estou bem! Queria saber sobre o pedido #4521', timestamp: minutes(25), isFromMe: false, status: 'read' },
    { from: 'me', to: contacts[0].phone, body: 'O pedido #4521 já foi despachado e deve chegar amanhã!', timestamp: minutes(20), isFromMe: true, status: 'read' },
    { from: contacts[0].phone, to: 'me', body: 'Que ótimo! Muito obrigada 😊', timestamp: minutes(18), isFromMe: false, status: 'read' },
  ];

  for (const msg of conv1Messages) {
    const msgRef = doc(collection(db, 'conversations', conv1Ref.id, 'messages'));
    batch.set(msgRef, { ...msg, conversationId: conv1Ref.id, type: 'text' });
  }

  // Conversation 2
  const conv2Ref = doc(collection(db, 'conversations'));
  batch.set(conv2Ref, {
    participants: [userId, contacts[1].phone],
    contactId: contacts[1].id,
    contactName: contacts[1].name,
    contactPhone: contacts[1].phone,
    contactAvatar: '',
    contactIsOnline: false,
    contactStatus: 'No trabalho',
    lastMessageBody: 'Pode me confirmar seu email?',
    lastMessageTimestamp: minutes(48),
    lastMessageStatus: 'delivered',
    lastMessageIsFromMe: true,
    unreadCount: 0,
    isPinned: false,
    isFavorite: false,
    isMuted: false,
    updatedAt: minutes(48),
    createdAt: hours(24),
  });

  const conv2Messages = [
    { from: contacts[1].phone, to: 'me', body: 'Preciso de ajuda com minha conta', timestamp: hours(1), isFromMe: false, status: 'read' },
    { from: 'me', to: contacts[1].phone, body: 'Claro, como posso ajudar?', timestamp: minutes(55), isFromMe: true, status: 'read' },
    { from: 'me', to: contacts[1].phone, body: 'Pode me confirmar seu email?', timestamp: minutes(48), isFromMe: true, status: 'delivered' },
  ];

  for (const msg of conv2Messages) {
    const msgRef = doc(collection(db, 'conversations', conv2Ref.id, 'messages'));
    batch.set(msgRef, { ...msg, conversationId: conv2Ref.id, type: 'text' });
  }

  // Conversation 3
  const conv3Ref = doc(collection(db, 'conversations'));
  batch.set(conv3Ref, {
    participants: [userId, contacts[2].phone],
    contactId: contacts[2].id,
    contactName: contacts[2].name,
    contactPhone: contacts[2].phone,
    contactAvatar: '',
    contactIsOnline: false,
    contactStatus: 'Ocupada',
    lastMessageBody: 'Vou dar uma olhada no site',
    lastMessageTimestamp: hours(2),
    lastMessageStatus: 'read',
    lastMessageIsFromMe: false,
    unreadCount: 2,
    isPinned: false,
    isFavorite: true,
    isMuted: false,
    updatedAt: hours(2),
    createdAt: hours(72),
  });

  const conv3Messages = [
    { from: contacts[2].phone, to: 'me', body: 'Bom dia! Vocês tem promoção hoje?', timestamp: hours(3), isFromMe: false, status: 'read' },
    { from: 'me', to: contacts[2].phone, body: 'Bom dia Ana! Sim, temos 20% de desconto na linha premium', timestamp: hours(2.5), isFromMe: true, status: 'read' },
    { from: contacts[2].phone, to: 'me', body: 'Vou dar uma olhada no site', timestamp: hours(2), isFromMe: false, status: 'read' },
  ];

  for (const msg of conv3Messages) {
    const msgRef = doc(collection(db, 'conversations', conv3Ref.id, 'messages'));
    batch.set(msgRef, { ...msg, conversationId: conv3Ref.id, type: 'text' });
  }

  await batch.commit();
  console.log('✅ Dados de teste criados com sucesso no Firestore!');
}
