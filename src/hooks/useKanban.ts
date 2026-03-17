import { useState, useEffect } from 'react';
import { KanbanCard } from '@/types/crm';
import { subscribeToKanbanCards } from '@/services/crmService';
import { useTenant } from '@/contexts/TenantContext';

export function useKanban() {
  const { tenantId } = useTenant();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToKanbanCards((list) => {
      setCards(list);
      setLoading(false);
    }, tenantId || undefined);
    return unsub;
  }, [tenantId]);

  return { cards, loading };
}
