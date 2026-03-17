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
exports.seedContacts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
exports.seedContacts = functions.https.onCall(async (_data, _context) => {
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
//# sourceMappingURL=seedContacts.js.map