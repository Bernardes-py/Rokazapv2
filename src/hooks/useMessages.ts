import { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from '@/types/chat';
import { subscribeToMessages, fetchMessagesOnce } from '@/services/firestoreService';
import { isFirebaseConfigured } from '@/lib/firebase';
import { mockMessages } from '@/data/mockData';

function safeTime(ts: any): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.getTime === 'function') return ts.getTime();
  return new Date(ts).getTime() || 0;
}

// Persistent cache that survives HMR cycles (module-level)
const messageCache = new Map<string, Map<string, Message>>();

function getCacheForConversation(convId: string): Map<string, Message> {
  if (!messageCache.has(convId)) {
    messageCache.set(convId, new Map());
  }
  return messageCache.get(convId)!;
}

function mergeIntoCache(convId: string, msgs: Message[]): Message[] {
  const cache = getCacheForConversation(convId);
  msgs.forEach((m) => cache.set(m.id, m));
  return Array.from(cache.values()).sort(
    (a, b) => safeTime(a.timestamp) - safeTime(b.timestamp)
  );
}

export function useMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const lastConvIdRef = useRef<string | undefined>();

  const appendOptimisticMessage = useCallback((message: Message) => {
    if (conversationId) {
      const sorted = mergeIntoCache(conversationId, [message]);
      setMessages(sorted);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // When switching conversations, immediately show cached data if available
    if (lastConvIdRef.current !== conversationId) {
      lastConvIdRef.current = conversationId;
      const cache = getCacheForConversation(conversationId);
      if (cache.size > 0) {
        const cached = Array.from(cache.values()).sort(
          (a, b) => safeTime(a.timestamp) - safeTime(b.timestamp)
        );
        console.log(`[useMessages] restored ${cached.length} cached msgs for ${conversationId}`);
        setMessages(cached);
      } else {
        setMessages([]);
      }
    }

    if (!isFirebaseConfigured()) {
      setMessages(mockMessages[conversationId] || []);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1) Hydrate with one-time fetch
    fetchMessagesOnce(conversationId)
      .then((msgs) => {
        if (lastConvIdRef.current !== conversationId) return;
        if (msgs.length > 0) {
          const sorted = mergeIntoCache(conversationId, msgs);
          console.log(`[useMessages] hydration: ${msgs.length} msgs, total: ${sorted.length}`);
          setMessages(sorted);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useMessages] hydration error:', err);
        if (lastConvIdRef.current === conversationId) setLoading(false);
      });

    // 2) Realtime listener — merges into cache
    const unsubscribe = subscribeToMessages(conversationId, (incomingMsgs) => {
      if (lastConvIdRef.current !== conversationId) return;

      // Never zero out with an empty snapshot if cache has data
      if (incomingMsgs.length === 0) {
        const cache = getCacheForConversation(conversationId);
        if (cache.size > 0) {
          console.log('[useMessages] ignoring empty snapshot, cache has', cache.size, 'msgs');
          return;
        }
        setLoading(false);
        return;
      }

      const sorted = mergeIntoCache(conversationId, incomingMsgs);
      console.log(`[useMessages] listener: ${incomingMsgs.length} incoming, total: ${sorted.length}`);
      setMessages(sorted);
      setLoading(false);
    });

    // 3) Polling fallback every 3s
    const pollInterval = setInterval(async () => {
      if (lastConvIdRef.current !== conversationId) return;
      try {
        const polled = await fetchMessagesOnce(conversationId);
        if (polled.length > 0 && lastConvIdRef.current === conversationId) {
          const cache = getCacheForConversation(conversationId);
          const prevSize = cache.size;
          const sorted = mergeIntoCache(conversationId, polled);
          if (sorted.length !== prevSize) {
            console.log(`[useMessages] poll found new msgs: ${sorted.length} (was ${prevSize})`);
            setMessages(sorted);
          }
        }
      } catch {
        // silent fallback polling
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [conversationId]);

  return { messages, loading, appendOptimisticMessage };
}
