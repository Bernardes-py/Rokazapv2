import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * One-time setup: ensures superlogica_config doc for Amo Condomínio
 * has the firestoreTenantId field set so credential resolution works.
 */
export const setupAmoCondominioConfig = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  // Check if user is admin
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  if (userDoc.data()?.profile !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Apenas admins");
  }

  const firestoreTenantId = "AyGEjmRvU1bQiKQruiiE";
  const AMO_APP_TOKEN = "46cee13a-6807-4676-a287-7c474c3f128a";
  const AMO_ACCESS_TOKEN = "76dd967a-7c05-419f-9260-9820cdc47f03";

  // Check if already linked
  const existing = await db
    .collection("superlogica_config")
    .where("firestoreTenantId", "==", firestoreTenantId)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();

    // Repair if tokens don't match Amo's credentials
    if (data.appToken !== AMO_APP_TOKEN || data.accessToken !== AMO_ACCESS_TOKEN) {
      await doc.ref.update({
        appToken: AMO_APP_TOKEN,
        accessToken: AMO_ACCESS_TOKEN,
        condominioIds: ["47"],
        tenantId: firestoreTenantId,
      });
      console.log(`[setupAmoCondominioConfig] Repaired doc ${doc.id} with correct Amo credentials`);
      return { status: "repaired", docId: doc.id };
    }

    // Tokens match, but check if condominioIds needs repair
    const currentIds: string[] = data.condominioIds || [];
    if (!currentIds.includes("47") || currentIds.length !== 1) {
      await doc.ref.update({ condominioIds: ["47"] });
      console.log(`[setupAmoCondominioConfig] Repaired condominioIds on doc ${doc.id}`);
      return { status: "repaired", docId: doc.id };
    }

    return { status: "already_linked", docId: doc.id };
  }

  // Also check by tenantId field
  const byTenant = await db
    .collection("superlogica_config")
    .where("tenantId", "==", firestoreTenantId)
    .limit(1)
    .get();

  if (!byTenant.empty) {
    const doc = byTenant.docs[0];

    await doc.ref.update({
      appToken: AMO_APP_TOKEN,
      accessToken: AMO_ACCESS_TOKEN,
      condominioIds: ["47"],
      firestoreTenantId,
      tenantId: firestoreTenantId,
    });
    console.log(`[setupAmoCondominioConfig] Repaired doc ${doc.id} (found by tenantId) with correct Amo credentials`);
    return { status: "repaired", docId: doc.id };
  }

  // Create new doc for Amo
  const newDoc = await db.collection("superlogica_config").add({
    appToken: AMO_APP_TOKEN,
    accessToken: AMO_ACCESS_TOKEN,
    condominioIds: ["47"],
    firestoreTenantId,
    tenantId: firestoreTenantId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[setupAmoCondominioConfig] Created new doc ${newDoc.id} for Amo Condomínio`);
  return { status: "created", docId: newDoc.id };
});
