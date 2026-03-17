import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Conversation } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { subscribeToConversations, subscribeToAllConversations } from '@/services/firestoreService';
import { isFirebaseConfigured } from '@/lib/firebase';
import { mockConversations } from '@/data/mockData';

const ALL_ACCESS_DEPARTMENTS = ['Atendente', 'Tecnologia', 'Comercial'];

function mergeConversations(prev: Conversation[], incoming: Conversation[]): Conversation[] {
  const map = new Map(prev.map((c) => [c.id, c]));
  incoming.forEach((c) => map.set(c.id, c));
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function useConversations() {
  const { user, appUser } = useAuth();
  const { tenantId } = useTenant();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastValidRef = useRef<Conversation[]>([]);

  const seeAll = appUser ? ALL_ACCESS_DEPARTMENTS.includes(appUser.department) : false;

  // Wrapped setter that never allows emptying if we already have data
  const safeSetConversations = useCallback((incoming: Conversation[]) => {
    if (incoming.length === 0 && lastValidRef.current.length > 0) {
      console.log('[useConversations] Ignoring empty snapshot, keeping', lastValidRef.current.length, 'cached conversations');
      return;
    }
    const merged = mergeConversations(lastValidRef.current, incoming);
    lastValidRef.current = merged;
    setConversations(merged);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      setConversations(mockConversations);
      setLoading(false);
      return;
    }

    console.log('[useConversations] subscribing - user.uid:', user.uid, 'seeAll:', seeAll, 'tenantId:', tenantId);
    setLoading(true);

    const onData = (convs: Conversation[]) => {
      safeSetConversations(convs);
      setLoading(false);
      setError(null);
    };
    const onErr = (errMsg: string) => {
      console.error('[useConversations] Firestore error:', errMsg);
      setError(errMsg);
      setLoading(false);
      // Keep showing cached data on error
    };

    const unsubscribe = seeAll
      ? subscribeToAllConversations(onData, onErr, tenantId || undefined)
      : subscribeToConversations(user.uid, onData, onErr, tenantId || undefined);

    return unsubscribe;
  }, [user, seeAll, tenantId, safeSetConversations]);

  const canSeeAllDepartments = ['Atendente', 'Tecnologia', 'Comercial'];
  const canSeeClosed = appUser ? canSeeAllDepartments.includes(appUser.department) : false;

  const INTERNAL_SUFFIXES = ['@lid', '@newsletter', '@g.us'];

  const filteredConversations = useMemo(() => {
    let result = conversations.filter(
      (c) => !INTERNAL_SUFFIXES.some((s) => (c as any).contactPhone?.includes(s) || c.contact?.phone?.includes(s))
    );
    if (!canSeeClosed) result = result.filter((c) => c.status !== 'closed');
    return result;
  }, [conversations, canSeeClosed]);

  return { conversations: filteredConversations, setConversations, loading, error };
}
