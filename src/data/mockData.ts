import { Contact, Conversation, Message } from '@/types/chat';

const now = new Date();
const minutes = (m: number) => new Date(now.getTime() - m * 60000);
const hours = (h: number) => new Date(now.getTime() - h * 3600000);

export const mockContacts: Contact[] = [
  { id: '1', name: 'Maria Silva', phone: '5511999990001', avatar: '', isOnline: true, status: 'Disponível' },
  { id: '2', name: 'João Santos', phone: '5511999990002', avatar: '', isOnline: false, lastSeen: minutes(15), status: 'No trabalho' },
  { id: '3', name: 'Ana Oliveira', phone: '5511999990003', avatar: '', isOnline: true, status: 'Ocupada' },
  { id: '4', name: 'Carlos Pereira', phone: '5511999990004', avatar: '', isOnline: false, lastSeen: hours(2) },
  { id: '5', name: 'Fernanda Costa', phone: '5511999990005', avatar: '', isOnline: true },
  { id: '6', name: 'Roberto Lima', phone: '5511999990006', avatar: '', isOnline: false, lastSeen: hours(5) },
  { id: '7', name: 'Beatriz Souza', phone: '5511999990007', avatar: '', isOnline: true, status: 'Férias 🏖️' },
  { id: '8', name: 'Pedro Almeida', phone: '5511999990008', avatar: '', isOnline: false, lastSeen: minutes(45) },
];

export const mockMessages: Record<string, Message[]> = {
  '1': [
    { id: 'm1', conversationId: '1', from: '5511999990001', to: 'me', body: 'Oi! Tudo bem?', timestamp: minutes(30), status: 'read', type: 'text', isFromMe: false },
    { id: 'm2', conversationId: '1', from: 'me', to: '5511999990001', body: 'Tudo ótimo! E você?', timestamp: minutes(28), status: 'read', type: 'text', isFromMe: true },
    { id: 'm3', conversationId: '1', from: '5511999990001', to: 'me', body: 'Estou bem! Queria saber sobre o pedido #4521', timestamp: minutes(25), status: 'read', type: 'text', isFromMe: false },
    { id: 'm4', conversationId: '1', from: 'me', to: '5511999990001', body: 'Claro! Deixa eu verificar aqui no sistema...', timestamp: minutes(23), status: 'read', type: 'text', isFromMe: true },
    { id: 'm5', conversationId: '1', from: 'me', to: '5511999990001', body: 'O pedido #4521 já foi despachado e deve chegar amanhã!', timestamp: minutes(20), status: 'read', type: 'text', isFromMe: true },
    { id: 'm6', conversationId: '1', from: '5511999990001', to: 'me', body: 'Que ótimo! Muito obrigada 😊', timestamp: minutes(18), status: 'read', type: 'text', isFromMe: false },
    { id: 'm7', conversationId: '1', from: 'me', to: '5511999990001', body: 'Por nada! Qualquer dúvida estou à disposição', timestamp: minutes(15), status: 'delivered', type: 'text', isFromMe: true },
  ],
  '2': [
    { id: 'm8', conversationId: '2', from: '5511999990002', to: 'me', body: 'Preciso de ajuda com minha conta', timestamp: hours(1), status: 'read', type: 'text', isFromMe: false },
    { id: 'm9', conversationId: '2', from: 'me', to: '5511999990002', body: 'Claro, como posso ajudar?', timestamp: minutes(55), status: 'read', type: 'text', isFromMe: true },
    { id: 'm10', conversationId: '2', from: '5511999990002', to: 'me', body: 'Não consigo acessar a área do cliente', timestamp: minutes(50), status: 'read', type: 'text', isFromMe: false },
    { id: 'm11', conversationId: '2', from: 'me', to: '5511999990002', body: 'Vou resetar sua senha. Pode me confirmar seu email?', timestamp: minutes(48), status: 'delivered', type: 'text', isFromMe: true },
  ],
  '3': [
    { id: 'm12', conversationId: '3', from: '5511999990003', to: 'me', body: 'Bom dia! Vocês tem promoção hoje?', timestamp: hours(3), status: 'read', type: 'text', isFromMe: false },
    { id: 'm13', conversationId: '3', from: 'me', to: '5511999990003', body: 'Bom dia Ana! Sim, temos 20% de desconto em todos os produtos da linha premium', timestamp: hours(2.5), status: 'read', type: 'text', isFromMe: true },
    { id: 'm14', conversationId: '3', from: '5511999990003', to: 'me', body: 'Maravilha! Vou dar uma olhada no site', timestamp: hours(2), status: 'read', type: 'text', isFromMe: false },
  ],
  '4': [
    { id: 'm15', conversationId: '4', from: '5511999990004', to: 'me', body: 'Boa tarde', timestamp: hours(5), status: 'read', type: 'text', isFromMe: false },
    { id: 'm16', conversationId: '4', from: 'me', to: '5511999990004', body: 'Boa tarde Carlos! Como posso ajudar?', timestamp: hours(4.8), status: 'sent', type: 'text', isFromMe: true },
  ],
  '5': [
    { id: 'm17', conversationId: '5', from: '5511999990005', to: 'me', body: 'Quero fazer uma reclamação', timestamp: minutes(10), status: 'read', type: 'text', isFromMe: false },
    { id: 'm18', conversationId: '5', from: '5511999990005', to: 'me', body: 'O produto veio com defeito!', timestamp: minutes(9), status: 'read', type: 'text', isFromMe: false },
    { id: 'm19', conversationId: '5', from: 'me', to: '5511999990005', body: 'Lamento muito por isso, Fernanda. Pode me enviar fotos do produto?', timestamp: minutes(7), status: 'delivered', type: 'text', isFromMe: true },
  ],
};

export const mockConversations: Conversation[] = [
  {
    id: '1', contactId: '1', contact: mockContacts[0],
    lastMessage: mockMessages['1'][mockMessages['1'].length - 1],
    unreadCount: 0, isPinned: true, isFavorite: true, isMuted: false,
    updatedAt: minutes(15), createdAt: hours(48),
  },
  {
    id: '5', contactId: '5', contact: mockContacts[4],
    lastMessage: mockMessages['5'][mockMessages['5'].length - 1],
    unreadCount: 2, isPinned: false, isFavorite: false, isMuted: false,
    updatedAt: minutes(7), createdAt: hours(1),
  },
  {
    id: '2', contactId: '2', contact: mockContacts[1],
    lastMessage: mockMessages['2'][mockMessages['2'].length - 1],
    unreadCount: 1, isPinned: false, isFavorite: false, isMuted: false,
    updatedAt: minutes(48), createdAt: hours(24),
  },
  {
    id: '3', contactId: '3', contact: mockContacts[2],
    lastMessage: mockMessages['3'][mockMessages['3'].length - 1],
    unreadCount: 0, isPinned: false, isFavorite: true, isMuted: false,
    updatedAt: hours(2), createdAt: hours(72),
  },
  {
    id: '4', contactId: '4', contact: mockContacts[3],
    lastMessage: mockMessages['4'][mockMessages['4'].length - 1],
    unreadCount: 0, isPinned: false, isFavorite: false, isMuted: true,
    updatedAt: hours(4.8), createdAt: hours(96),
  },
  {
    id: '6', contactId: '6', contact: mockContacts[5], unreadCount: 0, isPinned: false, isFavorite: false, isMuted: false, updatedAt: hours(24), createdAt: hours(120) },
  {
    id: '7', contactId: '7', contact: mockContacts[6], unreadCount: 0, isPinned: false, isFavorite: false, isMuted: false, updatedAt: hours(48), createdAt: hours(200) },
  {
    id: '8', contactId: '8', contact: mockContacts[7], unreadCount: 0, isPinned: false, isFavorite: false, isMuted: false, updatedAt: hours(72), createdAt: hours(300) },
];
