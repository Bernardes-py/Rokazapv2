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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSticker = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
exports.sendSticker = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { phone, conversationId, messageDocId } = data;
    let sticker = data.sticker || "";
    console.log("sendSticker - Payload recebido:", JSON.stringify({ phone, conversationId, messageDocId, stickerLength: sticker === null || sticker === void 0 ? void 0 : sticker.length }));
    if (!phone || !sticker || !conversationId || !messageDocId) {
        throw new functions.https.HttpsError("invalid-argument", "phone, sticker, conversationId e messageDocId são obrigatórios");
    }
    // If it's a URL, send as-is. If base64, remove data URI prefix if present.
    if (!sticker.startsWith("http")) {
        if (sticker.includes(",")) {
            sticker = sticker.split(",")[1];
        }
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const missing = [];
    if (!config.instanceId)
        missing.push("instanceId");
    if (!config.instanceToken)
        missing.push("instanceToken");
    if (!config.clientToken)
        missing.push("clientToken");
    if (!config.apiUrl)
        missing.push("apiUrl");
    if (missing.length > 0) {
        throw new functions.https.HttpsError("failed-precondition", `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`);
    }
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-sticker`;
    console.log("sendSticker - URL Z-API:", url);
    const body = { phone, sticker };
    if (sticker.startsWith('http')) {
        body.stickerAuthor = 'RokaZap';
    }
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify(body),
    });
    const responseText = await response.text();
    console.log("sendSticker - Response status:", response.status, "body:", responseText);
    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
    }
    let result;
    try {
        result = JSON.parse(responseText);
    }
    catch (e) {
        throw new functions.https.HttpsError("internal", "Resposta Z-API inválida (não é JSON)");
    }
    if (!result.messageId) {
        throw new functions.https.HttpsError("internal", "Z-API não retornou messageId");
    }
    const zapiMessageId = String(result.messageId);
    const msgDocRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
    const encodedId = encodeURIComponent(zapiMessageId);
    const mapRef = db.collection("zapi_message_map").doc(encodedId);
    await Promise.all([
        msgDocRef.update({ zapiMessageId, status: "sent" }),
        mapRef.set({
            conversationId,
            messageDocId,
            zapiMessageId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        db.collection("conversations").doc(conversationId).update({
            lastMessageStatus: "sent",
            lastMessageZapiMessageId: zapiMessageId,
            lastMessageIsFromMe: true,
        }),
    ]);
    console.log("sendSticker - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
    return { zaapId: result.zaapId, messageId: zapiMessageId };
});
//# sourceMappingURL=sendSticker.js.map