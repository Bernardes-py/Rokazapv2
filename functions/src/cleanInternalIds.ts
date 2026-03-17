import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Callable Cloud Function to clean up conversations and contacts
 * whose phone field contains @lid, @newsletter, or @g.us suffixes.
 * Run once per tenant, then remove this function.
 */
export const cleanInternalIds = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login necessário");
  }

  const uid = context.auth.uid;
  const userDoc = await db.doc(`users/${uid}`).get();
  const tenantId = userDoc.data()?.tenantId;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "Usuário sem tenantId");
  }

  const suffixes = ["@lid", "@newsletter", "@g.us"];
  let deletedConversations = 0;
  let deletedContacts = 0;
  let deletedMessages = 0;

  // 1. Clean conversations
  const convsSnap = await db
    .collection("conversations")
    .where("tenantId", "==", tenantId)
    .get();

  for (const convDoc of convsSnap.docs) {
    const phone = convDoc.data().contactPhone || convDoc.data().phone || "";
    if (suffixes.some((s) => phone.includes(s))) {
      // Delete all messages in subcollection
      const msgsSnap = await convDoc.ref.collection("messages").get();
      const batch = db.batch();
      msgsSnap.docs.forEach((m) => {
        batch.delete(m.ref);
        deletedMessages++;
      });
      batch.delete(convDoc.ref);
      await batch.commit();
      deletedConversations++;
    }
  }

  // 2. Clean contacts
  const contactsSnap = await db
    .collection("contacts")
    .where("tenantId", "==", tenantId)
    .get();

  for (const contactDoc of contactsSnap.docs) {
    const phone = contactDoc.data().phone || "";
    if (suffixes.some((s) => phone.includes(s))) {
      await contactDoc.ref.delete();
      deletedContacts++;
    }
  }

  functions.logger.info("cleanInternalIds completed", {
    tenantId,
    deletedConversations,
    deletedContacts,
    deletedMessages,
  });

  return {
    success: true,
    deletedConversations,
    deletedContacts,
    deletedMessages,
  };
});
