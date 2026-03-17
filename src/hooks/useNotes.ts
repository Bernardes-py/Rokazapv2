import { useState, useEffect } from 'react';
import { Note } from '@/types/crm';
import { subscribeToNotes } from '@/services/crmService';

export function useNotes(conversationId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToNotes(conversationId, (list) => {
      setNotes(list);
      setLoading(false);
    });
    return unsub;
  }, [conversationId]);

  return { notes, loading };
}
