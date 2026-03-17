import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { clearIndexedDbPersistence } from 'firebase/firestore';
import { AppUser } from '@/types/user';
import { ensureAdminDoc, getUserDoc } from '@/services/userService';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  firebaseReady: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const doc = await ensureAdminDoc(u.uid, u.email || '');
          setAppUser(doc);
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase não configurado');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    if (db) {
      try {
        await clearIndexedDbPersistence(db);
      } catch (e) {
        console.warn('Não foi possível limpar cache do Firestore:', e);
      }
    }
  };

  const refreshAppUser = async () => {
    if (!user) return;
    const doc = await getUserDoc(user.uid);
    if (doc) setAppUser(doc);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, firebaseReady, signInWithPassword, signOut, refreshAppUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
