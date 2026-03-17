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
exports.setupAmoCondominioConfig = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/**
 * One-time setup: ensures superlogica_config doc for Amo Condomínio
 * has the firestoreTenantId field set so credential resolution works.
 */
exports.setupAmoCondominioConfig = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    // Check if user is admin
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.profile) !== "admin") {
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
        const currentIds = data.condominioIds || [];
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
//# sourceMappingURL=setupAmoConfig.js.map