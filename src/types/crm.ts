export interface Tag {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: Date;
}

export interface Note {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransferRecord {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  note?: string;
  at: Date;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  column: 'todo' | 'doing' | 'done';
  assignedTo?: string;
  assignedName?: string;
  conversationId?: string;
  contactPhone?: string;
  priority: 'low' | 'medium' | 'high';
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

export interface ContactRecord {
  id: string;
  phone: string;
  name: string;
  avatar: string;
  email: string;
  cpf: string;
  condominium: string;
  block: string;
  unit: string;
  address: string;
  customNotes: string;
  tags: string[];
  blocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
