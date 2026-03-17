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
exports.zapiStatusWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function mapZApiStatus(zapiStatus) {
    // Suporte a ack numérico da Z-API
    if (typeof zapiStatus === "number") {
        switch (zapiStatus) {
            case 0:
            case 1:
                return "sent";
            case 2:
                return "delivered";
            case 3:
            case 4:
                return "read";
            default:
                console.warn(`ACK numérico desconhecido: ${zapiStatus}, mapeando para "sent"`);
                return "sent";
        }
    }
    const normalized = (zapiStatus || "").toUpperCase().trim();
    switch (normalized) {
        case "SENT":
            return "sent";
        case "RECEIVED":
        case "DELIVERED":
            return "delivered";
        case "READ":
        case "READ_BY_ME":
        case "PLAYED":
            return "read";
        // Ack como string numérica
        case "0":
        case "1":
            return "sent";
        case "2":
            return "delivered";
        case "3":
        case "4":
            return "read";
        default:
            console.warn(`Status Z-API desconhecido: "${zapiStatus}", mapeando para "sent"`);
            return "sent";
    }
}
function extractIds(body) {
    var _a;
    const raw = [];
    if (body.ids && Array.isArray(body.ids))
        raw.push(...body.ids);
    if (body.id)
        raw.push(body.id);
    if (body.messageId)
        raw.push(body.messageId);
    if ((_a = body.message) === null || _a === void 0 ? void 0 : _a.id)
        raw.push(body.message.id);
    const unique = new Set(raw.map((v) => String(v)));
    return Array.from(unique);
}
function extractStatus(body) {
    var _a, _b, _c;
    return (_c = (_b = (_a = body.status) !== null && _a !== void 0 ? _a : body.messageStatus) !== null && _b !== void 0 ? _b : body.ack) !== null && _c !== void 0 ? _c : null;
}
async function updateConversationStatus(conversationId, zapiMsgId, mappedStatus) {
    const convRef = db.collection("conversations").doc(conversationId);
    const convDoc = await convRef.get();
    if (!convDoc.exists)
        return;
    const convData = convDoc.data();
    if ((convData === null || convData === void 0 ? void 0 : convData.lastMessageZapiMessageId) === zapiMsgId ||
        (convData === null || convData === void 0 ? void 0 : convData.lastMessageIsFromMe) === true) {
        await convRef.update({ lastMessageStatus: mappedStatus });
        console.log(`Conversa ${conversationId} lastMessageStatus -> "${mappedStatus}"`);
    }
}
exports.zapiStatusWebhook = functions.https.onRequest(async (req, res) => {
    var _a;
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        console.log("zapiStatusWebhook payload:", JSON.stringify(req.body));
        const ids = extractIds(req.body);
        const statusRaw = extractStatus(req.body);
        if (ids.length === 0 || statusRaw === null || statusRaw === undefined) {
            console.warn("Payload sem IDs ou status válido:", JSON.stringify(req.body));
            res.status(400).send("ids and status required");
            return;
        }
        const mappedStatus = mapZApiStatus(statusRaw);
        console.log(`Status mapeado: "${statusRaw}" -> "${mappedStatus}" para ${ids.length} ID(s)`);
        for (const zapiMsgId of ids) {
            try {
                console.log(`[${zapiMsgId}] Processando...`);
                // === Caminho principal: lookup direto via mapa ===
                const encodedId = encodeURIComponent(zapiMsgId);
                const mapDoc = await db.collection("zapi_message_map").doc(encodedId).get();
                if (mapDoc.exists) {
                    const mapData = mapDoc.data();
                    const { conversationId, messageDocId } = mapData;
                    console.log(`[${zapiMsgId}] Mapa encontrado -> conv: ${conversationId}, msg: ${messageDocId}`);
                    const msgRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
                    await msgRef.update({ status: mappedStatus });
                    console.log(`[${zapiMsgId}] Status atualizado para "${mappedStatus}"`);
                    await updateConversationStatus(conversationId, zapiMsgId, mappedStatus);
                    continue;
                }
                console.log(`[${zapiMsgId}] Mapa não encontrado, tentando fallback collectionGroup...`);
                // === Fallback: collectionGroup (mensagens antigas sem mapa) ===
                try {
                    const convsSnapshot = await db.collectionGroup("messages")
                        .where("zapiMessageId", "==", zapiMsgId)
                        .limit(1)
                        .get();
                    if (convsSnapshot.empty) {
                        console.warn(`[${zapiMsgId}] Não encontrada em nenhum caminho.`);
                        continue;
                    }
                    const msgDoc = convsSnapshot.docs[0];
                    console.log(`[${zapiMsgId}] Fallback encontrou: ${msgDoc.ref.path}`);
                    await msgDoc.ref.update({ status: mappedStatus });
                    const conversationId = (_a = msgDoc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
                    if (conversationId) {
                        await updateConversationStatus(conversationId, zapiMsgId, mappedStatus);
                    }
                }
                catch (fallbackErr) {
                    console.error(`[${zapiMsgId}] Fallback collectionGroup falhou (índice ausente?):`, fallbackErr);
                }
            }
            catch (idErr) {
                console.error(`[${zapiMsgId}] Erro ao processar ID:`, idErr);
            }
        }
        res.status(200).send("OK");
    }
    catch (error) {
        console.error("Erro no status webhook:", error);
        res.status(500).send("Internal Error");
    }
});
//# sourceMappingURL=zapiStatusWebhook.js.map