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
exports.getZApiConfig = getZApiConfig;
exports.getZApiConfigByInstanceId = getZApiConfigByInstanceId;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
async function getZApiConfig(userId) {
    var _a;
    // Tentativa 1: doc ID = userId (caminho rapido)
    const doc = await db.collection("zapi_config").doc(userId).get();
    if (doc.exists)
        return doc.data();
    // Tentativa 2: buscar pelo campo ownerId
    const byOwner = await db.collection("zapi_config")
        .where("ownerId", "==", userId)
        .limit(1)
        .get();
    if (!byOwner.empty)
        return byOwner.docs[0].data();
    // Tentativa 3: buscar pelo tenantId do usuário
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
        const tenantId = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.tenantId;
        if (tenantId) {
            const byTenant = await db.collection("zapi_config")
                .where("tenantId", "==", tenantId)
                .limit(1)
                .get();
            if (!byTenant.empty)
                return byTenant.docs[0].data();
        }
    }
    // Tentativa 4: fallback para instancia unica
    const any = await db.collection("zapi_config").limit(1).get();
    if (!any.empty)
        return any.docs[0].data();
    throw new functions.https.HttpsError("not-found", "Configuracao Z-API nao encontrada");
}
async function getZApiConfigByInstanceId(instanceId) {
    const snap = await db.collection("zapi_config")
        .where("instanceId", "==", instanceId)
        .limit(1)
        .get();
    if (!snap.empty) {
        const data = snap.docs[0].data();
        return { ...data, ownerId: snap.docs[0].id };
    }
    throw new functions.https.HttpsError("not-found", "Configuracao Z-API nao encontrada para instanceId: " + instanceId);
}
//# sourceMappingURL=zapiConfig.js.map