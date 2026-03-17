import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const seedContacts = functions.https.onCall(async (_data, _context) => {
  const convsSnap = await db.collection("conversations").get();
  let created = 0;
  let skipped = 0;

  for (const convDoc of convsSnap.docs) {
    const data = convDoc.data();
    const phone = data.contactPhone || "";
    if (!phone) {
      skipped++;
      continue;
    }

    // Check if contact already exists
    const existing = await db.collection("contacts")
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped++;
      continue;
    }

    await db.collection("contacts").add({
      phone,
      name: data.contactName || "",
      avatar: data.contactAvatar || "",
      email: "",
      cpf: "",
      condominium: "",
      block: "",
      unit: "",
      address: "",
      customNotes: "",
      tags: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created++;
  }

  console.log(`seedContacts: created=${created}, skipped=${skipped}`);
  return { created, skipped, total: convsSnap.size };
});
