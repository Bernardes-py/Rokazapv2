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
exports.testConnection = exports.sendMessage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
exports.sendMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { phone, message, conversationId, messageDocId } = data;
    console.log("sendMessage - Payload recebido:", JSON.stringify({ phone, message, conversationId, messageDocId }));
    if (!phone || !message || !conversationId || !messageDocId) {
        throw new functions.https.HttpsError("invalid-argument", "phone, message, conversationId e messageDocId são obrigatórios");
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
        console.error("Campos ausentes na config Z-API:", missing.join(", "));
        throw new functions.https.HttpsError("failed-precondition", `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`);
    }
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-text`;
    console.log("sendMessage - URL Z-API:", url);
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ phone, message }),
    });
    const responseText = await response.text();
    console.log("sendMessage - Response status:", response.status, "body:", responseText);
    if (!response.ok) {
        console.error("Erro Z-API:", response.status, responseText);
        throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
    }
    let result;
    try {
        result = JSON.parse(responseText);
    }
    catch (e) {
        console.error("sendMessage - Falha ao parsear resposta Z-API:", responseText);
        throw new functions.https.HttpsError("internal", "Resposta Z-API inválida (não é JSON)");
    }
    console.log("sendMessage - Resposta Z-API parseada:", JSON.stringify(result));
    if (!result.messageId) {
        console.error("sendMessage - messageId ausente na resposta Z-API:", JSON.stringify(result));
        throw new functions.https.HttpsError("internal", "Z-API não retornou messageId");
    }
    // Normalizar messageId para string
    const zapiMessageId = String(result.messageId);
    const msgDocRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
    console.log("sendMessage - Atualizando doc:", msgDocRef.path, "com zapiMessageId:", zapiMessageId);
    // Salvar mapa de roteamento para lookup direto no webhook de status
    const encodedId = encodeURIComponent(zapiMessageId);
    const mapRef = db.collection("zapi_message_map").doc(encodedId);
    console.log("sendMessage - Salvando mapa:", mapRef.path);
    await Promise.all([
        msgDocRef.update({
            zapiMessageId,
            status: "sent",
        }),
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
    console.log("sendMessage - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
    return { zaapId: result.zaapId, messageId: zapiMessageId };
});
exports.testConnection = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/status`;
    const response = await (0, node_fetch_1.default)(url, {
        method: "GET",
        headers: { "Client-Token": config.clientToken },
    });
    if (!response.ok) {
        return { connected: false, error: `Status ${response.status}` };
    }
    const result = await response.json();
    return { connected: result.connected, phone: result.phone };
});
//# sourceMappingURL=sendMessage.js.map