import { useState, useEffect } from 'react';
import { Tag } from '@/types/crm';
import { subscribeToTags } from '@/services/crmService';
import { useTenant } from '@/contexts/TenantContext';

export function useTags() {
  const { tenantId } = useTenant();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTags((list) => {
      setTags(list);
      setLoading(false);
    }, tenantId || undefined);
    return unsub;
  }, [tenantId]);

  return { tags, loading };
}
