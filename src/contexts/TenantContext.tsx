import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tenant } from '@/types/tenant';
import { getTenant } from '@/services/tenantService';

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({ tenant: null, tenantId: '', loading: true });

export function TenantProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = appUser?.tenantId || '';

  useEffect(() => {
    if (!tenantId) {
      setTenant(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getTenant(tenantId)
      .then(setTenant)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  return (
    <TenantContext.Provider value={{ tenant, tenantId, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
