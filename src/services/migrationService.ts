import {
  collection, getDocs, writeBatch, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTIONS_TO_MIGRATE = ['conversations', 'contacts', 'tags', 'kanban_cards'];
const BATCH_LIMIT = 500;
const MIGRATION_FLAG = 'migrations/tenant_seed';

export async function migrateOrphanDocuments(tenantId: string): Promise<number> {
  if (!db || !tenantId) return 0;

  // Check if migration already ran
  const flagSnap = await getDoc(doc(db, MIGRATION_FLAG));
  if (flagSnap.exists() && flagSnap.data()?.done) {
    console.log('✅ Migração já executada anteriormente.');
    return 0;
  }

  let totalMigrated = 0;

  for (const colName of COLLECTIONS_TO_MIGRATE) {
    const snap = await getDocs(collection(db, colName));
    const orphans = snap.docs.filter((d) => {
      const data = d.data();
      return !data.tenantId || data.tenantId === '';
    });

    // Process in batches of 500
    for (let i = 0; i < orphans.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = orphans.slice(i, i + BATCH_LIMIT);
      chunk.forEach((d) => {
        batch.update(d.ref, { tenantId });
      });
      await batch.commit();
    }

    if (orphans.length > 0) {
      console.log(`📦 Migrados ${orphans.length} documentos em "${colName}"`);
    }
    totalMigrated += orphans.length;
  }

  // Set flag
  await setDoc(doc(db, MIGRATION_FLAG), {
    done: true,
    tenantId,
    migratedAt: serverTimestamp(),
    totalMigrated,
  });

  console.log(`✅ Migração concluída: ${totalMigrated} documentos atualizados.`);
  return totalMigrated;
}
