import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  clientToken: string;
  apiUrl: string;
  tenantId?: string;
}

export async function getZApiConfig(userId: string): Promise<ZApiConfig> {
  // Tentativa 1: doc ID = userId (caminho rapido)
  const doc = await db.collection("zapi_config").doc(userId).get();
  if (doc.exists) return doc.data() as ZApiConfig;

  // Tentativa 2: buscar pelo campo ownerId
  const byOwner = await db.collection("zapi_config")
    .where("ownerId", "==", userId)
    .limit(1)
    .get();
  if (!byOwner.empty) return byOwner.docs[0].data() as ZApiConfig;

  // Tentativa 3: buscar pelo tenantId do usuário
  const userDoc = await db.collection("users").doc(userId).get();
  if (userDoc.exists) {
    const tenantId = userDoc.data()?.tenantId;
    if (tenantId) {
      const byTenant = await db.collection("zapi_config")
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();
      if (!byTenant.empty) return byTenant.docs[0].data() as ZApiConfig;
    }
  }

  // Tentativa 4: fallback para instancia unica
  const any = await db.collection("zapi_config").limit(1).get();
  if (!any.empty) return any.docs[0].data() as ZApiConfig;

  throw new functions.https.HttpsError("not-found", "Configuracao Z-API nao encontrada");
}

export async function getZApiConfigByInstanceId(instanceId: string): Promise<ZApiConfig & { ownerId: string }> {
  const snap = await db.collection("zapi_config")
    .where("instanceId", "==", instanceId)
    .limit(1)
    .get();

  if (!snap.empty) {
    const data = snap.docs[0].data() as ZApiConfig;
    return { ...data, ownerId: snap.docs[0].id };
  }

  throw new functions.https.HttpsError("not-found", "Configuracao Z-API nao encontrada para instanceId: " + instanceId);
}
