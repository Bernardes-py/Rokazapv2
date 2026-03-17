import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export type PresenceStatus = 'COMPOSING' | 'RECORDING' | 'AVAILABLE' | 'UNAVAILABLE' | 'PAUSED' | null;

interface PresenceData {
  status: PresenceStatus;
  lastSeen: Date | null;
}

const ONLINE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h
const TYPING_THRESHOLD_MS = 30 * 1000; // 30s

export function usePresence(phone: string | undefined): PresenceData {
  const [presence, setPresence] = useState<PresenceData>({ status: null, lastSeen: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!phone || !isFirebaseConfigured() || !db) {
      clearTimer();
      setPresence({ status: null, lastSeen: null });
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    console.log(`[usePresence] 🔍 Escutando: presence/${normalizedPhone}`);
    const unsub = onSnapshot(
      doc(db, 'presence', normalizedPhone),
      (snap) => {
        clearTimer();

        if (snap.exists()) {
          const data = snap.data();
          const updatedAt = data.updatedAt?.toDate?.() || null;
          const status = (data.status as PresenceStatus) || null;
          const lastSeen = data.lastSeen?.toDate?.() || null;
          const now = new Date();
          const ageMs = updatedAt ? now.getTime() - updatedAt.getTime() : null;

          console.log(`[usePresence] ✅ Doc ENCONTRADO para ${normalizedPhone}:`, {
            status: data.status,
            updatedAt: updatedAt?.toISOString(),
            lastSeen: lastSeen?.toISOString(),
            ageMs,
            ageSec: ageMs ? Math.round(ageMs / 1000) : null,
          });

          let effectiveStatus: PresenceStatus = status;

          if (updatedAt && status) {
            if (status === 'AVAILABLE' || status === 'PAUSED') {
              if (ageMs! > ONLINE_THRESHOLD_MS) {
                effectiveStatus = null;
              }
            } else if (status === 'COMPOSING' || status === 'RECORDING') {
              if (ageMs! > TYPING_THRESHOLD_MS) {
                effectiveStatus = null;
              } else {
                const remaining = TYPING_THRESHOLD_MS - ageMs!;
                timerRef.current = setTimeout(() => {
                  setPresence(prev => ({ ...prev, status: null }));
                }, remaining);
              }
            }
          }

          console.log(`[usePresence] 🎯 Status efetivo: ${effectiveStatus} (original: ${status})`);
          setPresence({ status: effectiveStatus, lastSeen });
        } else {
          console.log(`[usePresence] ❌ Doc NÃO encontrado para ${normalizedPhone}`);
          setPresence({ status: null, lastSeen: null });
        }
      },
      (err) => {
        console.error('[usePresence] Erro:', err);
        setPresence({ status: null, lastSeen: null });
      }
    );

    return () => {
      clearTimer();
      unsub();
    };
  }, [phone]);

  return presence;
}
