"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.migratePhoneFormat = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
exports.migratePhoneFormat = functions
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
        const phone = doc.data().phone;
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
            const participants = convDoc.data().participants || [];
            const updated = participants.map((p) => p === phone ? newPhone : p);
            const updateData = { participants: updated };
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
//# sourceMappingURL=migratePhoneFormat.js.map