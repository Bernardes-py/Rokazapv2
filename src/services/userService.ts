import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp, Timestamp, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppUser, Department, UserProfile, ADMIN_EMAIL } from '@/types/user';
import { createTenant } from '@/services/tenantService';
import { migrateOrphanDocuments } from '@/services/migrationService';

function timestampToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function docToAppUser(docSnap: any): AppUser {
  const d = docSnap.data();
  return {
    uid: docSnap.id,
    name: d.name || '',
    email: d.email || '',
    department: d.department || 'Atendente',
    profile: d.profile || 'user',
    tenantId: d.tenantId || '',
    createdAt: timestampToDate(d.createdAt),
    updatedAt: timestampToDate(d.updatedAt),
  };
}

export async function getUserDoc(uid: string): Promise<AppUser | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return docToAppUser(snap);
}

export async function createUserDoc(uid: string, data: {
  name: string; email: string; department: Department; profile: UserProfile;
}): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserDoc(uid: string, data: Partial<{
  name: string; email: string; department: Department; profile: UserProfile; tenantId: string;
}>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToUsers(callback: (users: AppUser[]) => void, tenantId?: string): () => void {
  if (!db || !tenantId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(docToAppUser));
  });
}

export async function ensureAdminDoc(uid: string, email: string): Promise<AppUser> {
  if (!db) throw new Error('Firebase não configurado');
  const existing = await getUserDoc(uid);

  // If admin exists but has no tenantId, auto-create tenant and link
  if (existing && existing.email === ADMIN_EMAIL && !existing.tenantId) {
    try {
      const tenantId = await createTenant({ name: 'Lopes X', plan: 'enterprise' });
      if (tenantId) {
        await updateDoc(doc(db!, 'users', uid), { tenantId, updatedAt: serverTimestamp() });
        await migrateOrphanDocuments(tenantId);
        return { ...existing, tenantId };
      }
    } catch (err) {
      console.error('Erro ao criar tenant automático:', err);
    }
    return existing;
  }

  if (existing) {
    if (!existing.tenantId) {
      console.warn(`Usuário ${uid} existe mas sem tenantId. Não sobrescrevendo.`);
    }
    return existing;
  }

  const isAdmin = email === ADMIN_EMAIL;
  let tenantId = '';

  // Auto-create first tenant for master admin
  if (isAdmin) {
    try {
      tenantId = await createTenant({ name: 'Lopes X', plan: 'enterprise' });
      if (tenantId) await migrateOrphanDocuments(tenantId);
    } catch (err) {
      console.error('Erro ao criar tenant automático:', err);
    }
  }

  const userData = {
    name: isAdmin ? 'Kairo Lopes' : email.split('@')[0],
    email,
    department: (isAdmin ? 'Tecnologia' : 'Atendente') as Department,
    profile: (isAdmin ? 'admin' : 'user') as UserProfile,
    tenantId,
  };
  await createUserDoc(uid, userData);
  return { uid, ...userData, createdAt: new Date(), updatedAt: new Date() };
}
