import { useState, useEffect } from 'react';
import { getOrCreateContact, updateContact as updateContactService } from '@/services/crmService';

export interface ContactInfo {
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

export function useContact(phone: string | undefined) {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) { setContact(null); setLoading(false); return; }
    setLoading(true);
    getOrCreateContact(phone).then(c => {
      setContact(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [phone]);

  const updateContact = async (data: Partial<ContactInfo>) => {
    if (!contact) return;
    await updateContactService(contact.id, data);
    setContact(prev => prev ? { ...prev, ...data, updatedAt: new Date() } : prev);
  };

  return { contact, loading, updateContact };
}
