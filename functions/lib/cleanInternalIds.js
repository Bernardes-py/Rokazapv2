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
exports.cleanInternalIds = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/**
 * Callable Cloud Function to clean up conversations and contacts
 * whose phone field contains @lid, @newsletter, or @g.us suffixes.
 * Run once per tenant, then remove this function.
 */
exports.cleanInternalIds = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login necessário");
    }
    const uid = context.auth.uid;
    const userDoc = await db.doc(`users/${uid}`).get();
    const tenantId = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.tenantId;
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
//# sourceMappingURL=cleanInternalIds.js.map