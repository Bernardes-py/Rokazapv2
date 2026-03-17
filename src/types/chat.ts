export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  status?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'contact' | 'gif' | 'link' | 'option-list' | 'system';
  isFromMe: boolean;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaFileSize?: number;
  mediaPageCount?: number;
  mediaDuration?: number;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  locationTitle?: string;
  locationAddress?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  quotedMessage?: {
    id: string;
    body: string;
    from: string;
  };
  zapiMessageId?: string;
  reactions?: Record<string, string[]>; // emoji -> array of user IDs who reacted
  optionList?: {
    title: string;
    buttonLabel: string;
    options: Array<{ id?: string; title: string; description: string }>;
  };
  contactName?: string;
  contactPhone?: string;
  contacts?: Array<{ name: string; phones: string[] }>;
  senderName?: string;
  senderDepartment?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contact: Contact;
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isFavorite: boolean;
  isMuted: boolean;
  assignedTo?: string;
  tags?: string[];
  transferHistory?: Array<{
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    note?: string;
    at: Date;
  }>;
  status?: 'open' | 'closed';
  closedAt?: Date;
  closedBy?: string;
  closedByName?: string;
  closureNote?: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  clientToken: string;
  apiUrl: string;
  webhookUrl?: string;
}

export type ConversationFilter = 'all' | 'unread' | 'favorites';
