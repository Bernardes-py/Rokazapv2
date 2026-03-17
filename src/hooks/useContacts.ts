import { useState, useEffect } from 'react';
import { ContactRecord } from '@/types/crm';
import { subscribeToContacts, createContact, updateContact, deleteContact } from '@/services/crmService';
import { useTenant } from '@/contexts/TenantContext';

export function useContacts() {
  const { tenantId } = useTenant();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToContacts((list) => {
      setContacts(list);
      setLoading(false);
    }, tenantId || undefined);
    return unsub;
  }, [tenantId]);

  return {
    contacts,
    loading,
    createContact: (data: Omit<ContactRecord, 'id' | 'createdAt' | 'updatedAt'>) => createContact(data, tenantId || undefined),
    updateContact,
    deleteContact,
  };
}
