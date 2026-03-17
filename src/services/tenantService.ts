import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, onSnapshot, serverTimestamp, Timestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tenant } from '@/types/tenant';

function timestampToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function docToTenant(docSnap: any): Tenant {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    name: d.name || '',
    logo: d.logo || '',
    plan: d.plan || 'basic',
    active: d.active !== false,
    createdAt: timestampToDate(d.createdAt),
    updatedAt: timestampToDate(d.updatedAt),
  };
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'tenants', tenantId));
  if (!snap.exists()) return null;
  return docToTenant(snap);
}

export async function createTenant(data: { name: string; logo?: string; plan?: Tenant['plan'] }): Promise<string> {
  if (!db) return '';
  const ref = await addDoc(collection(db, 'tenants'), {
    name: data.name,
    logo: data.logo || '',
    plan: data.plan || 'basic',
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTenant(tenantId: string, data: Partial<Pick<Tenant, 'name' | 'logo' | 'plan' | 'active'>>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'tenants', tenantId), { ...data, updatedAt: serverTimestamp() });
}

export function subscribeToTenants(callback: (tenants: Tenant[]) => void): () => void {
  if (!db) return () => {};
  const q = query(collection(db, 'tenants'), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(docToTenant));
  });
}
