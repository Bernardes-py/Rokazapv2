import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const migratePhoneFormat = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const contactsSnap = await db.collection("contacts").get();
    let migrated = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const doc of contactsSnap.docs) {
      const phone = doc.data().phone as string;
      if (!phone || phone.length !== 13) {
        skipped++;
        continue;
      }

      // Remove the 5th digit (the extra "9" after 55+DDD)
      const newPhone = phone.slice(0, 4) + phone.slice(5);

      // Check if a contact with the new phone already exists
      const existing = await db.collection("contacts").where("phone", "==", newPhone).limit(1).get();
      if (!existing.empty && existing.docs[0].id !== doc.id) {
        console.log(`migratePhoneFormat - duplicata encontrada: ${phone} -> ${newPhone}, pulando`);
        duplicates++;
        continue;
      }

      // Update contact phone
      await doc.ref.update({ phone: newPhone, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // Update conversations participants array
      const convSnap = await db.collection("conversations")
        .where("participants", "array-contains", phone)
        .get();

      for (const convDoc of convSnap.docs) {
        const participants: string[] = convDoc.data().participants || [];
        const updated = participants.map((p: string) => p === phone ? newPhone : p);
        const updateData: Record<string, any> = { participants: updated };

        // Also update contactPhone if it matches
        if (convDoc.data().contactPhone === phone) {
          updateData.contactPhone = newPhone;
        }

        await convDoc.ref.update(updateData);
      }

      migrated++;
    }

    console.log(`migratePhoneFormat - migrados: ${migrated}, pulados: ${skipped}, duplicatas: ${duplicates}`);
    return { migrated, skipped, duplicates, total: contactsSnap.size };
  });
