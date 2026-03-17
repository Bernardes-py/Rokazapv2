import { useState, useEffect } from 'react';
import { AppUser } from '@/types/user';
import { subscribeToUsers } from '@/services/userService';
import { useTenant } from '@/contexts/TenantContext';

export function useUsers() {
  const { tenantId } = useTenant();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToUsers((list) => {
      setUsers(list);
      setLoading(false);
    }, tenantId || undefined);
    return unsub;
  }, [tenantId]);

  return { users, loading };
}
