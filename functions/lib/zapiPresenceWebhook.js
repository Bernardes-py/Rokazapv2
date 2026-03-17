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
exports.zapiPresenceWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/**
 * Webhook para receber eventos de presença do chat (on-chat-presence).
 *
 * Payload esperado da Z-API:
 * {
 *   "type": "PresenceChatCallback",
 *   "phone": "5544999999999",
 *   "status": "COMPOSING" | "RECORDING" | "AVAILABLE" | "UNAVAILABLE" | "PAUSED",
 *   "lastSeen": timestamp | null,
 *   "instanceId": "instance.id"
 * }
 *
 * Armazena em: presence/{phone}
 */
exports.zapiPresenceWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        console.log("[Presence] Payload completo recebido:", JSON.stringify(req.body));
        const { phone, status, lastSeen } = req.body;
        if (!phone || !status) {
            console.warn("Presence webhook: payload inválido", JSON.stringify(req.body));
            res.status(400).send("phone and status required");
            return;
        }
        const normalizedPhone = phone.replace(/\D/g, "");
        console.log(`[Presence] ${normalizedPhone} -> ${status}`);
        await db.collection("presence").doc(normalizedPhone).set({
            phone: normalizedPhone,
            status: status.toUpperCase(),
            lastSeen: lastSeen ? new Date(lastSeen * 1000) : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).send("OK");
    }
    catch (error) {
        console.error("Erro no presence webhook:", error);
        res.status(500).send("Internal Error");
    }
});
//# sourceMappingURL=zapiPresenceWebhook.js.map